import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/database/prisma";
import type {
  GuestOrderInput,
  OrderPriority,
  OrderStatus,
} from "@/validators/order-validator";

const DEFAULT_PREPARATION_MINUTES = 15;
const PREPARATION_SETTING_KEY = "order_preparation_minutes";
const QUEUE_STATUSES = ["RECIBIDO", "EN_PREPARACION"] as const;
const ACTIVE_STATUSES = [
  "PENDIENTE_CONFIRMACION",
  ...QUEUE_STATUSES,
  "LISTO",
  "EN_CAMINO",
] as const;

const listPublicProducts = () =>
  prisma.productos.findMany({
    where: { disponible: true, categorias: { activo: true } },
    orderBy: [{ categorias: { nombre: "asc" } }, { nombre: "asc" }],
    select: {
      id_producto: true,
      id_categoria: true,
      nombre: true,
      descripcion: true,
      precio: true,
      imagen: true,
      categorias: { select: { nombre: true } },
      producto_tamanos: {
        orderBy: { tamanos: { nombre: "asc" } },
        select: {
          id_tamano: true,
          precio: true,
          tamanos: { select: { nombre: true } },
        },
      },
    },
  });

const saveOrderStatusHistory = (
  orderId: number,
  userId: number,
  previousStatus: string,
  nextStatus: string,
) =>
  prisma.historial_pedidos.create({
    data: {
      id_pedido: orderId,
      id_usuario: userId,
      estado_anterior: previousStatus,
      estado_nuevo: nextStatus,
    },
  });

const transitionOrderStatus = async (
  orderId: number,
  expectedStatusId: number,
  nextStatusId: number,
  userId: number,
  data: {
    preparationStartedAt?: Date;
    readyAt?: Date;
  },
  previousStatus: string,
  nextStatus: string,
) =>
  prisma.$transaction(async (transaction) => {
    const result = await transaction.pedidos.updateMany({
      where: { id_pedido: orderId, id_estado: expectedStatusId },
      data: {
        id_estado: nextStatusId,
        ...(data.preparationStartedAt
          ? { fecha_inicio_preparacion: data.preparationStartedAt }
          : {}),
        ...(data.readyAt ? { fecha_listo: data.readyAt } : {}),
      },
    });
    if (result.count !== 1) return false;
    await transaction.historial_pedidos.create({
      data: {
        id_pedido: orderId,
        id_usuario: userId,
        estado_anterior: previousStatus,
        estado_nuevo: nextStatus,
      },
    });
    return true;
  });

const listPaymentMethods = async () =>
  prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`
      SELECT pg_advisory_xact_lock(726003902)::text AS lock
    `;
    let existing = await transaction.metodos_pago.findMany({
      orderBy: { nombre: "asc" },
    });
    for (const name of ["Efectivo", "Tarjeta", "Transferencia"]) {
      if (!existing.some((method) => method.nombre === name)) {
        await transaction.metodos_pago.create({ data: { nombre: name } });
      }
    }
    existing = await transaction.metodos_pago.findMany({
      orderBy: { nombre: "asc" },
    });
    return existing;
  });

const registerOrderPayment = async (
  orderId: number,
  methodId: number,
  userId: number,
) =>
  prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`
      SELECT "id_pedido" FROM "pedidos"
      WHERE "id_pedido" = ${orderId}
      FOR UPDATE
    `;
    const order = await transaction.pedidos.findUnique({
      where: { id_pedido: orderId },
      select: {
        pagado_en: true,
        estados_pedido: { select: { nombre: true } },
      },
    });
    if (!order) return "ORDER_NOT_FOUND" as const;
    if (order.pagado_en) return "ORDER_ALREADY_PAID" as const;
    if (
      ["PENDIENTE_CONFIRMACION", "CANCELADO"].includes(
        order.estados_pedido.nombre,
      )
    ) {
      return "ORDER_NOT_PAYABLE" as const;
    }
    const method = await transaction.metodos_pago.findUnique({
      where: { id_metodo_pago: methodId },
      select: { id_metodo_pago: true },
    });
    if (!method) return "PAYMENT_METHOD_NOT_FOUND" as const;
    const updated = await transaction.pedidos.updateMany({
      where: { id_pedido: orderId, pagado_en: null },
      data: {
        id_metodo_pago: methodId,
        pagado_en: new Date(),
        pagado_por: userId,
      },
    });
    return updated.count === 1
      ? ("OK" as const)
      : ("ORDER_ALREADY_PAID" as const);
  });

