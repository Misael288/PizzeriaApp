"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type DashboardOrder = {
  id: number;
  createdAt: string;
  deliveryType: string;
  total: string | number;
  status: string;
  customer: { nombre: string; telefono: string };
  paidAt: string | null;
  paymentMethod: string | null;
  expectedPaymentMethod: string | null;
};

type DashboardData = {
  orders: DashboardOrder[];
  totalSales: string;
};

const statusLabels: Record<string, string> = {
  PENDIENTE_CONFIRMACION: "Pendiente",
  RECIBIDO: "Recibido",
  EN_PREPARACION: "En preparación",
  LISTO: "Listo",
  EN_CAMINO: "En camino",
};

const currency = (value: string | number): string =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value));

const localDayRange = (now: Date) => ({
  from: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(),
  until: new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  ).toISOString(),
});

const responseMessage = async (response: Response): Promise<string> => {
  const body: unknown = await response.json().catch(() => null);
  if (
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
  ) {
    return body.message;
  }
  return "No fue posible cargar el panel operativo.";
};

const deliveryLabel = (deliveryType: string): string => {
  switch (deliveryType) {
    case "DOMICILIO":
      return "Domicilio";
    case "LOCAL":
      return "Local";
    case "RECOGER":
      return "Recoger";
    default:
      return deliveryType;
  }
};

export function DashboardOverview() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOverview = useCallback(async () => {
    setError("");

    try {
      const { from, until } = localDayRange(new Date());
      const response = await fetch(
        `/api/dashboard/overview?from=${encodeURIComponent(from)}&until=${encodeURIComponent(until)}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error(await responseMessage(response));
      setData((await response.json()) as DashboardData);
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No fue posible cargar el panel operativo.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCurrent = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const refresh = async () => {
      await loadOverview();
      if (isCurrent) {
        timer = setTimeout(() => void refresh(), 20_000);
      }
    };

    void refresh();
    return () => {
      isCurrent = false;
      if (timer) clearTimeout(timer);
    };
  }, [loadOverview]);

  const orders = data?.orders ?? [];
  const metrics = [
    {
      label: "Pendientes",
      value: orders.filter(
        (order) => order.status === "PENDIENTE_CONFIRMACION",
      ).length,
      accent: "border-l-amber-500",
    },
    {
      label: "En preparación",
      value: orders.filter((order) => order.status === "EN_PREPARACION")
        .length,
      accent: "border-l-blue-600",
    },
    {
      label: "Listos",
      value: orders.filter((order) => order.status === "LISTO").length,
      accent: "border-l-emerald-600",
    },
    {
      label: "Ventas hoy",
      value: data ? currency(data.totalSales) : "—",
      accent: "border-l-[#D94B3D]",
    },
  ];

  return (
    <div className="space-y-6">
      {error && (
        <p
          aria-live="polite"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          role="alert"
        >
          {error}
          {data && " Se muestran los últimos datos cargados."}
        </p>
      )}

      <section
        aria-label="Resumen operativo"
        className="grid grid-cols-2 gap-3 sm:gap-4 2xl:grid-cols-4"
      >
        {metrics.map((metric) => (
          <article
            className={`min-h-28 rounded-2xl border border-l-4 border-[#D8E1EC] bg-white p-4 shadow-sm sm:p-5 ${metric.accent}`}
            key={metric.label}
          >
            <h2 className="text-sm font-semibold text-slate-600">
              {metric.label}
            </h2>
            <p className="mt-2 text-2xl font-extrabold tracking-tight text-[#25364B] sm:text-3xl">
              {data ? metric.value : "—"}
            </p>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#D8E1EC] bg-white shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-xl font-extrabold text-[#25364B]">
              Comandas activas
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Pedidos pendientes, en preparación, listos o en camino.
            </p>
          </div>
          <Link
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#D94B3D] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#B93A31]"
            href="/orders"
          >
            Ver todas las comandas
          </Link>
        </div>

        {isLoading && !data ? (
          <p className="p-6 text-sm text-slate-600">
            Cargando comandas e indicadores...
          </p>
        ) : !data ? (
          <p className="p-6 text-sm text-red-800">
            No se pudieron cargar las comandas. El panel volverá a intentarlo
            automáticamente.
          </p>
        ) : orders.length === 0 ? (
          <p className="p-6 text-sm text-slate-600">
            No hay comandas activas en este momento.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-bold">Comanda</th>
                  <th className="px-4 py-3 font-bold">Cliente</th>
                  <th className="px-4 py-3 font-bold">Entrega</th>
                  <th className="px-4 py-3 font-bold">Estado</th>
                  <th className="px-4 py-3 font-bold">Pago</th>
                  <th className="px-5 py-3 text-right font-bold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => (
                  <tr
                    className="transition hover:bg-slate-50/80"
                    key={order.id}
                  >
                    <td className="whitespace-nowrap px-5 py-4 font-extrabold text-[#25364B]">
                      #{order.id}
                    </td>
                    <td className="px-4 py-4">
                      <span className="block font-semibold text-[#25364B]">
                        {order.customer.nombre}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {new Date(order.createdAt).toLocaleString("es-MX")}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-700">
                      {deliveryLabel(order.deliveryType)}
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-[#25364B]">
                        {statusLabels[order.status] ?? order.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${
                          order.paidAt
                            ? "bg-emerald-50 text-emerald-800"
                            : "bg-amber-50 text-amber-800"
                        }`}
                      >
                        {order.paidAt
                          ? `Pagado · ${order.paymentMethod ?? "Registrado"}`
                          : `Pendiente${order.expectedPaymentMethod ? ` · ${order.expectedPaymentMethod}` : ""}`}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <a
                          className="inline-flex min-h-9 items-center justify-center rounded-lg border border-[#D8E1EC] px-3 py-1.5 text-xs font-bold text-[#25364B] transition hover:bg-slate-50"
                          href={`tel:${encodeURIComponent(order.customer.telefono)}`}
                        >
                          Contactar
                        </a>
                        <Link
                          className="inline-flex min-h-9 items-center justify-center rounded-lg bg-[#25364B] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#17283D]"
                          href={`/orders#pedido-${order.id}`}
                        >
                          Ver
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-slate-500">
        El panel se actualiza automáticamente cada 20 segundos.
      </p>
    </div>
  );
}
