import { Prisma } from "@prisma/client";

import {
  createGuestOrder,
  cancelOrderAndRestoreInventory,
  confirmOrderAndDeductInventory,
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
  registerOrderPayment,
  transitionOrderStatus,
  updateOrder,
} from "@/repositories/order-repository";
import { getInventoryOverview } from "@/services/inventory-service";
import { getAvailableExtraIngredients } from "@/services/inventory-service";
import { containsForbiddenText } from "@/services/profanity-service";
import {
  getAdminTransferSettings as getTransferSettings,
  isTransferConfigured,
} from "@/services/payment-settings-service";
import {
  createTrackingToken,
  hashTrackingToken,
  isValidTrackingToken,
} from "@/lib/orders/tracking-token";
import type {
  GuestOrderInput,
  OrderPriority,
  OrderStatus,
  OrderUpdateInput,
} from "@/validators/order-validator";

class OrderServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "OrderServiceError";
  }
}

const PRIORITY_ORDER: Record<OrderPriority, number> = {
  URGENTE: 0,
  ALTA: 1,
  NORMAL: 2,
};

const QUEUE_STATUS_NAMES = ["RECIBIDO", "EN_PREPARACION"] as const;
const PRIORITY_EDITABLE_STATUSES = [
  "PENDIENTE_CONFIRMACION",
  ...QUEUE_STATUS_NAMES,
] as const;

type QueueOrder = Awaited<ReturnType<typeof findQueueOrders>>[number];

const normalizeDeliveryType = (storedValue: string): string => {
  switch (storedValue) {
    case "Domicilio":
    case "DOMICILIO":
      return "DOMICILIO";
    case "Llevar":
    case "RECOGER":
      return "RECOGER";
    case "Local":
      return "LOCAL";
    default:
      return storedValue;
  }
};

const compareQueueOrders = (left: QueueOrder, right: QueueOrder): number => {
  const leftStatus = left.estados_pedido.nombre;
  const rightStatus = right.estados_pedido.nombre;
  if (leftStatus !== rightStatus) {
    if (leftStatus === "EN_PREPARACION") return -1;
    if (rightStatus === "EN_PREPARACION") return 1;
  }
  const leftPriority =
    left.prioridad in PRIORITY_ORDER
      ? PRIORITY_ORDER[left.prioridad as OrderPriority]
      : PRIORITY_ORDER.NORMAL;
  const rightPriority =
    right.prioridad in PRIORITY_ORDER
      ? PRIORITY_ORDER[right.prioridad as OrderPriority]
      : PRIORITY_ORDER.NORMAL;
  return (
    leftPriority - rightPriority ||
    left.fecha.getTime() - right.fecha.getTime() ||
    left.id_pedido - right.id_pedido
  );
};

const calculateEtaMinutes = (
  orderId: number,
  queue: QueueOrder[],
  preparationMinutes: number,
  now = Date.now(),
): number => {
  const orderedQueue = [...queue].sort(compareQueueOrders);
  const position = orderedQueue.findIndex(
    (order) => order.id_pedido === orderId,
  );
  if (position < 0) return 0;

  let remainingMinutes = 0;
  for (const order of orderedQueue.slice(0, position + 1)) {
    if (order.estados_pedido.nombre === "EN_PREPARACION") {
      const elapsedMinutes = order.fecha_inicio_preparacion
        ? Math.floor(
            (now - order.fecha_inicio_preparacion.getTime()) / 60_000,
          )
        : 0;
      remainingMinutes += Math.max(preparationMinutes - elapsedMinutes, 0);
    } else {
      remainingMinutes += preparationMinutes;
    }
  }

  return Math.max(0, Math.ceil(remainingMinutes));
};

const getEta = async (orderId: number): Promise<number> => {
  const [queue, preparationMinutes] = await Promise.all([
    findQueueOrders(),
    getPreparationMinutes(),
  ]);
  return calculateEtaMinutes(orderId, queue, preparationMinutes);
};