const listPublicCategories = () =>
  prisma.categorias.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
    select: { id_categoria: true, nombre: true },
  });

const getPreparationMinutes = async (): Promise<number> => {
  const setting = await prisma.configuracion_sistema.findUnique({
    where: { clave: PREPARATION_SETTING_KEY },
    select: { valor: true },
  });
  if (!setting) return DEFAULT_PREPARATION_MINUTES;

  const minutes = Number(setting.valor);
  if (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > 240) {
    throw new Error("ORDER_PREPARATION_SETTING_INVALID");
  }
  return minutes;
};

const savePreparationMinutes = (minutes: number) =>
  prisma.configuracion_sistema.upsert({
    where: { clave: PREPARATION_SETTING_KEY },
    create: { clave: PREPARATION_SETTING_KEY, valor: String(minutes) },
    update: { valor: String(minutes) },
    select: { valor: true },
  });

const createGuestOrder = (
  data: GuestOrderInput,
  trackingTokenHash: string,
) =>
  prisma.$transaction(async (transaction) => {
    const paymentMethod = await transaction.metodos_pago.findUnique({
      where: { id_metodo_pago: data.paymentMethodId },
      select: { id_metodo_pago: true },
    });
    if (!paymentMethod) throw new Error("ORDER_PAYMENT_METHOD_INVALID");

    const productIds = [...new Set(data.items.map((item) => item.productId))];
    const products = await transaction.productos.findMany({
      where: {
        id_producto: { in: productIds },
        disponible: true,
        categorias: { activo: true },
      },
      include: { producto_tamanos: true },
    });

    if (products.length !== productIds.length) {
      throw new Error("ORDER_PRODUCT_UNAVAILABLE");
    }

    const lines = data.items.map((item) => {
      const product = products.find(
        (entry) => entry.id_producto === item.productId,
      );
      if (!product) throw new Error("ORDER_PRODUCT_UNAVAILABLE");

      let unitPrice = product.precio;
      if (item.sizeId !== null) {
        const size = product.producto_tamanos.find(
          (entry) => entry.id_tamano === item.sizeId,
        );
        if (!size) throw new Error("ORDER_SIZE_UNAVAILABLE");
        unitPrice = size.precio;
      } else if (product.producto_tamanos.length > 0) {
        throw new Error("ORDER_SIZE_REQUIRED");
      }

      return {
        id_producto: product.id_producto,
        id_tamano: item.sizeId,
        cantidad: item.quantity,
        precio_unitario: unitPrice,
      };
    });

    const total = lines.reduce(
      (sum, line) =>
        sum.add(new Prisma.Decimal(line.precio_unitario).mul(line.cantidad)),
      new Prisma.Decimal(0),
    );
    if (total.greaterThan("99999999.99")) {
      throw new Error("ORDER_TOTAL_EXCEEDED");
    }
    const customer = await transaction.clientes.upsert({
      where: { telefono: data.phone },
      create: {
        nombre: data.customerName,
        telefono: data.phone,
        direccion: data.deliveryAddress,
      },
      update: {
        nombre: data.customerName,
        ...(data.deliveryAddress
          ? { direccion: data.deliveryAddress }
          : {}),
      },
      select: { id_cliente: true },
    });
    const receivedState = await transaction.estados_pedido.upsert({
      where: { nombre: "PENDIENTE_CONFIRMACION" },
      create: {
        nombre: "PENDIENTE_CONFIRMACION",
        descripcion: "Pendiente de confirmación por Caja",
      },
      update: {},
      select: { id_estado: true },
    });

    const order = await transaction.pedidos.create({
      data: {
        id_cliente: customer.id_cliente,
        tipo_entrega:
          data.deliveryType === "DOMICILIO" ? "Domicilio" : "Llevar",
        direccion_entrega: data.deliveryAddress,
        total,
        id_estado: receivedState.id_estado,
        id_metodo_pago_previsto: paymentMethod.id_metodo_pago,
        prioridad: "NORMAL",
        token_seguimiento_hash: trackingTokenHash,
        detalle_pedido: { create: lines },
      },
      select: { id_pedido: true, fecha: true, total: true },
    });

    return order;
  });

