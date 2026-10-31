"use client";

import { useState, type FormEvent } from "react";

type SalesReportData = {
  totalSales: string;
  orderCount: number;
  salesByPaymentMethod: {
    paymentMethod: string;
    total: string;
    orderCount: number;
  }[];
  recentOrders: {
    id: number;
    createdAt: string;
    paidAt: string | null;
    total: string;
    customer: string;
    paymentMethod: string;
    status: string;
  }[];
};

const today = () => new Date().toISOString().slice(0, 10);
const currency = (amount: string) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(amount));

const responseMessage = async (response: Response): Promise<string> => {
  const body: unknown = await response.json().catch(() => null);
  return typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
    ? body.message
    : "No fue posible generar el reporte.";
};

export function SalesReport() {
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [report, setReport] = useState<SalesReportData | null>(null);
  const [reportRange, setReportRange] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const visibleOrders = report?.recentOrders ?? [];
  const allVisibleSelected =
    visibleOrders.length > 0 &&
    visibleOrders.every((order) => selectedOrderIds.has(order.id));
  const selectedOrders = visibleOrders.filter((order) =>
    selectedOrderIds.has(order.id),
  );

  const generateReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/reports/sales?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error(await responseMessage(response));
      setReport((await response.json()) as SalesReportData);
      setReportRange({ from, to });
      setSelectedOrderIds(new Set());
    } catch (reportError: unknown) {
      setError(
        reportError instanceof Error
          ? reportError.message
          : "No fue posible generar el reporte.",
      );
      setReport(null);
      setReportRange(null);
      setSelectedOrderIds(new Set());
    } finally {
      setLoading(false);
    }
  };

  const toggleAllOrders = () => {
    setSelectedOrderIds(
      allVisibleSelected
        ? new Set()
        : new Set(visibleOrders.map((order) => order.id)),
    );
  };

  const toggleOrder = (orderId: number) => {
    setSelectedOrderIds((current) => {
      const next = new Set(current);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const exportSelectedOrders = () => {
    if (selectedOrders.length === 0) return;

    const csvCell = (value: string | number): string => {
      const text = String(value);
      const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${safeText.replaceAll('"', '""')}"`;
    };
    const rows = [
      ["Pedido", "Cliente", "Fecha de pago", "Método", "Estado", "Total"],
      ...selectedOrders.map((order) => [
        order.id,
        order.customer,
        order.paidAt ? new Date(order.paidAt).toISOString() : "",
        order.paymentMethod,
        order.status,
        order.total,
      ]),
    ];
    const csv = `\uFEFF${rows
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n")}`;
    const blobUrl = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = blobUrl;
    const fileFrom = reportRange?.from ?? from;
    const fileTo = reportRange?.to ?? to;
    link.download = `ventas-${fileFrom}-${fileTo}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  };

  return (
    <div className="space-y-6">
      <form
        className="flex flex-wrap items-end gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
        onSubmit={(event) => void generateReport(event)}
      >
        <label className="grid gap-1 text-sm font-semibold">
          Desde
          <input
            className="rounded-lg border border-stone-300 px-3 py-2"
            onChange={(event) => setFrom(event.target.value)}
            required
            type="date"
            value={from}
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Hasta
          <input
            className="rounded-lg border border-stone-300 px-3 py-2"
            onChange={(event) => setTo(event.target.value)}
            required
            type="date"
            value={to}
          />
        </label>
        <button
          className="rounded-lg bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
          disabled={loading}
          type="submit"
        >
          {loading ? "Generando..." : "Generar reporte"}
        </button>
      </form>

      {error && (
        <p className="rounded-lg bg-red-50 p-4 text-red-800" role="alert">
          {error}
        </p>
      )}
      {report && (
        <>
          <section className="grid gap-4 sm:grid-cols-2">
            <article className="rounded-2xl border border-l-4 border-l-red-700 border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-stone-600">
                Ventas cobradas
              </p>
              <p className="mt-2 text-3xl font-extrabold tracking-tight text-stone-900">
                {currency(report.totalSales)}
              </p>
            </article>
            <article className="rounded-2xl border border-l-4 border-l-[#25364B] border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-stone-600">
                Pedidos cobrados
              </p>
              <p className="mt-2 text-3xl font-extrabold tracking-tight text-stone-900">
                {report.orderCount}
              </p>
            </article>
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold">Ventas por método de pago</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[28rem] text-left">
                <thead className="border-b border-stone-200 text-sm text-stone-500">
                  <tr>
                    <th className="py-2">Método</th>
                    <th>Pedidos</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {report.salesByPaymentMethod.map((payment) => (
                    <tr className="border-b border-stone-100" key={payment.paymentMethod}>
                      <td className="py-3">{payment.paymentMethod}</td>
                      <td>{payment.orderCount}</td>
                      <td className="font-semibold">{currency(payment.total)}</td>
                    </tr>
                  ))}
                  {report.salesByPaymentMethod.length === 0 && (
                    <tr>
                      <td className="py-4 text-stone-500" colSpan={3}>
                        No hay pagos registrados en este periodo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="overflow-x-auto rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold">
                Pedidos cobrados recientes (máximo 100)
              </h2>
              <button
                className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={selectedOrders.length === 0}
                onClick={exportSelectedOrders}
                type="button"
              >
                Descargar seleccionados ({selectedOrders.length}) CSV
              </button>
            </div>
            <table className="mt-4 w-full min-w-[46rem] text-left text-sm">
              <thead className="border-b border-stone-200 text-stone-500">
                <tr>
                  <th className="py-2">
                    <label className="inline-flex items-center gap-2">
                      <input
                        aria-label={
                          allVisibleSelected
                            ? "Quitar selección de todos los pedidos visibles"
                            : "Seleccionar todos los pedidos visibles"
                        }
                        checked={allVisibleSelected}
                        onChange={toggleAllOrders}
                        type="checkbox"
                      />
                      <span className="sr-only">Seleccionar todos</span>
                    </label>
                  </th>
                  <th className="py-2">Pedido</th>
                  <th>Cliente</th>
                  <th>Fecha de pago</th>
                  <th>Método</th>
                  <th>Estado</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {report.recentOrders.map((order) => (
                  <tr className="border-b border-stone-100" key={order.id}>
                    <td className="py-3">
                      <input
                        aria-label={`Seleccionar pedido ${order.id}`}
                        checked={selectedOrderIds.has(order.id)}
                        onChange={() => toggleOrder(order.id)}
                        type="checkbox"
                      />
                    </td>
                    <td className="py-3">#{order.id}</td>
                    <td>{order.customer}</td>
                    <td>
                      {order.paidAt
                        ? new Date(order.paidAt).toLocaleString("es-MX")
                        : "—"}
                    </td>
                    <td>{order.paymentMethod}</td>
                    <td>{order.status}</td>
                    <td className="font-semibold">{currency(order.total)}</td>
                  </tr>
                ))}
                {report.recentOrders.length === 0 && (
                  <tr>
                    <td className="py-4 text-stone-500" colSpan={7}>
                      No hay pedidos cobrados en este periodo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
