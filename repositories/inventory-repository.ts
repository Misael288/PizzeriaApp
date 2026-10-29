import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/database/prisma";
import type {
  IngredientInput,
  RecipeInput,
} from "@/validators/inventory-validator";

const listIngredients = () =>
  prisma.ingredientes.findMany({
    orderBy: { nombre: "asc" },
    select: {
      id_ingrediente: true,
      nombre: true,
      descripcion: true,
      unidad_medida: true,
      precio_extra: true,
      cantidad_extra: true,
      stock_actual: true,
      stock_minimo: true,
      bloqueado: true,
      activo: true,
      tipo: true,
    },
  });

const listRecentInventoryMovements = () =>
  prisma.movimientos_inventario.findMany({
    orderBy: [{ creado_en: "desc" }, { id_movimiento: "desc" }],
    take: 100,
    select: {
      id_movimiento: true,
      tipo: true,
      cantidad: true,
      stock_anterior: true,
      stock_nuevo: true,
      motivo: true,
      creado_en: true,
      ingredientes: {
        select: { nombre: true, unidad_medida: true },
      },
      usuarios: { select: { name: true } },
      pedidos: { select: { id_pedido: true } },
    },
  });

const listInventoryCatalog = () =>
  prisma.productos.findMany({
    orderBy: [{ categorias: { nombre: "asc" } }, { nombre: "asc" }],
    select: {
      id_producto: true,
      nombre: true,
      tipo_producto: true,
      disponible: true,
      categorias: { select: { nombre: true } },
      producto_tamanos: {
        orderBy: { tamanos: { nombre: "asc" } },
        select: {
          id_tamano: true,
          tamanos: { select: { nombre: true } },
        },
      },
      recetas: {
        select: {
          id_tamano: true,
          id_ingrediente: true,
          cantidad_requerida: true,
          ingredientes: {
            select: {
              id_ingrediente: true,
              nombre: true,
              unidad_medida: true,
              stock_actual: true,
              stock_minimo: true,
              bloqueado: true,
              activo: true,
              tipo: true,
            },
          },
        },
      },
    },
  });

const listProductsForRecipe = () =>
  prisma.productos.findMany({
    where: { tipo_producto: "PIZZA" },
    orderBy: { nombre: "asc" },
    select: {
      id_producto: true,
      nombre: true,
      producto_tamanos: {
        orderBy: { tamanos: { nombre: "asc" } },
        select: {
          id_tamano: true,
          tamanos: { select: { nombre: true } },
        },
      },
    },
  });

const listRecipeComponents = () =>
  prisma.recetas.findMany({
    orderBy: [
      { productos: { nombre: "asc" } },
      { id_producto: "asc" },
      { id_tamano: "asc" },
    ],
    select: {
      id_producto: true,
      id_tamano: true,
      id_ingrediente: true,
      cantidad_requerida: true,
    },
  });

const createIngredient = (data: IngredientInput, userId: number) =>
  prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(726003904)::text AS lock`;
    const existing = await transaction.ingredientes.findMany({
      select: { nombre: true },
    });
    const normalizedName = normalizeIngredientName(data.name);
    if (existing.some((ingredient) => normalizeIngredientName(ingredient.nombre) === normalizedName)) {
      throw new Error("INGREDIENT_NAME_DUPLICATE");
    }
    const ingredient = await transaction.ingredientes.create({
      data: {
        nombre: data.name,
        descripcion: data.description,
        unidad_medida: data.unit,
        precio_extra: data.extraPrice,
        cantidad_extra: data.extraQuantity,
        stock_actual: data.stock,
        stock_minimo: data.minimumStock,
        bloqueado: false,
        activo: true,
        tipo: data.type,
      },
      select: {
        id_ingrediente: true,
        nombre: true,
        descripcion: true,
        unidad_medida: true,
        precio_extra: true,
        cantidad_extra: true,
        stock_actual: true,
        stock_minimo: true,
      },
    });

    if (data.stock > 0) {
      await transaction.movimientos_inventario.create({
        data: {
          id_ingrediente: ingredient.id_ingrediente,
          id_usuario: userId,
          tipo: "STOCK_INICIAL",
          cantidad: data.stock,
          stock_anterior: 0,
          stock_nuevo: data.stock,
          motivo: "Existencia inicial registrada al crear el ingrediente.",
        },
      });
    }
    return ingredient;
  });

const updateIngredient = async (
  id: number,
  data: IngredientInput,
  userId: number,
) =>
  prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(726003904)::text AS lock`;
    const current = await transaction.ingredientes.findUnique({
      where: { id_ingrediente: id },
      select: { stock_actual: true, nombre: true, unidad_medida: true },
    });
    if (!current) return null;
    if (
      data.type === "CONSUMIBLE" ||
      (data.unit !== current.unidad_medida)
    ) {
      const recipeCount = await transaction.recetas.count({
        where: { id_ingrediente: id },
      });
      if (recipeCount > 0) {
        throw new Error(
          data.type === "CONSUMIBLE"
            ? "INGREDIENT_USED_IN_RECIPE"
            : "INGREDIENT_UNIT_IN_USE",
        );
      }
    }
    const existing = await transaction.ingredientes.findMany({
      where: { id_ingrediente: { not: id } },
      select: { nombre: true },
    });
    const normalizedName = normalizeIngredientName(data.name);
    if (existing.some((ingredient) => normalizeIngredientName(ingredient.nombre) === normalizedName)) {
      throw new Error("INGREDIENT_NAME_DUPLICATE");
    }

    const nextStock = new Prisma.Decimal(data.stock);
    const difference = nextStock.minus(current.stock_actual);
    const updated = await transaction.ingredientes.update({
      where: { id_ingrediente: id },
      data: {
        nombre: data.name,
        descripcion: data.description,
        unidad_medida: data.unit,
        precio_extra: data.extraPrice,
        cantidad_extra: data.extraQuantity,
        tipo: data.type,
        stock_actual: nextStock,
        stock_minimo: data.minimumStock,
      },
      select: {
        id_ingrediente: true,
        nombre: true,
        descripcion: true,
        unidad_medida: true,
        precio_extra: true,
        cantidad_extra: true,
        stock_actual: true,
        stock_minimo: true,
      },
    });

    if (!difference.isZero()) {
      await transaction.movimientos_inventario.create({
        data: {
          id_ingrediente: id,
          id_usuario: userId,
          tipo: difference.greaterThan(0) ? "ENTRADA" : "AJUSTE",
          cantidad: difference.abs(),
          stock_anterior: current.stock_actual,
          stock_nuevo: nextStock,
          motivo: difference.greaterThan(0)
            ? "Reabastecimiento registrado por ADMIN."
            : "Ajuste de existencia registrado por ADMIN.",
        },
      });
    }
    return updated;
  });