const findOrderByTrackingHash = (trackingTokenHash: string) =>
  prisma.pedidos.findUnique({
    where: { token_seguimiento_hash: trackingTokenHash },
    select: {
      id_pedido: true,
      fecha: true,
      tipo_entrega: true,
      total: true,
      pagado_en: true,
      metodos_pago: { select: { nombre: true } },
      fecha_inicio_preparacion: true,
      estados_pedido: { select: { nombre: true } },
      metodo_pago_previsto: { select: { nombre: true } },
      comprobante_pago: {
        select: { nombre_archivo: true, tipo_contenido: true, creado_en: true },
      },
      detalle_pedido: {
        select: {
          cantidad: true,
          precio_unitario: true,
          productos: { select: { nombre: true } },
          tamanos: { select: { nombre: true } },
        },
      },
    },
  });

const findQueueOrders = () =>
  prisma.pedidos.findMany({
    where: { estados_pedido: { nombre: { in: [...QUEUE_STATUSES] } } },
    orderBy: [{ fecha: "asc" }, { id_pedido: "asc" }],
    select: {
      id_pedido: true,
      fecha: true,
      id_metodo_pago_previsto: true,
      fecha_inicio_preparacion: true,
      prioridad: true,
      pagado_en: true,
      confirmado_en: true,
      estados_pedido: { select: { nombre: true } },
    },
  });

const listActiveOrders = () =>
  prisma.pedidos.findMany({
    where: { estados_pedido: { nombre: { in: [...ACTIVE_STATUSES] } } },
    orderBy: [{ fecha: "asc" }, { id_pedido: "asc" }],
    include: {
      clientes: {
        select: { nombre: true, telefono: true },
      },
      metodos_pago: { select: { nombre: true } },
      metodo_pago_previsto: { select: { nombre: true } },
      comprobante_pago: {
        select: { nombre_archivo: true, tipo_contenido: true, creado_en: true },
      },
      estados_pedido: { select: { nombre: true } },
      detalle_pedido: {
        include: {
          productos: { select: { nombre: true } },
          tamanos: { select: { nombre: true } },
        },
      },
    },
  });

const findOrderForUpdate = (id: number) =>
  prisma.pedidos.findUnique({
    where: { id_pedido: id },
    select: {
      id_pedido: true,
      tipo_entrega: true,
      prioridad: true,
      id_estado: true,
      pagado_en: true,
      fecha_inicio_preparacion: true,
      estados_pedido: { select: { nombre: true } },
    },
  });