const getPublicMenu = async () => {
  const [categories, products, inventory, extraIngredients] = await Promise.all([
    listPublicCategories(),
    listPublicProducts(),
    getInventoryOverview(),
    getAvailableExtraIngredients(),
  ]);
  const availability = new Map(
    inventory.availability.map((item) => [item.productId, item]),
  );
  return {
    categories,
    extraIngredients,
    products: products
      .map((product) => {
        const productAvailability = availability.get(product.id_producto);
        const sizes = product.producto_tamanos.map((size) => ({
          ...size,
          precio: size.precio.toString(),
          disponible:
            productAvailability?.sizes.find(
              (entry) => entry.sizeId === size.id_tamano,
            )?.available ?? false,
        }));
        const disponible =
          productAvailability?.available ?? false;
        return {
          ...product,
          tipo_producto:
            product.tipo_producto === "REFRESCO"
              ? ("REFRESCO" as const)
              : ("PIZZA" as const),
          precio: product.precio.toString(),
          disponible,
          producto_tamanos: sizes,
        };
      })
      .filter((product) => product.disponible || inventory.showSoldOut),
  };
};

const addGuestOrder = async (input: GuestOrderInput) => {
  const trackingToken = createTrackingToken();
  try {
    if (
      (await containsForbiddenText(input.customerName)) ||
      (input.deliveryAddress &&
        (await containsForbiddenText(input.deliveryAddress)))
    ) {
      throw new OrderServiceError(
        "El nombre o la dirección contiene una palabra no permitida.",
        422,
      );
    }
    const methods = await listPaymentMethods();
    const selectedMethod = methods.find(
      (method) => method.id_metodo_pago === input.paymentMethodId,
    );
    if (!selectedMethod) {
      throw new OrderServiceError("El método de pago no es válido.", 422);
    }
    if (selectedMethod.nombre === "Transferencia") {
      const transfer = await getTransferSettings();
      if (!isTransferConfigured(transfer)) {
        throw new OrderServiceError(
          "La transferencia no está configurada. Selecciona otro método o inténtalo más tarde.",
          409,
        );
      }
    }
    const order = await createGuestOrder(
      input,
      hashTrackingToken(trackingToken),
    );
    return {
      trackingToken,
      total: order.total.toString(),
      etaMinutes: null,
      status: "PENDIENTE_CONFIRMACION",
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      const knownErrors: Record<string, [string, number]> = {
        ORDER_PRODUCT_UNAVAILABLE: [
          "Uno o más productos ya no están disponibles.",
          409,
        ],
        ORDER_PAYMENT_METHOD_INVALID: [
          "El método de pago seleccionado ya no está disponible.",
          409,
        ],
        ORDER_SIZE_UNAVAILABLE: [
          "El tamaño seleccionado no está disponible para ese producto.",
          422,
        ],
        ORDER_SIZE_REQUIRED: [
          "Selecciona un tamaño para cada producto que tenga presentaciones.",
          422,
        ],
        ORDER_EXTRA_UNAVAILABLE: [
          "Uno o más ingredientes extra ya no están disponibles.",
          409,
        ],
        ORDER_EXTRA_NOT_ALLOWED: [
          "Los ingredientes extra solo se pueden agregar a pizzas.",
          422,
        ],
        ORDER_PROFANITY_INVALID: [
          "El nombre o la dirección contiene una palabra no permitida.",
          422,
        ],
        ORDER_TOTAL_EXCEEDED: [
          "El total del pedido supera el máximo permitido.",
          422,
        ],
      };
      const stockError = error.message.startsWith(
        "ORDER_STOCK_INSUFFICIENT:",
      );
      const knownError: [string, number] | undefined = stockError
        ? [
            "No hay existencia suficiente o algún ingrediente está en su stock mínimo.",
            409,
          ]
        : knownErrors[error.message];
      if (knownError) {
        throw new OrderServiceError(knownError[0], knownError[1]);
      }
    }

    const prismaConstraintDetails =
      error instanceof Prisma.PrismaClientKnownRequestError
        ? [
            error.meta?.constraint,
            error.meta?.database_error,
          ]
            .filter((detail): detail is string => typeof detail === "string")
            .join(" ")
            .toLocaleLowerCase("es-MX")
        : "";
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2004" &&
      prismaConstraintDetails.includes("tipo_entrega")
    ) {
      throw new OrderServiceError(
        "La base de datos rechazó la modalidad de entrega. Verifica que el esquema y la aplicación estén actualizados.",
        422,
      );
    }

    throw error;
  }
};

