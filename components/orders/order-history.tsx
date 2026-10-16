"use client";

import { useEffect, useState } from "react";

type OrderHistoryItem = {
  quantity: number;
  name: string;
  size: string | null;
};

type OrderHistoryEntry = {
  previousStatus: string | null;
  status: string;
  at: string;
  actor: string;
};

type OrderHistoryOrder = {
  id: number;
  createdAt: string;
  deliveryType: string;
  priority: string;
  total: string;
  paidAt: string | null;
  customer: string;
  phone: string | null;
  status: string;
  paymentMethod: string | null;
  items: OrderHistoryItem[];
  changes: OrderHistoryEntry[];
};

const currency = (amount: string) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(amount));

export function OrderHistory() {
  const [orders, setOrders] = useState<OrderHistoryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [printOrderId, setPrintOrderId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/orders/history", { cache: "no-store" })
      .then(async (response) => {
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          const message =
            typeof body === "object" &&
            body !== null &&
            "message" in body &&
            typeof body.message === "string"
              ? body.message
              : "No fue posible cargar el historial.";
          throw new Error(message);
        }
        return body as { orders: OrderHistoryOrder[] };
      })
      .then((data) => setOrders(data.orders))
      .catch((loadError: unknown) =>
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No fue posible cargar el historial.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const printableOrder = orders.find(
    (order) => order.id === printOrderId && order.paidAt,
  );

  if (loading) {
    return <p className="rounded-xl bg-white p-6">Cargando historial...</p>;
  }
  if (error) {
    return (
      <p className="rounded-xl bg-red-50 p-6 text-red-800" role="alert">
        {error}
      </p>
    );
  }
  if (orders.length === 0) {
    return <p className="rounded-xl bg-white p-6">Aún no hay pedidos.</p>;
  }

  return (
    <>
      <div className="space-y-4">
        {orders.map((order) => (
          <article
            className="rounded-2xl bg-white p-5 shadow-sm"
            key={order.id}
          >
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-stone-900">
                  Pedido #{order.id} · {order.status.replaceAll("_", " ")}
                </h2>
                <p className="text-sm text-stone-600">
                  {new Date(order.createdAt).toLocaleString("es-MX")} ·{" "}
                  {order.customer}
                  {order.phone ? ` · ${order.phone}` : ""}
                </p>
              </div>
              <p className="font-bold">{currency(order.total)}</p>
            </div>
            <p className="mt-2 text-sm text-stone-700">
              {order.deliveryType} · Prioridad {order.priority} ·{" "}
              {order.paidAt
                ? `Pagado · ${order.paymentMethod ?? "método no especificado"}`
                : "No pagado"}
            </p>
            <ul className="mt-3 list-inside list-disc text-sm">
              {order.items.map((item, index) => (
                <li key={`${item.name}-${item.size ?? ""}-${index}`}>
                  {item.quantity} × {item.name}
                  {item.size ? ` · ${item.size}` : ""}
                </li>
              ))}
            </ul>
            {order.paidAt && (
              <button
                className="mt-4 rounded-lg border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-900"
                onClick={() => {
                  setPrintOrderId(order.id);
                  window.setTimeout(() => {
                    window.print();
                    setPrintOrderId(null);
                  }, 200);
                }}
                type="button"
              >
                Reimprimir ticket de pago
              </button>
            )}
            {order.changes.length > 0 && (
              <details className="mt-4 border-t border-stone-100 pt-3">
                <summary className="cursor-pointer font-semibold text-stone-700">
                  Historial de cambios ({order.changes.length})
                </summary>
                <ul className="mt-2 space-y-1 text-sm text-stone-600">
                  {order.changes.map((change, index) => (
                    <li key={`${change.at}-${index}`}>
                      {change.previousStatus
                        ? `${change.previousStatus} → `
                        : ""}
                      {change.status} · {change.actor} ·{" "}
                      {new Date(change.at).toLocaleString("es-MX")}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </article>
        ))}
        <p className="text-sm text-stone-600">
          Se muestran los 100 pedidos más recientes.
        </p>
      </div>
      {printableOrder?.paidAt && (
        <section className="ticket-print" aria-label="Ticket de pago">
          <h1>TICKET DE PAGO · #{printableOrder.id}</h1>
          <p>Cliente: {printableOrder.customer}</p>
          <p>
            Fecha: {new Date(printableOrder.paidAt).toLocaleString("es-MX")}
          </p>
          <p>
            Método: {printableOrder.paymentMethod ?? "No especificado"}
          </p>
          <hr />
          <ul>
            {printableOrder.items.map((item, index) => (
              <li key={`${item.name}-${item.size ?? ""}-${index}`}>
                {item.quantity} × {item.name}
                {item.size ? ` · ${item.size}` : ""}
              </li>
            ))}
          </ul>
          <hr />
          <p>TOTAL PAGADO: {currency(printableOrder.total)}</p>
        </section>
      )}
    </>
  );
}
