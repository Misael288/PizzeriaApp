import {
  createCategory,
  createProduct,
  createSize,
  findCategoryById,
  findCategoryIsActive,
  findProductById,
  findSizeByName,
  findSizesByIds,
  listCategories,
  listProducts,
  listSizes,
  updateCategory,
  updateProduct,
} from "@/repositories/catalog-repository";
import type {
  CategoryInput,
  ProductInput,
  SizeInput,
} from "@/validators/catalog-validator";
import { containsForbiddenText } from "@/services/profanity-service";

class CatalogServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CatalogServiceError";
  }
}

const getCategories = (activeOnly: boolean) => listCategories(activeOnly);

const addCategory = (data: CategoryInput) => createCategory(data);

const editCategory = async (id: number, data: CategoryInput) => {
  if (!(await findCategoryById(id))) {
    throw new CatalogServiceError("La categoría no existe.", 404);
  }

  return updateCategory(id, data);
};

const getSizes = () => listSizes();

const addSize = async (data: SizeInput) => {
  if (await findSizeByName(data.name)) {
    throw new CatalogServiceError("Ya existe un tamaño con ese nombre.", 409);
  }

  return createSize(data);
};

const getProducts = (availableOnly: boolean) => listProducts(availableOnly);

const isCatalogImagePath = (image: string): boolean =>
  /^\/uploads\/products\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i.test(
    image,
  );

const validateProductReferences = async (
  data: ProductInput,
  existingImage: string | null,
  existingCategoryId?: number,
): Promise<void> => {
  if (
    data.image &&
    !isCatalogImagePath(data.image) &&
    data.image !== existingImage
  ) {
    throw new CatalogServiceError(
      "Importa la imagen desde el formulario del catálogo.",
      422,
    );
  }

  const activeCategory = await findCategoryIsActive(data.categoryId);

  if (!activeCategory && existingCategoryId !== data.categoryId) {
    throw new CatalogServiceError(
      "Selecciona una categoría existente y activa.",
      422,
    );
  }

  const uniqueIds = [...new Set(data.sizes.map((size) => size.sizeId))];

  if (uniqueIds.length !== data.sizes.length) {
    throw new CatalogServiceError(
      "No se puede repetir un tamaño para el mismo producto.",
      422,
    );
  }

  const existingSizes = await findSizesByIds(uniqueIds);

  if (existingSizes.length !== uniqueIds.length) {
    throw new CatalogServiceError(
      "Uno o más tamaños seleccionados no existen.",
      422,
    );
  }
};

const addProduct = async (data: ProductInput) => {
  if (
    (await containsForbiddenText(data.name)) ||
    (data.description && (await containsForbiddenText(data.description)))
  ) {
    throw new CatalogServiceError(
      "El nombre o la descripción contiene una palabra no permitida.",
      422,
    );
  }
  await validateProductReferences(data, null);
  return createProduct(data);
};

const editProduct = async (id: number, data: ProductInput) => {
  const existingProduct = await findProductById(id);
  if (!existingProduct) {
    throw new CatalogServiceError("El producto no existe.", 404);
  }
  if (
    (await containsForbiddenText(data.name)) ||
    (data.description && (await containsForbiddenText(data.description)))
  ) {
    throw new CatalogServiceError(
      "El nombre o la descripción contiene una palabra no permitida.",
      422,
    );
  }

  await validateProductReferences(
    data,
    existingProduct.imagen,
    existingProduct.id_categoria,
  );
  await updateProduct(id, data);
};

export {
  CatalogServiceError,
  addCategory,
  addProduct,
  addSize,
  editCategory,
  editProduct,
  getCategories,
  getProducts,
  getSizes,
};