const getGuestOrderTracking = async (token: string) => {
  if (!isValidTrackingToken(token)) {
    throw new OrderServiceError("El enlace de seguimiento no es válido.", 404);
  }

  const order = await findOrderByTrackingHash(hashTrackingToken(token));
  if (!order) {
    throw new OrderServiceError("No se encontró el pedido solicitado.", 404);
  }

  const isInPreparationQueue = QUEUE_STATUS_NAMES.includes(
    order.estados_pedido.nombre as (typeof QUEUE_STATUS_NAMES)[number],
  );
  const etaMinutes = isInPreparationQueue
    ? await getEta(order.id_pedido)
    : null;
  const transferSettings =
    order.metodo_pago_previsto?.nombre === "Transferencia"
      ? await getTransferSettings()
      : null;

  return {
    status: order.estados_pedido.nombre,
    deliveryType: normalizeDeliveryType(order.tipo_entrega),
    createdAt: order.fecha.toISOString(),
    total: order.total.toString(),
    paidAt: order.pagado_en?.toISOString() ?? null,
    paidMethod: order.metodos_pago?.nombre ?? null,
    etaMinutes,
    paymentMethod: order.metodo_pago_previsto?.nombre ?? null,
    transfer:
      transferSettings && isTransferConfigured(transferSettings)
        ? transferSettings
        : null,
    proofUploaded: order.comprobante_pago !== null,
    proofUploadedAt: order.comprobante_pago?.creado_en.toISOString() ?? null,
    items: order.detalle_pedido.map((item) => ({
      name: item.productos.nombre,
      size: item.tamanos?.nombre ?? null,
      quantity: item.cantidad,
      unitPrice: item.precio_unitario.toString(),
      extras: item.detalle_pedido_ingredientes.map((extra) => ({
        name: extra.nombre_ingrediente ?? extra.ingredientes.nombre,
        description:
          extra.descripcion_ingrediente ?? extra.ingredientes.descripcion,
      })),
    })),
  };
};

const getStaffOrderQueue = async () => {
  const [orders, queue, preparationMinutes] = await Promise.all([
    listActiveOrders(),
    findQueueOrders(),
    getPreparationMinutes(),
  ]);

  return {
    preparationMinutes,
    orders: orders.map((order) => ({
      id: order.id_pedido,
      createdAt: order.fecha,
      deliveryType: normalizeDeliveryType(order.tipo_entrega),
      deliveryAddress: order.direccion_entrega,
      total: order.total,
      priority: order.prioridad,
      status: order.estados_pedido.nombre,
      expectedPaymentMethodId: order.id_metodo_pago_previsto,
      customer: order.clientes,
      items: order.detalle_pedido.map((item) => ({
        name: item.productos.nombre,
        size: item.tamanos?.nombre ?? null,
        quantity: item.cantidad,
        unitPrice: item.precio_unitario,
        extras: item.detalle_pedido_ingredientes.map((extra) => ({
          name: extra.nombre_ingrediente ?? extra.ingredientes.nombre,
          description:
            extra.descripcion_ingrediente ?? extra.ingredientes.descripcion,
        })),
      })),
      paidAt: order.pagado_en?.toISOString() ?? null,
      paymentMethod: order.metodos_pago?.nombre ?? null,
      expectedPaymentMethod: order.metodo_pago_previsto?.nombre ?? null,
      paymentProof: order.comprobante_pago
        ? {
            uploadedAt: order.comprobante_pago.creado_en.toISOString(),
            fileName: order.comprobante_pago.nombre_archivo,
            contentType: order.comprobante_pago.tipo_contenido,
          }
        : null,
      etaMinutes:
        order.estados_pedido.nombre === "PENDIENTE_CONFIRMACION"
          ? null
          : calculateEtaMinutes(order.id_pedido, queue, preparationMinutes),
    })),
  };
};

const getOrderSettings = async () => ({
  preparationMinutes: await getPreparationMinutes(),
});

const updateOrderSettings = async (preparationMinutes: number) => {
  await savePreparationMinutes(preparationMinutes);
  return { preparationMinutes };
};

const getAllowedNextStatuses = (
  status: string,
  deliveryType: string,
): OrderStatus[] => {
  switch (status) {
    case "RECIBIDO":
      return ["EN_PREPARACION", "CANCELADO"];
    case "EN_PREPARACION":
      return ["LISTO", "CANCELADO"];
    case "LISTO":
      return deliveryType === "DOMICILIO"
        ? ["EN_CAMINO", "CANCELADO"]
        : ["ENTREGADO", "CANCELADO"];
    case "EN_CAMINO":
      return ["ENTREGADO", "CANCELADO"];
    default:
      return [];
  }
};

