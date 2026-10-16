"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

type UserRole = "ADMIN" | "CASHIER";
type OrderStatus =
  | "RECIBIDO"
  | "EN_PREPARACION"
  | "LISTO"
  | "EN_CAMINO"
  | "ENTREGADO"
  | "CANCELADO";
type OrderPriority = "NORMAL" | "ALTA" | "URGENTE";

type StaffOrder = {
  id: number;
  createdAt: string;
  deliveryType: string;
  deliveryAddress: string | null;
  total: string | number;
  priority: string;
  status: string;
  customer: { nombre: string; telefono: string };
  items: {
    name: string;
    size: string | null;
    quantity: number;
    unitPrice: string | number;
  }[];
  etaMinutes: number | null;
  paidAt: string | null;
  paymentMethod: string | null;
  expectedPaymentMethodId: number | null;
  expectedPaymentMethod: string | null;
  paymentProof: {
    uploadedAt: string;
    fileName: string;
    contentType: string;
  } | null;
};

type StaffOrderQueueProps = {
  role: UserRole;
};

type QueueData = {
  preparationMinutes: number;
  orders: StaffOrder[];
};

type PaymentMethod = { id: number; name: string };

const statusLabels: Record<string, string> = {
  PENDIENTE_CONFIRMACION: "Pendiente de confirmación",
  RECIBIDO: "Recibido",
  EN_PREPARACION: "En preparación",
  LISTO: "Listo",
  EN_CAMINO: "En camino",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado",
};

const priorityLabels: Record<OrderPriority, string> = {
  NORMAL: "Normal",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

const currency = (value: number | string): string =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value));

const responseMessage = async (
  response: Response,
  fallback: string,
): Promise<string> => {
  const body: unknown = await response.json().catch(() => null);
  if (
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
  ) {
    return body.message;
  }
  return fallback;
};

const nextStatuses = (order: StaffOrder): OrderStatus[] => {
  const needsPayment = !order.paidAt;
  switch (order.status) {
    case "RECIBIDO":
      return ["EN_PREPARACION", "CANCELADO"];
    case "EN_PREPARACION":
      return ["LISTO", "CANCELADO"];
    case "LISTO":
      if (order.deliveryType === "DOMICILIO") {
        return ["EN_CAMINO", "CANCELADO"];
      }
      return needsPayment
        ? ["CANCELADO"]
        : ["ENTREGADO", "CANCELADO"];
    case "EN_CAMINO":
      return needsPayment ? ["CANCELADO"] : ["ENTREGADO", "CANCELADO"];
    default:
      return [];
  }
};

