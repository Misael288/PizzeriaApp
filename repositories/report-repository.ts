import { prisma } from "@/lib/database/prisma";

const getPaidSalesTotal = async (from: Date, until: Date) => {
  const summary = await prisma.pedidos.aggregate({
    where: { pagado_en: { gte: from, lt: until } },
    _sum: { total: true },
  });
  return summary._sum.total?.toString() ?? "0.00";
};

const getSalesReportData = async (from: Date, until: Date) => {
  const where = { pagado_en: { gte: from, lt: until } };
  const [summary, paymentGroups, recentOrders] = await Promise.all([
    prisma.pedidos.aggregate({
      where,
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.pedidos.groupBy({
      by: ["id_metodo_pago"],
      where,
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.pedidos.findMany({
      where,
      orderBy: [{ pagado_en: "desc" }, { id_pedido: "desc" }],
      take: 100,
      select: {
        id_pedido: true,
        fecha: true,
        pagado_en: true,
        total: true,
        clientes: { select: { nombre: true } },
        metodos_pago: { select: { nombre: true } },
        estados_pedido: { select: { nombre: true } },
      },
    }),
  ]);
  const paymentMethods = await prisma.metodos_pago.findMany({
    where: {
      id_metodo_pago: {
        in: paymentGroups.flatMap((group) =>
          group.id_metodo_pago === null ? [] : [group.id_metodo_pago],
        ),
      },
    },
    select: { id_metodo_pago: true, nombre: true },
  });

  return {
    totalSales: summary._sum.total?.toString() ?? "0.00",
    orderCount: summary._count._all,
    salesByPaymentMethod: paymentGroups.map((group) => ({
      paymentMethodId: group.id_metodo_pago,
      paymentMethod:
        paymentMethods.find(
          (method) => method.id_metodo_pago === group.id_metodo_pago,
        )?.nombre ?? "No especificado",
      total: group._sum.total?.toString() ?? "0.00",
      orderCount: group._count._all,
    })),
    recentOrders: recentOrders.map((order) => ({
      id: order.id_pedido,
      createdAt: order.fecha.toISOString(),
      paidAt: order.pagado_en?.toISOString() ?? null,
      total: order.total.toString(),
      customer: order.clientes.nombre,
      paymentMethod: order.metodos_pago?.nombre ?? "No especificado",
      status: order.estados_pedido.nombre,
    })),
  };
};

export { getPaidSalesTotal, getSalesReportData };