const updateStaffOrder = async (
  id: number,
  input: OrderUpdateInput,
  userId: number,
) => {
  const order = await findOrderForUpdate(id);
  if (!order) {
    throw new OrderServiceError("El pedido no existe.", 404);
  }

  if (input.status === "CANCELADO") {
    return cancelOrderAndRestoreInventory(id, userId);
  }

  if (
    input.priority &&
    !PRIORITY_EDITABLE_STATUSES.includes(
      order.estados_pedido.nombre as (typeof PRIORITY_EDITABLE_STATUSES)[number],
    )
  ) {
    throw new OrderServiceError(
      "Solo se puede cambiar la prioridad de pedidos pendientes o en preparación.",
      409,
    );
  }

  let statusId: number | undefined;
  let preparationStartedAt: Date | undefined;
  let readyAt: Date | undefined;
  if (input.status && input.status !== order.estados_pedido.nombre) {
    if (
      !getAllowedNextStatuses(
        order.estados_pedido.nombre,
        normalizeDeliveryType(order.tipo_entrega),
      ).includes(input.status)
    ) {
      throw new OrderServiceError(
        "La transición solicitada no está permitida para este pedido.",
        409,
      );
    }
    if (input.status === "ENTREGADO" && !order.pagado_en) {
      throw new OrderServiceError(
        "Registra el pago antes de marcar el pedido como entregado.",
        409,
      );
    }
    const state = await findStatus(input.status);
    statusId = state.id_estado;
    if (input.status === "EN_PREPARACION") {
      preparationStartedAt = new Date();
    }
    if (input.status === "LISTO") {
      readyAt = new Date();
    }
  }

  if (input.status && statusId) {
    const transitioned = await transitionOrderStatus(
      id,
      order.id_estado,
      statusId,
      userId,
      { preparationStartedAt, readyAt },
      order.estados_pedido.nombre,
      input.status,
    );
    if (!transitioned) {
      throw new OrderServiceError(
        "El pedido cambió de estado. Actualiza la cola e intenta de nuevo.",
        409,
      );
    }
  }
  if (input.priority) {
    await updateOrder(id, { priority: input.priority });
  }
  return { updated: true };
};

const confirmStaffOrder = async (id: number, userId: number) => {
  try {
    await confirmOrderAndDeductInventory(id, userId);
    return { confirmed: true, etaMinutes: await getEta(id) };
  } catch (error: unknown) {
    if (error instanceof Error) {
      const known: Record<string, [string, number]> = {
        ORDER_NOT_PENDING: ["El pedido ya fue procesado por Caja.", 409],
        ORDER_PRODUCT_UNAVAILABLE: [
          "Uno o más productos dejaron de estar disponibles.",
          409,
        ],
        ORDER_RECIPE_MISSING: [
          "No se puede confirmar: falta configurar una receta para un producto o presentación.",
          409,
        ],
        ORDER_INGREDIENT_BLOCKED: [
          "No se puede confirmar: un ingrediente está bloqueado.",
          409,
        ],
      };
      if (error.message.startsWith("ORDER_STOCK_INSUFFICIENT:")) {
        throw new OrderServiceError(
          "No hay existencia suficiente o algún ingrediente está en su stock mínimo.",
          409,
        );
      }
      const knownError = known[error.message];
      if (knownError) {
        throw new OrderServiceError(knownError[0], knownError[1]);
      }
    }
    throw error;
  }
};

const getStaffPaymentMethods = async () => {
  const methods = await listPaymentMethods();
  return methods.map((method) => ({
    id: method.id_metodo_pago,
    name: method.nombre,
  }));
};

const recordStaffPayment = async (
  id: number,
  methodId: number,
  userId: number,
) => {
  const result = await registerOrderPayment(id, methodId, userId);
  const errors: Record<string, [string, number]> = {
    ORDER_NOT_FOUND: ["El pedido no existe.", 404],
    ORDER_ALREADY_PAID: ["El pago de este pedido ya fue registrado.", 409],
    ORDER_NOT_PAYABLE: [
      "No se puede cobrar un pedido pendiente o cancelado.",
      409,
    ],
    PAYMENT_METHOD_NOT_FOUND: ["El método de pago no existe.", 422],
  };
  if (result !== "OK") {
    const knownError = errors[result];
    throw new OrderServiceError(knownError[0], knownError[1]);
  }
  return { paid: true };
};

export {
  OrderServiceError,
  addGuestOrder,
  calculateEtaMinutes,
  confirmStaffOrder,
  getGuestOrderTracking,
  getOrderSettings,
  getPublicMenu,
  getStaffOrderQueue,
  getStaffPaymentMethods,
  recordStaffPayment,
  updateOrderSettings,
  updateStaffOrder,
};
