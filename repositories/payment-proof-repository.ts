import { prisma } from "@/lib/database/prisma";

const findPaymentProofUploadContext = (trackingTokenHash: string) =>
  prisma.pedidos.findUnique({
    where: { token_seguimiento_hash: trackingTokenHash },
    select: {
      id_pedido: true,
      pagado_en: true,
      estados_pedido: { select: { nombre: true } },
      metodo_pago_previsto: { select: { nombre: true } },
      comprobante_pago: { select: { clave_almacenamiento: true } },
    },
  });

const replacePaymentProof = async (
  orderId: number,
  data: {
    storageKey: string;
    fileName: string;
    contentType: string;
  },
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
        id_pedido: true,
        pagado_en: true,
        estados_pedido: { select: { nombre: true } },
        metodo_pago_previsto: { select: { nombre: true } },
        comprobante_pago: { select: { clave_almacenamiento: true } },
      },
    });
    if (!order) return { error: "ORDER_NOT_FOUND" as const };
    if (order.pagado_en) return { error: "ORDER_ALREADY_PAID" as const };
    if (order.estados_pedido.nombre === "CANCELADO") {
      return { error: "ORDER_CANCELLED" as const };
    }
    if (order.metodo_pago_previsto?.nombre !== "Transferencia") {
      return { error: "ORDER_NOT_TRANSFER" as const };
    }
    const previousStorageKey =
      order.comprobante_pago?.clave_almacenamiento ?? null;
    await transaction.comprobantes_pago.upsert({
      where: { id_pedido: orderId },
      create: {
        id_pedido: orderId,
        clave_almacenamiento: data.storageKey,
        nombre_archivo: data.fileName,
        tipo_contenido: data.contentType,
      },
      update: {
        clave_almacenamiento: data.storageKey,
        nombre_archivo: data.fileName,
        tipo_contenido: data.contentType,
      },
    });
    return { error: null, previousStorageKey };
  });

const findPaymentProofByOrderId = (orderId: number) =>
  prisma.comprobantes_pago.findUnique({
    where: { id_pedido: orderId },
    select: {
      clave_almacenamiento: true,
      tipo_contenido: true,
      nombre_archivo: true,
    },
  });

export {
  findPaymentProofByOrderId,
  findPaymentProofUploadContext,
  replacePaymentProof,
};
