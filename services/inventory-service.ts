import {
  createIngredient,
  getShowSoldOutSetting,
  listIngredients,
  listInventoryCatalog,
  listRecentInventoryMovements,
  listProductsForRecipe,
  listRecipeComponents,
  replaceRecipe,
  saveShowSoldOutSetting,
  updateIngredient,
  updateProductAvailability,
} from "@/repositories/inventory-repository";
import type {
  IngredientInput,
  RecipeInput,
} from "@/validators/inventory-validator";

class InventoryServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "InventoryServiceError";
  }
}

type InventoryProduct = Awaited<
  ReturnType<typeof listInventoryCatalog>
>[number];

const isSizeAvailable = (
  product: InventoryProduct,
  sizeId: number | null,
): boolean => {
  const variants = product.recetas.filter(
    (recipe) => recipe.id_tamano === sizeId,
  );
  const recipe =
    variants.length > 0
      ? variants
      : sizeId === null
        ? []
        : product.recetas.filter((entry) => entry.id_tamano === null);
  return (
    recipe.length > 0 &&
    recipe.every(
      (line) =>
        !line.ingredientes.bloqueado &&
        line.ingredientes.stock_actual.greaterThan(
          line.ingredientes.stock_minimo,
        ) &&
        line.ingredientes.stock_actual.greaterThanOrEqualTo(
          line.cantidad_requerida,
        ),
    )
  );
};

const getProductAvailability = (product: InventoryProduct) => {
  const sizes =
    product.producto_tamanos.length > 0
      ? product.producto_tamanos.map((size) => ({
          sizeId: size.id_tamano,
          available:
            product.disponible && isSizeAvailable(product, size.id_tamano),
        }))
      : [
          {
            sizeId: null,
            available: product.disponible && isSizeAvailable(product, null),
          },
        ];
  return {
    productId: product.id_producto,
    manuallyEnabled: product.disponible,
    available: sizes.some((size) => size.available),
    recipeConfigured: sizes.every((size) =>
      product.recetas.some(
        (recipe) =>
          recipe.id_tamano === size.sizeId ||
          (size.sizeId !== null && recipe.id_tamano === null),
      ),
    ),
    sizes,
  };
};

const getInventoryOverview = async (includeMovements = true) => {
  const [ingredients, products, catalog, recipes, movements, showSoldOut] =
    await Promise.all([
      listIngredients(),
      listProductsForRecipe(),
      listInventoryCatalog(),
      listRecipeComponents(),
      includeMovements ? listRecentInventoryMovements() : Promise.resolve([]),
      getShowSoldOutSetting(),
    ]);

  return {
    ingredients: ingredients.map((ingredient) => ({
      ...ingredient,
      stock_actual: ingredient.stock_actual.toString(),
      stock_minimo: ingredient.stock_minimo.toString(),
      lowStock: ingredient.stock_actual.lessThanOrEqualTo(
        ingredient.stock_minimo,
      ),
    })),
    products,
    recipes: recipes.map((recipe) => ({
      ...recipe,
      cantidad_requerida: recipe.cantidad_requerida.toString(),
    })),
    movements: movements.map((movement) => ({
      ...movement,
      cantidad: movement.cantidad.toString(),
      stock_anterior: movement.stock_anterior.toString(),
      stock_nuevo: movement.stock_nuevo.toString(),
      creado_en: movement.creado_en.toISOString(),
    })),
    availability: catalog.map(getProductAvailability),
    showSoldOut,
  };
};

const getCashierAvailability = async () => {
  const overview = await getInventoryOverview(false);
  return {
    products: overview.availability,
    ingredients: overview.ingredients.map((ingredient) => ({
      id: ingredient.id_ingrediente,
      name: ingredient.nombre,
      unit: ingredient.unidad_medida,
      available: !ingredient.bloqueado && Number(ingredient.stock_actual) > 0,
      lowStock: ingredient.lowStock,
    })),
  };
};

const addIngredient = async (data: IngredientInput, userId: number) => {
  try {
    return await createIngredient(data, userId);
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      throw new InventoryServiceError(
        "Ya existe un ingrediente con ese nombre.",
        409,
      );
    }
    throw error;
  }
};

const editIngredient = async (
  id: number,
  data: IngredientInput,
  userId: number,
) => {
  try {
    const ingredient = await updateIngredient(id, data, userId);
    if (!ingredient) {
      throw new InventoryServiceError("El ingrediente no existe.", 404);
    }
    return ingredient;
  } catch (error: unknown) {
    if (
      error instanceof InventoryServiceError ||
      (typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002")
    ) {
      if (error instanceof InventoryServiceError) throw error;
      throw new InventoryServiceError(
        "Ya existe un ingrediente con ese nombre.",
        409,
      );
    }
    throw error;
  }
};

const saveRecipe = async (productId: number, data: RecipeInput) => {
  const result = await replaceRecipe(productId, data);
  if (result === "PRODUCT_NOT_FOUND") {
    throw new InventoryServiceError("El producto no existe.", 404);
  }
  if (result === "SIZE_NOT_FOUND") {
    throw new InventoryServiceError(
      "La presentación no pertenece al producto.",
      422,
    );
  }
  if (result === "INGREDIENT_NOT_FOUND") {
    throw new InventoryServiceError(
      "Uno o más ingredientes no existen.",
      422,
    );
  }
  return { saved: true };
};

const updateSoldOutVisibility = async (showSoldOut: boolean) => {
  await saveShowSoldOutSetting(showSoldOut);
  return { showSoldOut };
};

const getAvailabilityForProduct = async (productId: number) => {
  const catalog = await listInventoryCatalog();
  const productRecord = catalog.find(
    (entry) => entry.id_producto === productId,
  );
  const product = productRecord ? getProductAvailability(productRecord) : null;
  if (!product) {
    throw new InventoryServiceError("El producto no existe.", 404);
  }
  return product;
};

const setProductAvailability = async (
  productId: number,
  available: boolean,
) => {
  if (available) {
    const catalog = await listInventoryCatalog();
    const product = catalog.find(
      (entry) => entry.id_producto === productId,
    );
    if (!product) {
      throw new InventoryServiceError("El producto no existe.", 404);
    }
    const sizeIds =
      product.producto_tamanos.length > 0
        ? product.producto_tamanos.map((size) => size.id_tamano)
        : [null];
    if (!sizeIds.some((sizeId) => isSizeAvailable(product, sizeId))) {
      throw new InventoryServiceError(
        "No se puede habilitar: configura una receta y existencia suficiente para al menos una presentación.",
        409,
      );
    }
  }
  return updateProductAvailability(productId, available);
};

export {
  InventoryServiceError,
  addIngredient,
  editIngredient,
  getAvailabilityForProduct,
  getCashierAvailability,
  getInventoryOverview,
  saveRecipe,
  setProductAvailability,
  updateSoldOutVisibility,
};