const normalizeIngredientName = (name: string): string =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, "")
    .toLocaleLowerCase("es-MX");

const updateIngredientActive = (id: number, active: boolean) =>
  prisma.ingredientes.updateMany({
    where: { id_ingrediente: id },
    data: { activo: active },
  });

const deleteUnusedIngredient = async (id: number) =>
  prisma.$transaction(async (transaction) => {
    const ingredient = await transaction.ingredientes.findUnique({
      where: { id_ingrediente: id },
      select: { id_ingrediente: true },
    });
    if (!ingredient) return "NOT_FOUND" as const;
    const [recipes, movements, orderIngredients, productIngredients] =
      await Promise.all([
        transaction.recetas.count({ where: { id_ingrediente: id } }),
        transaction.movimientos_inventario.count({
          where: { id_ingrediente: id },
        }),
        transaction.detalle_pedido_ingredientes.count({
          where: { id_ingrediente: id },
        }),
        transaction.producto_ingredientes.count({
          where: { id_ingrediente: id },
        }),
      ]);
    if (recipes + movements + orderIngredients + productIngredients > 0) {
      return "IN_USE" as const;
    }
    await transaction.ingredientes.delete({ where: { id_ingrediente: id } });
    return "DELETED" as const;
  });

const listAvailableExtraIngredients = () =>
  prisma.ingredientes.findMany({
    where: {
      tipo: "INGREDIENTE",
      activo: true,
      bloqueado: false,
      stock_actual: { gt: 0 },
    },
    orderBy: { nombre: "asc" },
    select: {
      id_ingrediente: true,
      nombre: true,
      descripcion: true,
      precio_extra: true,
      cantidad_extra: true,
      stock_actual: true,
      stock_minimo: true,
      unidad_medida: true,
    },
  });

const replaceRecipe = (productId: number, data: RecipeInput) =>
  prisma.$transaction(async (transaction) => {
    const product = await transaction.productos.findUnique({
      where: { id_producto: productId },
      select: {
        id_producto: true,
        tipo_producto: true,
        producto_tamanos: { select: { id_tamano: true } },
      },
    });
    if (!product) return "PRODUCT_NOT_FOUND" as const;
    if (product.tipo_producto !== "PIZZA") return "PRODUCT_NOT_FOUND" as const;
    if (
      data.sizeId !== null &&
      !product.producto_tamanos.some((size) => size.id_tamano === data.sizeId)
    ) {
      return "SIZE_NOT_FOUND" as const;
    }
    const ingredientIds = data.ingredients.map((item) => item.ingredientId);
    const ingredients = await transaction.ingredientes.findMany({
      where: {
        id_ingrediente: { in: ingredientIds },
        tipo: "INGREDIENTE",
        activo: true,
      },
      select: { id_ingrediente: true },
    });
    if (ingredients.length !== ingredientIds.length) {
      return "INGREDIENT_NOT_FOUND" as const;
    }

    await transaction.recetas.deleteMany({
      where: { id_producto: productId, id_tamano: data.sizeId },
    });
    if (data.ingredients.length > 0) {
      await transaction.recetas.createMany({
        data: data.ingredients.map((item) => ({
          id_producto: productId,
          id_tamano: data.sizeId,
          id_ingrediente: item.ingredientId,
          cantidad_requerida: item.quantity,
        })),
      });
    }
    return "OK" as const;
  });

const updateProductAvailability = (id: number, available: boolean) =>
  prisma.productos.update({
    where: { id_producto: id },
    data: { disponible: available },
    select: { id_producto: true, disponible: true },
  });

const getShowSoldOutSetting = async (): Promise<boolean> => {
  const row = await prisma.configuracion_sistema.findUnique({
    where: { clave: "show_sold_out_products" },
    select: { valor: true },
  });
  return row?.valor === "true";
};

const saveShowSoldOutSetting = (show: boolean) =>
  prisma.configuracion_sistema.upsert({
    where: { clave: "show_sold_out_products" },
    create: { clave: "show_sold_out_products", valor: String(show) },
    update: { valor: String(show) },
  });

export {
  createIngredient,
  deleteUnusedIngredient,
  getShowSoldOutSetting,
  listIngredients,
  listAvailableExtraIngredients,
  listInventoryCatalog,
  listRecentInventoryMovements,
  listProductsForRecipe,
  listRecipeComponents,
  replaceRecipe,
  saveShowSoldOutSetting,
  updateIngredient,
  updateIngredientActive,
  updateProductAvailability,
};
