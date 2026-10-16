type OrderPriority = "NORMAL" | "ALTA" | "URGENTE";
type OrderStatus =
  | "RECIBIDO"
  | "EN_PREPARACION"
  | "LISTO"
  | "EN_CAMINO"
  | "ENTREGADO"
  | "CANCELADO";
type DeliveryType = "DOMICILIO" | "RECOGER";

type GuestOrderItemInput = {
  productId: number;
  sizeId: number | null;
  quantity: number;
};

type GuestOrderInput = {
  customerName: string;
  phone: string;
  deliveryType: DeliveryType;
  deliveryAddress: string | null;
  paymentMethodId: number;
  items: GuestOrderItemInput[];
};

type OrderUpdateInput = {
  priority?: OrderPriority;
  status?: OrderStatus;
};

type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; message: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parsePositiveInteger = (value: unknown): number | null =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value > 0
    ? value
    : null;

const parseGuestOrderInput = (
  value: unknown,
): ValidationResult<GuestOrderInput> => {
  if (!isRecord(value)) {
    return { success: false, message: "El pedido debe ser un objeto." };
  }

  if (
    typeof value.customerName !== "string" ||
    value.customerName.trim().length === 0 ||
    value.customerName.trim().length > 150
  ) {
    return {
      success: false,
      message: "El nombre debe tener entre 1 y 150 caracteres.",
    };
  }

  if (typeof value.phone !== "string") {
    return { success: false, message: "El teléfono no es válido." };
  }

  const phone = value.phone.replace(/[\s()-]/g, "");
  if (!/^(?:\+[0-9]{8,14}|[0-9]{8,15})$/.test(phone)) {
    return {
      success: false,
      message: "El teléfono debe contener entre 8 y 15 dígitos.",
    };
  }

  if (value.deliveryType !== "DOMICILIO" && value.deliveryType !== "RECOGER") {
    return {
      success: false,
      message: "Selecciona entrega a domicilio o recoger en sucursal.",
    };
  }

  const paymentMethodId = parsePositiveInteger(value.paymentMethodId);
  if (paymentMethodId === null) {
    return {
      success: false,
      message: "Selecciona un método de pago válido.",
    };
  }

  let deliveryAddress: string | null = null;
  if (value.deliveryType === "DOMICILIO") {
    if (
      typeof value.deliveryAddress !== "string" ||
      value.deliveryAddress.trim().length === 0 ||
      value.deliveryAddress.trim().length > 300
    ) {
      return {
        success: false,
        message: "La dirección debe tener entre 1 y 300 caracteres.",
      };
    }
    deliveryAddress = value.deliveryAddress.trim();
  }

  if (
    !Array.isArray(value.items) ||
    value.items.length === 0 ||
    value.items.length > 20
  ) {
    return {
      success: false,
      message: "El pedido debe incluir entre 1 y 20 productos.",
    };
  }

  const items: GuestOrderItemInput[] = [];
  const uniqueItems = new Set<string>();
  for (const [index, entry] of value.items.entries()) {
    if (!isRecord(entry)) {
      return {
        success: false,
        message: `El producto ${index + 1} no tiene un formato válido.`,
      };
    }

    const productId = parsePositiveInteger(entry.productId);
    const quantity = parsePositiveInteger(entry.quantity);
    const sizeId =
      entry.sizeId === null ? null : parsePositiveInteger(entry.sizeId);
    if (productId === null || quantity === null || quantity > 50) {
      return {
        success: false,
        message: `El producto ${index + 1} contiene una cantidad o referencia no válida.`,
      };
    }
    if (entry.sizeId !== null && sizeId === null) {
      return {
        success: false,
        message: `El tamaño del producto ${index + 1} no es válido.`,
      };
    }

    const key = `${productId}:${sizeId ?? "none"}`;
    if (uniqueItems.has(key)) {
      return {
        success: false,
        message: "Combina las cantidades de productos repetidos en el carrito.",
      };
    }
    uniqueItems.add(key);
    items.push({ productId, sizeId, quantity });
  }

  return {
    success: true,
    data: {
      customerName: value.customerName.trim(),
      phone,
      deliveryType: value.deliveryType,
      deliveryAddress,
      paymentMethodId,
      items,
    },
  };
};

const parseOrderUpdateInput = (
  value: unknown,
): ValidationResult<OrderUpdateInput> => {
  if (!isRecord(value)) {
    return { success: false, message: "La actualización no es válida." };
  }

  const priorities: readonly OrderPriority[] = ["NORMAL", "ALTA", "URGENTE"];
  const statuses: readonly OrderStatus[] = [
    "RECIBIDO",
    "EN_PREPARACION",
    "LISTO",
    "EN_CAMINO",
    "ENTREGADO",
    "CANCELADO",
  ];
  const result: OrderUpdateInput = {};

  if (value.priority !== undefined) {
    if (
      typeof value.priority !== "string" ||
      !priorities.includes(value.priority as OrderPriority)
    ) {
      return { success: false, message: "La prioridad seleccionada no existe." };
    }
    result.priority = value.priority as OrderPriority;
  }
  if (value.status !== undefined) {
    if (
      typeof value.status !== "string" ||
      !statuses.includes(value.status as OrderStatus)
    ) {
      return { success: false, message: "El estado seleccionado no existe." };
    }
    result.status = value.status as OrderStatus;
  }
  if (!result.priority && !result.status) {
    return {
      success: false,
      message: "Debes indicar una prioridad o un estado para actualizar.",
    };
  }

  return { success: true, data: result };
};

const parsePreparationMinutes = (
  value: unknown,
): ValidationResult<number> => {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > 240
  ) {
    return {
      success: false,
      message: "El tiempo de preparación debe ser un entero entre 1 y 240 minutos.",
    };
  }
  return { success: true, data: value };
};

export {
  parseGuestOrderInput,
  parseOrderUpdateInput,
  parsePreparationMinutes,
};
export type {
  DeliveryType,
  GuestOrderInput,
  OrderPriority,
  OrderStatus,
  OrderUpdateInput,
};