const confirmOrderAndDeductInventory = async (
  orderId: number,
  userId: number,
) =>
  prisma.$transaction(async (transaction) => {
    const pendingState = await transaction.estados_pedido.upsert({
      where: { nombre: "PENDIENTE_CONFIRMACION" },
      create: {
        nombre: "PENDIENTE_CONFIRMACION",
        descripcion: "Pendiente de confirmación por Caja",
      },
      update: {},
      select: { id_estado: true },
    });
    const receivedState = await transaction.estados_pedido.upsert({
      where: { nombre: "RECIBIDO" },
      create: { nombre: "RECIBIDO", descripcion: "Pedido recibido por Caja" },
      update: {},
      select: { id_estado: true },
    });
    const order = await transaction.pedidos.findUnique({
      where: { id_pedido: orderId },
      select: {
        id_estado: true,
        estados_pedido: { select: { nombre: true } },
        detalle_pedido: {
          select: {
            id_producto: true,
            id_tamano: true,
            cantidad: true,
            productos: {
              select: {
                disponible: true,
                categorias: { select: { activo: true } },
              },
            },
          },
        },
      },
    });
    if (!order || order.id_estado !== pendingState.id_estado) {
      throw new Error("ORDER_NOT_PENDING");
    }

    const requiredByIngredient = new Map<number, Prisma.Decimal>();
    for (const item of order.detalle_pedido) {
      if (!item.productos.disponible || !item.productos.categorias.activo) {
        throw new Error("ORDER_PRODUCT_UNAVAILABLE");
      }
      const recipeRows = await transaction.recetas.findMany({
        where: {
          id_producto: item.id_producto,
          ...(item.id_tamano === null
            ? { id_tamano: null }
            : { OR: [{ id_tamano: item.id_tamano }, { id_tamano: null }] }),
        },
        include: {
          ingredientes: { select: { bloqueado: true } },
        },
      });
      const variantRows =
        item.id_tamano === null
          ? recipeRows
          : recipeRows.filter((recipe) => recipe.id_tamano === item.id_tamano);
      const applicableRows =
        variantRows.length > 0
          ? variantRows
          : recipeRows.filter((recipe) => recipe.id_tamano === null);
      if (applicableRows.length === 0) {
        throw new Error("ORDER_RECIPE_MISSING");
      }

      for (const recipe of applicableRows) {
        if (recipe.ingredientes.bloqueado) {
          throw new Error("ORDER_INGREDIENT_BLOCKED");
        }
        const required = recipe.cantidad_requerida.mul(item.cantidad);
        requiredByIngredient.set(
          recipe.id_ingrediente,
          (requiredByIngredient.get(recipe.id_ingrediente) ??
            new Prisma.Decimal(0)).add(required),
        );
      }
    }

    for (const [ingredientId, required] of requiredByIngredient) {
      const updated = await transaction.$queryRaw<
        { stock_actual: Prisma.Decimal }[]
      >`UPDATE "ingredientes"
        SET "stock_actual" = "stock_actual" - ${required}
        WHERE "id_ingrediente" = ${ingredientId}
          AND "bloqueado" = false
          AND "stock_actual" > "stock_minimo"
          AND "stock_actual" >= ${required}
        RETURNING "stock_actual"`;
      const current = updated[0];
      if (!current) throw new Error(`ORDER_STOCK_INSUFFICIENT:${ingredientId}`);
      await transaction.movimientos_inventario.create({
        data: {
          id_ingrediente: ingredientId,
          id_pedido: orderId,
          id_usuario: userId,
          tipo: "DESCUENTO_PEDIDO",
          cantidad: required,
          stock_anterior: current.stock_actual.add(required),
          stock_nuevo: current.stock_actual,
          motivo: "Descuento al confirmar el pedido.",
        },
      });
    }

    const transition = await transaction.pedidos.updateMany({
      where: {
        id_pedido: orderId,
        id_estado: pendingState.id_estado,
      },
      data: {
        id_estado: receivedState.id_estado,
        confirmado_en: new Date(),
        confirmado_por: userId,
      },
    });
    if (transition.count !== 1) throw new Error("ORDER_NOT_PENDING");
    await transaction.historial_pedidos.create({
      data: {
        id_pedido: orderId,
        id_usuario: userId,
        estado_anterior: "PENDIENTE_CONFIRMACION",
        estado_nuevo: "RECIBIDO",
      },
    });
    return { confirmed: true };
  });

