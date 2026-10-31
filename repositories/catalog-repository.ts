import { prisma } from "@/lib/database/prisma";
import type { CategoryInput, ProductInput, SizeInput } from "@/validators/catalog-validator";

const listCategories = (activeOnly: boolean) =>
  prisma.categorias.findMany({
    where: activeOnly ? { activo: true } : undefined,
    orderBy: { nombre: "asc" },
    include: {
      _count: { select: { productos: true } },
    },
  });

const findCategoryById = (id: number) =>
  prisma.categorias.findUnique({ where: { id_categoria: id } });

const createCategory = (data: CategoryInput) =>
  prisma.categorias.create({
    data: {
      nombre: data.name,
      descripcion: data.description,
      activo: data.active,
    },
  });

const updateCategory = (id: number, data: CategoryInput) =>
  prisma.categorias.update({
    where: { id_categoria: id },
    data: {
      nombre: data.name,
      descripcion: data.description,
      activo: data.active,
    },
  });

const listSizes = () =>
  prisma.tamanos.findMany({ orderBy: { nombre: "asc" } });

const findSizeByName = (name: string) =>
  prisma.tamanos.findFirst({
    where: { nombre: { equals: name, mode: "insensitive" } },
  });

const createSize = (data: SizeInput) =>
  prisma.tamanos.create({ data: { nombre: data.name } });

const listProducts = (availableOnly: boolean) =>
  prisma.productos.findMany({
    where: availableOnly
      ? { categorias: { activo: true } }
      : undefined,
    orderBy: [{ categorias: { nombre: "asc" } }, { nombre: "asc" }],
    include: {
      categorias: true,
      producto_tamanos: {
        include: { tamanos: true },
        orderBy: { tamanos: { nombre: "asc" } },
      },
    },
  });

const findCategoryIsActive = (id: number) =>
  prisma.categorias.findFirst({
    where: { id_categoria: id, activo: true },
    select: { id_categoria: true },
  });

const findSizesByIds = (ids: number[]) =>
  prisma.tamanos.findMany({
    where: { id_tamano: { in: ids } },
    select: { id_tamano: true },
  });

const createProduct = (data: ProductInput) =>
  prisma.$transaction(async (transaction) => {
    const product = await transaction.productos.create({
      data: {
        id_categoria: data.categoryId,
        tipo_producto: data.productType,
        nombre: data.name,
        descripcion: data.description,
        precio: data.sizes.length
          ? Math.min(...data.sizes.map((size) => size.price))
          : data.basePrice,
        imagen: data.image,
        disponible: data.available,
      },
    });

    if (data.sizes.length) {
      await transaction.producto_tamanos.createMany({
        data: data.sizes.map((size) => ({
          id_producto: product.id_producto,
          id_tamano: size.sizeId,
          precio: size.price,
        })),
      });
    }

    return product.id_producto;
  });

const updateProduct = (id: number, data: ProductInput) =>
  prisma.$transaction(async (transaction) => {
    await transaction.productos.update({
      where: { id_producto: id },
      data: {
        id_categoria: data.categoryId,
        tipo_producto: data.productType,
        nombre: data.name,
        descripcion: data.description,
        precio: data.sizes.length
          ? Math.min(...data.sizes.map((size) => size.price))
          : data.basePrice,
        imagen: data.image,
        disponible: data.available,
      },
    });

    await transaction.producto_tamanos.deleteMany({
      where: { id_producto: id },
    });

    if (data.sizes.length) {
      await transaction.producto_tamanos.createMany({
        data: data.sizes.map((size) => ({
          id_producto: id,
          id_tamano: size.sizeId,
          precio: size.price,
        })),
      });
    }
  });

const findProductById = (id: number) =>
  prisma.productos.findUnique({
    where: { id_producto: id },
    select: {
      id_producto: true,
      id_categoria: true,
      tipo_producto: true,
      imagen: true,
    },
  });

const deleteProductById = (id: number) =>
  prisma.productos.delete({
    where: { id_producto: id },
    select: { id_producto: true },
  });

const countProductsUsingImage = (image: string) =>
  prisma.productos.count({ where: { imagen: image } });

export {
  countProductsUsingImage,
  createCategory,
  createProduct,
  createSize,
  deleteProductById,
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
};
