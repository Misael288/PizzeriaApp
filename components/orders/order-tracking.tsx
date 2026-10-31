"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { TrackingQr } from "@/components/orders/tracking-qr";
import { TransferDetails } from "@/components/payments/transfer-details";
import type { TransferAccountDetails } from "@/types/payments";

type TrackedOrder = {
  status: string;
  deliveryType: string;
  createdAt: string;
  total: string;
  etaMinutes: number | null;
  paymentMethod: string | null;
  transfer: TransferAccountDetails | null;
  paidAt: string | null;
  paidMethod: string | null;
  proofUploaded: boolean;
  proofUploadedAt: string | null;
  items: {
    name: string;
    size: string | null;
    quantity: number;
    unitPrice: string;
    extras: { name: string; description: string | null }[];
  }[];
};

type OrderTrackingProps = {
  token: string;
};

const statusLabels: Record<string, string> = {
  PENDIENTE_CONFIRMACION: "Pendiente de confirmación",
  RECIBIDO: "Pedido recibido",
  EN_PREPARACION: "En preparación",
  LISTO: "Listo",
  EN_CAMINO: "En camino",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado",
};

const currency = (value: string): string =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value));

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
  return "No se pudo consultar el pedido.";
};

export function OrderTracking({ token }: OrderTrackingProps) {
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [proof, setProof] = useState<File | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofMessage, setProofMessage] = useState("");
  const [proofError, setProofError] = useState("");

  useEffect(() => {
    let isCurrent = true;
    let timer: ReturnType<typeof setTimeout>;
    let isFetching = false;

    const refresh = async () => {
      if (!isCurrent || isFetching) return;
      isFetching = true;
      clearTimeout(timer);
      try {
        const response = await fetch(
          `/api/orders/track/${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          throw new Error(await responseMessage(response));
        }
        const result = (await response.json()) as TrackedOrder;
        if (isCurrent) {
          setOrder(result);
          setError("");
        }
      } catch (loadError: unknown) {
        if (isCurrent) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No se pudo consultar el pedido.",
          );
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
          if (document.visibilityState === "visible") {
            timer = setTimeout(() => void refresh(), 10_000);
          }
        }
        isFetching = false;
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        void refresh();
      } else {
        clearTimeout(timer);
      }
    };

    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);
    void refresh();
    return () => {
      isCurrent = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
    };
  }, [token]);

  const uploadProof = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!proof) {
      setProofError("Selecciona un archivo JPG, PNG o PDF.");
      return;
    }
    if (proof.size > 5 * 1024 * 1024) {
      setProofError("El comprobante no puede superar 5 MB.");
      return;
    }
    setUploadingProof(true);
    setProofError("");
    setProofMessage("");
    try {
      const formData = new FormData();
      formData.append("proof", proof);
      const response = await fetch(
        `/api/orders/track/${encodeURIComponent(token)}/proof`,
        { method: "POST", body: formData },
      );
      if (!response.ok) throw new Error(await responseMessage(response));
      const result = (await response.json()) as { createdAt: string };
      setOrder((current) =>
        current
          ? {
              ...current,
              proofUploaded: true,
              proofUploadedAt: result.createdAt,
            }
          : current,
      );
      setProof(null);
      event.currentTarget.reset();
      setProofMessage(
        "Comprobante recibido. El pago seguirá pendiente hasta que Caja verifique la transferencia.",
      );
    } catch (uploadError: unknown) {
      setProofError(
        uploadError instanceof Error
          ? uploadError.message
          : "No fue posible adjuntar el comprobante.",
      );
    } finally {
      setUploadingProof(false);
    }
  };

  return (
    <main className="planeta-screen min-h-screen bg-stone-100 px-4 py-10 sm:px-6">
      <section className="mx-auto max-w-2xl rounded-3xl bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-red-700">
          Pizzería Planeta · Seguimiento privado
        </p>
        <h1 className="mt-2 text-3xl font-bold text-stone-900">
          Estado de tu pedido
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          Esta página se actualiza automáticamente cada 10 segundos y al volver
          a abrir la pestaña.
        </p>

        {isLoading && (
          <p className="mt-8 rounded-xl bg-stone-50 p-5 text-stone-600">
            Consultando pedido...
          </p>
        )}
        {error && (
          <div
            aria-live="polite"
            className="mt-8 rounded-xl bg-red-50 p-5 text-red-800"
            role="alert"
          >
            {error}
          </div>
        )}
        {order && (
          <>
            {order.paidAt && (
              <button
                className="mt-6 rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800"
                onClick={() => window.print()}
                type="button"
              >
                Imprimir o guardar ticket como PDF
              </button>
            )}
            <div className="mt-8 rounded-2xl bg-stone-50 p-5">
              <p className="text-sm text-stone-600">Estado actual</p>
              <p className="mt-1 text-2xl font-bold text-stone-900">
                {statusLabels[order.status] ?? order.status}
              </p>
              {order.status === "PENDIENTE_CONFIRMACION" ? (
                <p className="mt-3 text-amber-800">
                  Caja está revisando tu pedido. El tiempo estimado comenzará
                  cuando lo confirme.
                </p>
              ) : ["RECIBIDO", "EN_PREPARACION"].includes(order.status) ? (
                <p className="mt-3 text-red-800">
                  Tiempo aproximado para estar listo:{" "}
                  <strong>{order.etaMinutes ?? 0} min</strong>
                </p>
              ) : order.status === "LISTO" ? (
                <p className="mt-3 font-semibold text-emerald-800">
                  Tu pedido está listo.
                </p>
              ) : null}
              <p className="mt-2 text-sm text-stone-500">
                Estimación orientativa; puede cambiar según la operación de
                cocina.
              </p>
            </div>

            <section className="mt-6 rounded-2xl border border-stone-200 p-5">
              <h2 className="font-bold">Pago</h2>
              <p className="mt-1 text-sm text-stone-700">
                Método previsto: {order.paymentMethod ?? "No especificado"}
              </p>
              {order.paymentMethod === "Transferencia" && order.transfer && (
                <TransferDetails
                  className="mt-4 rounded-lg bg-blue-50 p-4 text-sm text-blue-950"
                  transfer={order.transfer}
                />
              )}
              {order.paidAt ? (
                <p className="mt-2 text-sm font-semibold text-emerald-800">
                  Pago confirmado por Caja mediante{" "}
                  {order.paidMethod ?? "el método registrado"} el{" "}
                  {new Date(order.paidAt).toLocaleString("es-MX")}.
                </p>
              ) : (
                <p className="mt-2 text-sm text-amber-800">
                  El pedido aún no está pagado. Caja confirmará la recepción
                  del pago.
                </p>
              )}
              {order.paymentMethod === "Transferencia" &&
                !order.paidAt &&
                order.status !== "CANCELADO" && (
                  <div className="mt-4">
                    <p className="text-sm text-stone-700">
                      {order.proofUploaded
                        ? `Comprobante adjunto${order.proofUploadedAt ? ` el ${new Date(order.proofUploadedAt).toLocaleString("es-MX")}` : ""}. Puedes reemplazarlo antes de que Caja confirme el pago.`
                        : "Puedes adjuntar un comprobante opcional para agilizar la verificación."}
                    </p>
                    <form
                      className="mt-3 flex flex-wrap items-end gap-3"
                      onSubmit={(event) => void uploadProof(event)}
                    >
                      <label className="grid gap-1 text-sm font-medium">
                        Comprobante (JPG, PNG o PDF; máximo 5 MB)
                        <input
                          accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                          className="max-w-full rounded-lg border border-stone-300 px-3 py-2"
                          onChange={(event) =>
                            setProof(event.target.files?.[0] ?? null)
                          }
                          required
                          type="file"
                        />
                      </label>
                      <button
                        className="rounded-lg bg-stone-900 px-4 py-2 font-semibold text-white disabled:opacity-60"
                        disabled={uploadingProof}
                        type="submit"
                      >
                        {uploadingProof
                          ? "Adjuntando..."
                          : order.proofUploaded
                            ? "Reemplazar comprobante"
                            : "Adjuntar comprobante"}
                      </button>
                    </form>
                    {proofError && (
                      <p className="mt-3 text-sm text-red-800" role="alert">
                        {proofError}
                      </p>
                    )}
                    {proofMessage && (
                      <p className="mt-3 text-sm text-green-800" role="status">
                        {proofMessage}
                      </p>
                    )}
                  </div>
                )}
            </section>

            <div className="mt-7">
              <h2 className="text-lg font-bold">Resumen del pedido</h2>
              <p className="mt-1 text-sm text-stone-600">
                {order.deliveryType === "DOMICILIO"
                  ? "Entrega a domicilio"
                  : order.deliveryType === "LOCAL"
                    ? "Consumo local"
                    : "Recoger en sucursal"}
              </p>
              <ul className="mt-4 divide-y divide-stone-100">
                {order.items.map((item, index) => (
                  <li
                    className="flex justify-between gap-4 py-3"
                    key={`${item.name}-${item.size ?? ""}-${index}`}
                  >
                    <span>
                      {item.quantity} × {item.name}
                      {item.size ? ` · ${item.size}` : ""}
                      {item.extras.length > 0 && (
                        <ul className="mt-1 text-xs text-stone-500">
                          {item.extras.map((extra) => (
                            <li key={extra.name}>
                              + {extra.name}
                              {extra.description ? ` — ${extra.description}` : ""}
                            </li>
                          ))}
                        </ul>
                      )}
                    </span>
                    <span className="whitespace-nowrap">
                      {currency(
                        String(Number(item.unitPrice) * item.quantity),
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 flex justify-between border-t border-stone-200 pt-4 font-bold">
                <span>Total</span>
                <span>{currency(order.total)}</span>
              </p>
            </div>

            {order.paidAt && (
              <section
                aria-label="Ticket de pago"
                className="ticket-print"
              >
                <h1>TICKET DE PAGO</h1>
                <p>Fecha del pedido: {new Date(order.createdAt).toLocaleString("es-MX")}</p>
                <p>Fecha de pago: {new Date(order.paidAt).toLocaleString("es-MX")}</p>
                <p>Método: {order.paidMethod ?? "No especificado"}</p>
                <hr />
                <ul>
                  {order.items.map((item, index) => (
                    <li key={`${item.name}-${item.size ?? ""}-${index}`}>
                      {item.quantity} × {item.name}
                      {item.size ? ` · ${item.size}` : ""}
                      {item.extras.map((extra) => (
                        <span className="block" key={extra.name}>
                          + {extra.name}
                          {extra.description ? ` — ${extra.description}` : ""}
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
                <hr />
                <p>TOTAL PAGADO: {currency(order.total)}</p>
                <TrackingQr
                  className="mt-5 inline-flex flex-col items-center"
                  href={`/pedido/seguimiento/${encodeURIComponent(token)}`}
                />
              </section>
            )}
          </>
        )}

        <Link
          className="mt-8 inline-flex rounded-lg border border-stone-300 px-4 py-2 font-semibold text-stone-700 hover:bg-stone-50"
          href="/"
        >
          Volver al menú
        </Link>
      </section>
    </main>
  );
}