const cancelOrderAndRestoreInventory = async (
  orderId: number,
  userId: number,
) =>
  prisma.$transaction(async (transaction) => {
    const order = await transaction.pedidos.findUnique({
      where: { id_pedido: orderId },
      select: {
        id_estado: true,
        fecha_inicio_preparacion: true,
        estados_pedido: { select: { nombre: true } },
      },
    });
    if (!order) throw new Error("ORDER_NOT_FOUND");
    if (["ENTREGADO", "CANCELADO"].includes(order.estados_pedido.nombre)) {
      throw new Error("ORDER_TERMINAL");
    }
    const cancelledState = await transaction.estados_pedido.upsert({
      where: { nombre: "CANCELADO" },
      create: { nombre: "CANCELADO", descripcion: "Pedido cancelado" },
      update: {},
      select: { id_estado: true },
    });
    const transition = await transaction.pedidos.updateMany({
      where: {
        id_pedido: orderId,
        id_estado: order.id_estado,
      },
      data: { id_estado: cancelledState.id_estado },
    });
    if (transition.count !== 1) throw new Error("ORDER_STATE_CHANGED");

    const inventoryRestored = !order.fecha_inicio_preparacion;
    if (inventoryRestored) {
      const deductions = await transaction.movimientos_inventario.findMany({
        where: { id_pedido: orderId, tipo: "DESCUENTO_PEDIDO" },
        select: { id_ingrediente: true, cantidad: true },
      });
      for (const deduction of deductions) {
        const updated = await transaction.ingredientes.update({
          where: { id_ingrediente: deduction.id_ingrediente },
          data: { stock_actual: { increment: deduction.cantidad } },
          select: { stock_actual: true },
        });
        await transaction.movimientos_inventario.create({
          data: {
            id_ingrediente: deduction.id_ingrediente,
            id_pedido: orderId,
            id_usuario: userId,
            tipo: "REPOSICION_CANCELACION",
            cantidad: deduction.cantidad,
            stock_anterior: updated.stock_actual.sub(deduction.cantidad),
            stock_nuevo: updated.stock_actual,
            motivo: "Reposición automática por cancelación antes de preparar.",
          },
        });
      }
    }
    await transaction.historial_pedidos.create({
      data: {
        id_pedido: orderId,
        id_usuario: userId,
        estado_anterior: order.estados_pedido.nombre,
        estado_nuevo: "CANCELADO",
      },
    });
    return { cancelled: true, inventoryRestored };
  });

const updateOrder = (
  id: number,
  data: {
    priority?: OrderPriority;
    statusId?: number;
    preparationStartedAt?: Date;
    readyAt?: Date;
  },
) =>
  prisma.pedidos.update({
    where: { id_pedido: id },
    data: {
      ...(data.priority ? { prioridad: data.priority } : {}),
      ...(data.statusId ? { id_estado: data.statusId } : {}),
      ...(data.preparationStartedAt
        ? { fecha_inicio_preparacion: data.preparationStartedAt }
        : {}),
      ...(data.readyAt ? { fecha_listo: data.readyAt } : {}),
    },
  });

const findStatus = (status: OrderStatus) =>
  prisma.estados_pedido.upsert({
    where: { nombre: status },
    create: {
      nombre: status,
      descripcion: status.replaceAll("_", " ").toLocaleLowerCase("es-MX"),
    },
    update: {},
    select: { id_estado: true },
  });

export {
  DEFAULT_PREPARATION_MINUTES,
  cancelOrderAndRestoreInventory,
  confirmOrderAndDeductInventory,
  createGuestOrder,
  findOrderByTrackingHash,
  findOrderForUpdate,
  findQueueOrders,
  findStatus,
  getPreparationMinutes,
  listPaymentMethods,
  listActiveOrders,
  listPublicCategories,
  listPublicProducts,
  savePreparationMinutes,
  saveOrderStatusHistory,
  registerOrderPayment,
  transitionOrderStatus,
  updateOrder,
};
