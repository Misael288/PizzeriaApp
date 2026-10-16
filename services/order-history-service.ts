import { findRecentOrderHistory } from "@/repositories/order-history-repository";

const getRecentOrderHistory = async () => {
  const orders = await findRecentOrderHistory();
  return orders.map((order) => ({
    id: order.id_pedido,
    createdAt: order.fecha.toISOString(),
    deliveryType: order.tipo_entrega,
    priority: order.prioridad,
    total: order.total.toString(),
    paidAt: order.pagado_en?.toISOString() ?? null,
    customer: order.clientes.nombre,
    phone: order.clientes.telefono,
    status: order.estados_pedido.nombre,
    paymentMethod: order.metodos_pago?.nombre ?? null,
    items: order.detalle_pedido.map((item) => ({
      quantity: item.cantidad,
      name: item.productos.nombre,
      size: item.tamanos?.nombre ?? null,
    })),
    changes: order.historial_pedidos.map((entry) => ({
      previousStatus: entry.estado_anterior,
      status: entry.estado_nuevo,
      at: entry.creado_en.toISOString(),
      actor: entry.usuarios?.name ?? "Sistema",
    })),
  }));
};

export { getRecentOrderHistory };
