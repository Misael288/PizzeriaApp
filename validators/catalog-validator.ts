type CategoryInput = {
  name: string;
  description: string | null;
  active: boolean;
};

type ProductSizeInput = {
  sizeId: number;
  price: number;
};

type ProductInput = {
  categoryId: number;
  name: string;
  description: string | null;
  image: string | null;
  available: boolean;
  basePrice: number;
  sizes: ProductSizeInput[];
};

type SizeInput = {
  name: string;
};

type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; message: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseText = (
  value: unknown,
  field: string,
  maxLength: number,
  required: boolean,
): ValidationResult<string | null> => {
  if (value === null && !required) {
    return { success: true, data: null };
  }

  if (typeof value !== "string") {
    return {
      success: false,
      message: `${field} debe ser texto${required ? "" : " o nulo"}.`,
    };
  }

  const trimmed = value.trim();

  if (required && trimmed.length === 0) {
    return { success: false, message: `${field} es obligatorio.` };
  }

  if (trimmed.length > maxLength) {
    return {
      success: false,
      message: `${field} no puede superar ${maxLength} caracteres.`,
    };
  }

  return { success: true, data: trimmed || null };
};

const parsePositiveInteger = (
  value: unknown,
  field: string,
): ValidationResult<number> => {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value <= 0
  ) {
    return { success: false, message: `${field} debe ser un entero positivo.` };
  }

  return { success: true, data: value };
};

const parsePrice = (
  value: unknown,
  field: string,
): ValidationResult<number> => {
  const scaledPrice =
    typeof value === "number" ? Math.round(value * 100) : Number.NaN;

  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 99_999_999.99 ||
    Math.abs(value * 100 - scaledPrice) > 0.0000001
  ) {
    return {
      success: false,
      message: `${field} debe ser un precio no negativo con hasta dos decimales.`,
    };
  }

  return { success: true, data: value };
};

const parseCategoryInput = (value: unknown): ValidationResult<CategoryInput> => {
  if (!isRecord(value)) {
    return { success: false, message: "La categoría debe ser un objeto." };
  }

  const name = parseText(value.name, "El nombre", 100, true);
  if (!name.success) return { success: false, message: name.message };
  if (!name.data) {
    return { success: false, message: "El nombre es obligatorio." };
  }

  const description = parseText(
    value.description ?? null,
    "La descripción",
    255,
    false,
  );
  if (!description.success) {
    return { success: false, message: description.message };
  }

  if (typeof value.active !== "boolean") {
    return { success: false, message: "El estado activo debe ser booleano." };
  }

  return {
    success: true,
    data: {
      name: name.data,
      description: description.data,
      active: value.active,
    },
  };
};

const parseSizeInput = (value: unknown): ValidationResult<SizeInput> => {
  if (!isRecord(value)) {
    return { success: false, message: "El tamaño debe ser un objeto." };
  }

  const name = parseText(value.name, "El nombre del tamaño", 50, true);
  if (!name.success) return { success: false, message: name.message };
  if (!name.data) {
    return { success: false, message: "El nombre del tamaño es obligatorio." };
  }

  return { success: true, data: { name: name.data } };
};

const parseProductInput = (value: unknown): ValidationResult<ProductInput> => {
  if (!isRecord(value)) {
    return { success: false, message: "El producto debe ser un objeto." };
  }

  const categoryId = parsePositiveInteger(value.categoryId, "La categoría");
  if (!categoryId.success) {
    return { success: false, message: categoryId.message };
  }

  const name = parseText(value.name, "El nombre", 100, true);
  if (!name.success) return { success: false, message: name.message };
  if (!name.data) {
    return { success: false, message: "El nombre es obligatorio." };
  }

  const description = parseText(
    value.description ?? null,
    "La descripción",
    255,
    false,
  );
  if (!description.success) {
    return { success: false, message: description.message };
  }

  const image = parseText(value.image ?? null, "La imagen", 255, false);
  if (!image.success) return { success: false, message: image.message };

  const isUploadedImage =
    image.data !== null &&
    /^\/uploads\/products\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i.test(
      image.data,
    );
  const isLegacyImageUrl =
    image.data !== null && /^https?:\/\/\S+$/i.test(image.data);

  if (image.data && !isUploadedImage && !isLegacyImageUrl) {
    return {
      success: false,
      message: "La imagen debe importarse desde el formulario del catálogo.",
    };
  }

  if (typeof value.available !== "boolean") {
    return { success: false, message: "La disponibilidad debe ser booleana." };
  }

  const basePrice = parsePrice(value.basePrice, "El precio base");
  if (!basePrice.success) {
    return { success: false, message: basePrice.message };
  }

  if (!Array.isArray(value.sizes)) {
    return {
      success: false,
      message: "Los tamaños deben enviarse como una lista.",
    };
  }

  const sizes: ProductSizeInput[] = [];
  const sizeIds = new Set<number>();

  for (const [index, entry] of value.sizes.entries()) {
    if (!isRecord(entry)) {
      return {
        success: false,
        message: `El tamaño ${index + 1} no tiene un formato válido.`,
      };
    }

    const sizeId = parsePositiveInteger(
      entry.sizeId,
      `El identificador del tamaño ${index + 1}`,
    );
    if (!sizeId.success) {
      return { success: false, message: sizeId.message };
    }

    if (sizeIds.has(sizeId.data)) {
      return {
        success: false,
        message: "No se puede repetir un tamaño para el mismo producto.",
      };
    }

    const price = parsePrice(entry.price, `El precio del tamaño ${index + 1}`);
    if (!price.success) {
      return { success: false, message: price.message };
    }

    sizeIds.add(sizeId.data);
    sizes.push({ sizeId: sizeId.data, price: price.data });
  }

  return {
    success: true,
    data: {
      categoryId: categoryId.data,
      name: name.data,
      description: description.data,
      image: image.data,
      available: value.available,
      basePrice: basePrice.data,
      sizes,
    },
  };
};

export {
  parseCategoryInput,
  parseProductInput,
  parseSizeInput,
};
export type { CategoryInput, ProductInput, SizeInput };
