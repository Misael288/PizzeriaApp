type IngredientInput = {
  name: string;
  description: string | null;
  unit: string;
  stock: number;
  minimumStock: number;
  type: "INGREDIENTE" | "CONSUMIBLE";
  extraPrice: number;
  extraQuantity: number;
};

type RecipeComponentInput = {
  ingredientId: number;
  quantity: number;
};

type RecipeInput = {
  sizeId: number | null;
  ingredients: RecipeComponentInput[];
};

type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; message: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseStockValue = (value: unknown, field: string): number | null => {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 999_999_999.999 ||
    Math.abs(value * 1000 - Math.round(value * 1000)) > 0.0000001
  ) {
    return null;
  }
  if (field === "quantity" && value === 0) return null;
  return value;
};

const parseIngredientInput = (
  value: unknown,
): ValidationResult<IngredientInput> => {
  if (!isRecord(value)) {
    return { success: false, message: "El ingrediente debe ser un objeto." };
  }

  if (
    typeof value.name !== "string" ||
    value.name.trim().length === 0 ||
    value.name.trim().length > 100
  ) {
    return {
      success: false,
      message: "El nombre debe tener entre 1 y 100 caracteres.",
    };
  }
  if (
    typeof value.unit !== "string" ||
    !["g", "kg", "ml", "l", "pieza"].includes(value.unit)
  ) {
    return {
      success: false,
      message: "La unidad debe ser g, kg, ml, l o pieza.",
    };
  }
  const description =
    value.description === null || value.description === undefined
      ? null
      : typeof value.description === "string" &&
          value.description.trim().length <= 255
        ? value.description.trim() || null
        : undefined;
  if (description === undefined) {
    return {
      success: false,
      message: "La descripción no puede superar 255 caracteres.",
    };
  }
  const type =
    value.type === undefined || value.type === "INGREDIENTE"
      ? "INGREDIENTE"
      : value.type === "CONSUMIBLE"
        ? "CONSUMIBLE"
        : null;
  if (type === null) {
    return {
      success: false,
      message: "El tipo debe ser ingrediente o consumible.",
    };
  }
  const stock = parseStockValue(value.stock, "stock");
  if (stock === null) {
    return {
      success: false,
      message: "La existencia debe ser un valor no negativo con hasta tres decimales.",
    };
  }
  const minimumStock = parseStockValue(value.minimumStock, "minimumStock");
  if (minimumStock === null) {
    return {
      success: false,
      message: "El mínimo debe ser un valor no negativo con hasta tres decimales.",
    };
  }
  const extraPrice =
    value.extraPrice === undefined ? 0 : parseStockValue(value.extraPrice, "extraPrice");
  if (
    extraPrice === null ||
    extraPrice > 99_999_999.99 ||
    Math.abs(extraPrice * 100 - Math.round(extraPrice * 100)) > 0.0000001
  ) {
    return {
      success: false,
      message: "El precio extra debe ser no negativo y tener hasta dos decimales.",
    };
  }
  const extraQuantity =
    value.extraQuantity === undefined
      ? 1
      : parseStockValue(value.extraQuantity, "extraQuantity");
  if (extraQuantity === null || extraQuantity === 0) {
    return {
      success: false,
      message: "La cantidad de ingrediente extra debe ser positiva.",
    };
  }

  return {
    success: true,
    data: {
      name: value.name.trim(),
      description,
      unit: value.unit,
      stock,
      minimumStock,
      type,
      extraPrice,
      extraQuantity,
    },
  };
};

const parseRecipeInput = (value: unknown): ValidationResult<RecipeInput> => {
  if (!isRecord(value)) {
    return { success: false, message: "La receta debe ser un objeto." };
  }
  const sizeId =
    value.sizeId === null
      ? null
      : typeof value.sizeId === "number" &&
          Number.isSafeInteger(value.sizeId) &&
          value.sizeId > 0
        ? value.sizeId
        : undefined;
  if (sizeId === undefined) {
    return { success: false, message: "La presentación seleccionada no es válida." };
  }
  if (
    !Array.isArray(value.ingredients) ||
    value.ingredients.length > 100
  ) {
    return {
      success: false,
      message: "La receta puede tener hasta 100 ingredientes.",
    };
  }

  const ingredients: RecipeComponentInput[] = [];
  const ids = new Set<number>();
  for (const [index, entry] of value.ingredients.entries()) {
    if (!isRecord(entry)) {
      return {
        success: false,
        message: `El ingrediente ${index + 1} no tiene un formato válido.`,
      };
    }
    const ingredientId =
      typeof entry.ingredientId === "number" &&
      Number.isSafeInteger(entry.ingredientId) &&
      entry.ingredientId > 0
        ? entry.ingredientId
        : null;
    const quantity = parseStockValue(entry.quantity, "quantity");
    if (ingredientId === null || quantity === null) {
      return {
        success: false,
        message: `El ingrediente ${index + 1} requiere una referencia y cantidad positiva válidas.`,
      };
    }
    if (ids.has(ingredientId)) {
      return {
        success: false,
        message: "No se puede repetir un ingrediente en la misma receta.",
      };
    }
    ids.add(ingredientId);
    ingredients.push({ ingredientId, quantity });
  }

  return { success: true, data: { sizeId, ingredients } };
};

export { parseIngredientInput, parseRecipeInput };
export type { IngredientInput, RecipeInput };
