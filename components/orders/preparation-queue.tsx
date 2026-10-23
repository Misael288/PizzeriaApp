
"use client";

import { useState } from "react";

type Order = {
  id: string;
  priority: "ALTA" | "MEDIA";
  waiting: string;
  products: string;
  status: "Pendiente" | "En preparación";
};

const initialOrders: Order[] = [
  {
    id: "PZ-1048",
    priority: "ALTA",
    waiting: "18:42",
    products: "1 Pepperoni + 1 Refresco",
    status: "Pendiente",
  },
  {
    id: "PZ-1047",
    priority: "MEDIA",
    waiting: "11:05",
    products: "1 Mexicana",
    status: "Pendiente",
  },
  {
    id: "PZ-1046",
    priority: "MEDIA",
    waiting: "06:18",
    products: "2 Pepperoni",
    status: "Pendiente",
  },
];

export function PreparationQueue() {
  const [orders, setOrders] = useState<Order[]>(initialOrders);

  function startOrder(id: string) {
    setOrders((current) =>
      current.map((order) =>
        order.id === id
          ? { ...order, status: "En preparación" }
          : order
      )
    );
  }

  function cancelOrder(id: string) {
    const confirmed = window.confirm(
      `¿Deseas cancelar la comanda ${id}?`
    );

    if (!confirmed) return;

    setOrders((current) =>
      current.filter((order) => order.id !== id)
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumen de comandas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Total de comandas
          </p>
          <p className="mt-2 text-3xl font-extrabold text-[#25364b]">
            {orders.length}
          </p>
        </div>

        <div className="rounded-xl border border-red-100 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Prioridad alta
          </p>
          <p className="mt-2 text-3xl font-extrabold text-[#ed5054]">
            {orders.filter((order) => order.priority === "ALTA").length}
          </p>
        </div>

        <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            En preparación
          </p>
          <p className="mt-2 text-3xl font-extrabold text-[#3280ee]">
            {
              orders.filter(
                (order) => order.status === "En preparación"
              ).length
            }
          </p>
        </div>
      </div>

      {/* Encabezado de la cola */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-[#25364b]">
          Comandas pendientes
        </h2>

        <span className="text-sm text-slate-500">
          {orders.length} pedidos en cola
        </span>
      </div>

      {/* Tarjetas de pedidos */}
      <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 xl:grid-cols-3">
        {orders.map((order) => (
          <article
            key={order.id}
            className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg"
          >
            {/* Banda de prioridad */}
            <div
              className={`flex items-center justify-between px-6 py-4 ${
                order.priority === "ALTA"
                  ? "bg-[#ed5054] text-white"
                  : "bg-[#f5ca48] text-[#25364b]"
              }`}
            >
              <span className="text-sm font-extrabold tracking-[0.12em]">
                {order.priority}
              </span>

              <span className="text-xs font-semibold">
                {order.priority === "ALTA"
                  ? "Atención prioritaria"
                  : "Prioridad normal"}
              </span>
            </div>

            {/* Información del pedido */}
            <div className="flex flex-1 flex-col p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    Número de comanda
                  </p>

                  <h3 className="mt-2 text-3xl font-extrabold tracking-tight text-[#25364b]">
                    #{order.id}
                  </h3>
                </div>

                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#edf3fa] text-[#25364b]">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-6 w-6"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                </div>
              </div>

              {/* Tiempo de espera */}
              <div className="mt-6 rounded-xl bg-[#f4f6f9] p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Tiempo de espera
                </p>

                <p className="mt-1 text-2xl font-extrabold tabular-nums text-[#25364b]">
                  {order.waiting}
                </p>
              </div>

              {/* Productos */}
              <div className="mt-6">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Productos solicitados
                </p>

                <p className="mt-3 rounded-lg border border-slate-100 px-4 py-4 text-base font-semibold leading-6 text-slate-700">
                  {order.products}
                </p>
              </div>

              {/* Estado operativo */}
              <div className="mt-5 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-500">
                  Estado operativo
                </span>

                <span
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                    order.status === "Pendiente"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {order.status}
                </span>
              </div>

              {/* Botones del maquetado */}
              <div className="mt-auto space-y-3 pt-7">
                <button
                  type="button"
                  onClick={() => startOrder(order.id)}
                  disabled={order.status !== "Pendiente"}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#3280ee] px-5 py-3 text-sm font-extrabold tracking-wide text-white shadow-sm transition hover:bg-[#2268ca] focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none"
                >
                  {order.status === "Pendiente" ? (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="h-4 w-4"
                        aria-hidden="true"
                      >
                        <path d="M8 5.5a1 1 0 0 1 1.5-.86l9 5.5a1 1 0 0 1 0 1.72l-9 5.5A1 1 0 0 1 8 16.5z" />
                      </svg>
                      INICIAR
                    </>
                  ) : (
                    "EN PREPARACIÓN"
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => cancelOrder(order.id)}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#ed5054] px-5 py-3 text-sm font-extrabold tracking-wide text-white shadow-sm transition hover:bg-[#d83d42] focus:outline-none focus:ring-4 focus:ring-red-200"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                  CANCELAR
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Estado vacío */}
      {orders.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-7 w-7"
              aria-hidden="true"
            >
              <path d="M4 7h16M6 7l1 13h10l1-13M9 7V4h6v3M10 11v5M14 11v5" />
            </svg>
          </div>

          <h3 className="mt-4 text-xl font-extrabold text-[#25364b]">
            No hay comandas pendientes
          </h3>

          <p className="mt-2 text-sm text-slate-500">
            Los nuevos pedidos aparecerán en esta sección.
          </p>
        </div>
      )}

      {/* Referencias funcionales */}
      <footer className="border-t border-slate-200 pt-5 text-xs font-medium tracking-wide text-slate-400">
        RF-FUN-10 · RF-FUN-11 · RF-FUN-12 · RN-03 · RN-04 · RN-05
      </footer>
    </div>
  );
}
