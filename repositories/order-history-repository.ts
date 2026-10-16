import { prisma } from "@/lib/database/prisma";

const findRecentOrderHistory = () =>
  prisma.pedidos.findMany({
    orderBy: [{ fecha: "desc" }, { id_pedido: "desc" }],
    take: 100,
    select: {
      id_pedido: true,
      fecha: true,
      tipo_entrega: true,
      prioridad: true,
      total: true,
      pagado_en: true,
      clientes: { select: { nombre: true, telefono: true } },
      metodos_pago: { select: { nombre: true } },
      estados_pedido: { select: { nombre: true } },
      detalle_pedido: {
        select: {
          cantidad: true,
          productos: { select: { nombre: true } },
          tamanos: { select: { nombre: true } },
        },
      },
      historial_pedidos: {
        orderBy: [{ creado_en: "desc" }, { id_historial: "desc" }],
        take: 10,
        select: {
          estado_anterior: true,
          estado_nuevo: true,
          creado_en: true,
          usuarios: { select: { name: true } },
        },
      },
    },
  });

export { findRecentOrderHistory };