export function StaffOrderQueue({ role }: StaffOrderQueueProps) {
  const isAdmin = role === "ADMIN";
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(0);
  const [preparationMinutes, setPreparationMinutes] = useState("15");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentSelections, setPaymentSelections] = useState<
    Record<number, number>
  >({});
  const [printOrderId, setPrintOrderId] = useState<number | null>(null);
  const [printMode, setPrintMode] = useState<"kitchen" | "payment">("kitchen");
  const initializedSettings = useRef(false);
  const previousOrders = useRef<Map<number, string> | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      const [response, paymentResponse] = await Promise.all([
        fetch("/api/orders", { cache: "no-store" }),
        fetch("/api/orders/payment-methods", { cache: "no-store" }),
      ]);
      if (!response.ok) {
        throw new Error(
          await responseMessage(response, "No se pudo cargar la cola."),
        );
      }
      const result = (await response.json()) as QueueData;
      if (!paymentResponse.ok) {
        throw new Error(
          await responseMessage(
            paymentResponse,
            "No se pudieron cargar los métodos de pago.",
          ),
        );
      }
      const methodResult = (await paymentResponse.json()) as {
        methods: PaymentMethod[];
      };
      setPaymentMethods(methodResult.methods);
      const currentStatuses = new Map(
        result.orders.map((order) => [order.id, order.status]),
      );
      const previous = previousOrders.current;
      if (previous) {
        const newlyArrived = result.orders.find(
          (order) => !previous.has(order.id),
        );
        const changed = result.orders.find(
          (order) =>
            previous.has(order.id) &&
            previous.get(order.id) !== order.status,
        );
        if (newlyArrived) {
          setNotice(`Nuevo pedido #${newlyArrived.id} recibido en Caja.`);
        } else if (changed) {
          setNotice(
            `El pedido #${changed.id} cambió a ${statusLabels[changed.status] ?? changed.status}.`,
          );
        }
      }
      previousOrders.current = currentStatuses;
      setOrders(result.orders);
      setNow(Date.now());
      if (!initializedSettings.current) {
        setPreparationMinutes(String(result.preparationMinutes));
        initializedSettings.current = true;
      }
      setError("");
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar la cola.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCurrent = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const refresh = async () => {
      await loadOrders();
      if (isCurrent) {
        timer = setTimeout(() => void refresh(), 20_000);
      }
    };

    void refresh();
    return () => {
      isCurrent = false;
      if (timer) clearTimeout(timer);
    };
  }, [loadOrders]);

  const updateOrder = async (
    order: StaffOrder,
    update: { priority?: OrderPriority; status?: OrderStatus },
  ) => {
    setBusyOrderId(order.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      if (!response.ok) {
        throw new Error(
          await responseMessage(response, "No se pudo actualizar el pedido."),
        );
      }
      setNotice(`Pedido #${order.id} actualizado.`);
      await loadOrders();
    } catch (updateError: unknown) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "No se pudo actualizar el pedido.",
      );
    } finally {
      setBusyOrderId(null);
    }
  };

  const confirmOrder = async (order: StaffOrder) => {
    setBusyOrderId(order.id);
    setError("");
    try {
      const response = await fetch(`/api/orders/${order.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) {
        throw new Error(
          await responseMessage(response, "No se pudo confirmar el pedido."),
        );
      }
      setNotice(
        `Pedido #${order.id} confirmado; inventario descontado y ETA iniciado.`,
      );
      await loadOrders();
      setPrintOrderId(order.id);
      window.setTimeout(() => window.print(), 200);
    } catch (confirmError: unknown) {
      setError(
        confirmError instanceof Error
          ? confirmError.message
          : "No se pudo confirmar el pedido.",
      );
    } finally {
      setBusyOrderId(null);
    }
  };

  const registerPayment = async (order: StaffOrder) => {
    const paymentMethodId =
      paymentSelections[order.id] ?? order.expectedPaymentMethodId;
    if (!paymentMethodId) {
      setError("Selecciona un método de pago.");
      return;
    }
    setBusyOrderId(order.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/orders/${order.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethodId }),
      });
      if (!response.ok) {
        throw new Error(
          await responseMessage(response, "No se pudo registrar el pago."),
        );
      }
      setNotice(`Pago del pedido #${order.id} registrado.`);
      await loadOrders();
    } catch (paymentError: unknown) {
      setError(
        paymentError instanceof Error
          ? paymentError.message
          : "No se pudo registrar el pago.",
      );
    } finally {
      setBusyOrderId(null);
    }
  };

  const printTicket = (orderId: number) => {
    setPrintMode("payment");
    setPrintOrderId(orderId);
    window.setTimeout(() => window.print(), 200);
  };

  const printKitchenTicket = (orderId: number) => {
    setPrintMode("kitchen");
    setPrintOrderId(orderId);
    window.setTimeout(() => window.print(), 200);
  };

  const savePreparationTime = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSavingSettings(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/orders/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preparationMinutes: Number(preparationMinutes),
        }),
      });
      if (!response.ok) {
        throw new Error(
          await responseMessage(
            response,
            "No se pudo guardar el tiempo de preparación.",
          ),
        );
      }
      setNotice("Tiempo global de preparación actualizado.");
      await loadOrders();
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar el tiempo de preparación.",
      );
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-red-700">
              Operación
            </p>
            <h1 className="mt-1 text-3xl font-bold text-stone-900">
              Cola de pedidos
            </h1>
            <p className="mt-2 text-stone-600">
              Prioridad manual; cuando coincide, se atiende primero el pedido
              más antiguo. La lista se actualiza cada 20 segundos y muestra
              avisos mientras esta pantalla permanece abierta.
            </p>
          </div>
          <a
            className="rounded-lg border border-stone-300 bg-white px-4 py-2 font-semibold text-stone-700 hover:bg-stone-50"
            href="/dashboard"
          >
            Volver al panel
          </a>
        </header>

        {isAdmin && (
          <form
            className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl bg-white p-5 shadow-sm"
            onSubmit={savePreparationTime}
          >
            <label className="text-sm font-semibold">
              Tiempo base de preparación (minutos)
              <input
                className="mt-1 block w-36 rounded-lg border border-stone-300 px-3 py-2"
                max={240}
                min={1}
                onChange={(event) => setPreparationMinutes(event.target.value)}
                required
                type="number"
                value={preparationMinutes}
              />
            </label>
            <button
              className="rounded-lg bg-stone-900 px-4 py-2.5 font-semibold text-white hover:bg-stone-700 disabled:opacity-60"
              disabled={isSavingSettings}
              type="submit"
            >
              {isSavingSettings ? "Guardando..." : "Guardar tiempo"}
            </button>
            <p className="basis-full text-sm text-stone-500">
              El ETA es aproximado: supone preparación secuencial y usa el mismo
              tiempo base para cada pedido.
            </p>
          </form>
        )}

        {error && (
          <p
            aria-live="polite"
            className="mt-5 rounded-xl bg-red-50 p-4 text-red-800"
            role="alert"
          >
            {error}
          </p>
        )}
        {notice && (
          <p
            aria-live="polite"
            className="mt-5 rounded-xl bg-emerald-50 p-4 text-emerald-800"
            role="status"
          >
            {notice}
          </p>
        )}
        {isLoading ? (
          <p className="mt-8 rounded-xl bg-white p-6 text-stone-600">
            Cargando pedidos...
          </p>
        ) : orders.length === 0 ? (
          <p className="mt-8 rounded-xl bg-white p-6 text-stone-600">
            No hay pedidos activos en este momento.
          </p>
        ) : (
          <section
            aria-label="Pedidos activos"
            className="mt-6 grid gap-4 lg:grid-cols-2"
          >
            {orders.map((order) => {
              const ageMinutes = Math.max(
                0,
                Math.floor(
                  (now - new Date(order.createdAt).getTime()) / 60_000,
                ),
              );
              const canEditPriority =
                order.status === "PENDIENTE_CONFIRMACION" ||
                order.status === "RECIBIDO" ||
                order.status === "EN_PREPARACION";
              const availableStatuses = nextStatuses(order);

              return (
                <article
                  className="rounded-2xl bg-white p-5 shadow-sm"
                  key={order.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-wide text-stone-500">
                        Pedido #{order.id}
                      </p>
                      <h2 className="mt-1 text-xl font-bold">
                        {order.customer.nombre}
                      </h2>
                      <a
                        className="text-sm text-stone-600 underline"
                        href={`tel:${encodeURIComponent(order.customer.telefono)}`}
                      >
                        {order.customer.telefono}
                      </a>
                    </div>
                    <span className="rounded-full bg-stone-100 px-3 py-1.5 text-sm font-semibold">
                      {statusLabels[order.status] ?? order.status}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                    <p>
                      <span className="text-stone-500">Espera:</span>{" "}
                      <strong>{ageMinutes} min</strong>
                    </p>
                    {["RECIBIDO", "EN_PREPARACION"].includes(order.status) && (
                      <p>
                        <span className="text-stone-500">ETA:</span>{" "}
                        <strong>aprox. {order.etaMinutes} min</strong>
                      </p>
                    )}
                    {order.status === "PENDIENTE_CONFIRMACION" && (
                      <p className="font-semibold text-amber-800">
                        Pendiente de aceptación; aún no inicia el ETA.
                      </p>
                    )}
                    <p>
                      <span className="text-stone-500">Entrega:</span>{" "}
                      {order.deliveryType === "DOMICILIO"
                        ? "Domicilio"
                        : order.deliveryType === "LOCAL"
                          ? "Local"
                          : "Recoger"}
                    </p>
                    <p>
                      <span className="text-stone-500">Total:</span>{" "}
                      <strong>{currency(order.total)}</strong>
                    </p>
                    <p>
                      <span className="text-stone-500">Pago:</span>{" "}
                      <strong>
                        {order.paidAt
                          ? `Pagado · ${order.paymentMethod ?? "método registrado"}`
                          : `Pendiente · previsto: ${order.expectedPaymentMethod ?? "sin seleccionar"}`}
                      </strong>
                    </p>
                    {order.paymentProof && !order.paidAt && (
                      <p className="mt-2 text-sm text-amber-900">
                        Comprobante adjunto el{" "}
                        {new Date(order.paymentProof.uploadedAt).toLocaleString(
                          "es-MX",
                        )}
                        . Caja debe validar el depósito antes de registrar el
                        pago.
                      </p>
                    )}
                  </div>
                  {order.deliveryAddress && (
                    <p className="mt-2 text-sm">
                      <span className="text-stone-500">Dirección:</span>{" "}
                      {order.deliveryAddress}
                    </p>
                  )}
                  <ul className="mt-4 space-y-1 border-t border-stone-100 pt-3 text-sm">
                    {order.items.map((item, index) => (
                      <li key={`${item.name}-${item.size ?? ""}-${index}`}>
                        {item.quantity} × {item.name}
                        {item.size ? ` · ${item.size}` : ""}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {order.status === "PENDIENTE_CONFIRMACION" && (
                      <>
                        <button
                          className="rounded-lg bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
                          disabled={busyOrderId === order.id}
                          onClick={() => void confirmOrder(order)}
                          type="button"
                        >
                          Confirmar, descontar stock e imprimir
                        </button>
                        <button
                          className="rounded-lg border border-red-300 px-4 py-2 font-semibold text-red-800 disabled:opacity-60"
                          disabled={busyOrderId === order.id}
                          onClick={() => {
                            if (
                              window.confirm(
                                `¿Rechazar y cancelar el pedido #${order.id}?`,
                              )
                            ) {
                              void updateOrder(order, { status: "CANCELADO" });
                            }
                          }}
                          type="button"
                        >
                          Rechazar pedido
                        </button>
                      </>
                    )}
                    {order.status !== "PENDIENTE_CONFIRMACION" &&
                      order.status !== "CANCELADO" && (
                        <button
                          className="rounded-lg border border-stone-300 px-4 py-2 font-semibold"
                          onClick={() => printKitchenTicket(order.id)}
                          type="button"
                        >
                          Imprimir comanda
                        </button>
                      )}
                    {order.paymentProof && !order.paidAt && (
                      <a
                        className="rounded-lg border border-blue-300 px-4 py-2 font-semibold text-blue-900"
                        href={`/api/orders/${order.id}/payment-proof`}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Revisar comprobante
                      </a>
                    )}
                    {order.paidAt && (
                      <button
                        className="rounded-lg border border-emerald-300 px-4 py-2 font-semibold text-emerald-900"
                        onClick={() => printTicket(order.id)}
                        type="button"
                      >
                        Imprimir ticket de pago
                      </button>
                    )}
                    {!order.paidAt &&
                      !["PENDIENTE_CONFIRMACION", "CANCELADO"].includes(
                        order.status,
                      ) && (
                        <div className="flex flex-wrap gap-2">
                          <select
                            aria-label={`Método de pago pedido ${order.id}`}
                            className="rounded-lg border border-stone-300 bg-white px-3 py-2"
                            onChange={(event) =>
                              setPaymentSelections((current) => ({
                                ...current,
                                [order.id]: Number(event.target.value),
                              }))
                            }
                            value={
                              paymentSelections[order.id] ??
                              order.expectedPaymentMethodId ??
                              ""
                            }
                          >
                            <option value="">Método de pago...</option>
                            {paymentMethods.map((method) => (
                              <option key={method.id} value={method.id}>
                                {method.name}
                              </option>
                            ))}
                          </select>
                          <button
                            className="rounded-lg border border-stone-300 px-4 py-2 font-semibold disabled:opacity-60"
                            disabled={busyOrderId === order.id}
                            onClick={() => void registerPayment(order)}
                            type="button"
                          >
                            {order.expectedPaymentMethod === "Transferencia"
                              ? "Confirmar transferencia recibida"
                              : "Registrar pago"}
                          </button>
                        </div>
                      )}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3 border-t border-stone-100 pt-4">
                    <label className="text-sm font-semibold">
                      Prioridad
                      <select
                        className="mt-1 block rounded-lg border border-stone-300 bg-white px-3 py-2"
                        disabled={!canEditPriority || busyOrderId === order.id}
                        onChange={(event) =>
                          void updateOrder(order, {
                            priority: event.target.value as OrderPriority,
                          })
                        }
                        value={
                          order.priority in priorityLabels
                            ? order.priority
                            : "NORMAL"
                        }
                      >
                        {Object.entries(priorityLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm font-semibold">
                      Actualizar estado
                      <select
                        className="mt-1 block rounded-lg border border-stone-300 bg-white px-3 py-2"
                        disabled={
                          availableStatuses.length === 0 ||
                          busyOrderId === order.id
                        }
                        onChange={(event) =>
                          void updateOrder(order, {
                            status: event.target.value as OrderStatus,
                          })
                        }
                        value=""
                      >
                        <option disabled value="">
                          Selecciona...
                        </option>
                        {availableStatuses.map((status) => (
                          <option key={status} value={status}>
                            {statusLabels[status]}
                          </option>
                        ))}
                      </select>
                    </label>
                    {busyOrderId === order.id && (
                      <span className="self-end pb-2 text-sm text-stone-500">
                        Guardando...
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
        {printOrderId !== null &&
          orders.some((order) => order.id === printOrderId) && (
            <section
              className="ticket-print"
              aria-label={
                printMode === "payment" ? "Ticket de pago" : "Comanda para cocina"
              }
            >
              {(() => {
                const order = orders.find((item) => item.id === printOrderId);
                if (!order) return null;
                return (
                  <div>
                    {printMode === "payment" ? (
                      <>
                        <h1>TICKET DE PAGO · #{order.id}</h1>
                        <p>Cliente: {order.customer.nombre}</p>
                        <p>
                          Fecha:{" "}
                          {order.paidAt
                            ? new Date(order.paidAt).toLocaleString("es-MX")
                            : "—"}
                        </p>
                        <p>
                          Método: {order.paymentMethod ?? "No especificado"}
                        </p>
                        <hr />
                        <ul>
                          {order.items.map((item, index) => (
                            <li key={`${item.name}-${item.size ?? ""}-${index}`}>
                              {item.quantity} × {item.name}
                              {item.size ? ` · ${item.size}` : ""}
                            </li>
                          ))}
                        </ul>
                        <hr />
                        <p>TOTAL PAGADO: {currency(order.total)}</p>
                      </>
                    ) : (
                      <>
                        <h1>COMANDA · PEDIDO #{order.id}</h1>
                        <p>
                          {new Date(order.createdAt).toLocaleString("es-MX")}
                        </p>
                        <p>
                          Entrega:{" "}
                          {order.deliveryType === "DOMICILIO"
                            ? "Domicilio"
                            : order.deliveryType === "LOCAL"
                              ? "Local"
                              : "Recoger"}
                        </p>
                        {order.deliveryAddress && <p>{order.deliveryAddress}</p>}
                        <hr />
                        <ul>
                          {order.items.map((item, index) => (
                            <li key={`${item.name}-${item.size ?? ""}-${index}`}>
                              <strong>{item.quantity} ×</strong> {item.name}
                              {item.size ? ` · ${item.size}` : ""}
                            </li>
                          ))}
                        </ul>
                        <hr />
                        <p>Total: {currency(order.total)}</p>
                      </>
                    )}
                  </div>
                );
              })()}
            </section>
          )}
      </div>
    </main>
  );
}
