"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { TransferDetails } from "@/components/payments/transfer-details";
import { TrackingQr } from "@/components/orders/tracking-qr";
import type {
  PublicPaymentOptions,
  TransferAccountDetails,
} from "@/types/payments";

type MenuCategory = {
  id_categoria: number;
  nombre: string;
};

type MenuProduct = {
  id_producto: number;
  id_categoria: number;
  tipo_producto: "PIZZA" | "REFRESCO";
  nombre: string;
  descripcion: string | null;
  precio: string;
  imagen: string | null;
  disponible: boolean;
  categorias: { nombre: string };
  producto_tamanos: {
    id_tamano: number;
    precio: string;
    disponible: boolean;
    tamanos: { nombre: string };
  }[];
};

type ExtraIngredient = {
  id: number;
  name: string;
  description: string | null;
  unit: string;
  extraPrice: string;
  extraQuantity: string;
};

type CartLine = {
  key: string;
  productId: number;
  sizeId: number | null;
  name: string;
  sizeName: string | null;
  price: number;
  quantity: number;
  extraIngredientIds: number[];
};

type PublicMenuProps = {
  categories: MenuCategory[];
  products: MenuProduct[];
  paymentOptions: PublicPaymentOptions;
  extraIngredients: ExtraIngredient[];
  staffHref?: string | null;
};

type OrderConfirmation = {
  trackingUrl: string;
  total: string;
  etaMinutes: number | null;
  status: string;
};

const currency = (value: number): string =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value);

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

const isTransferAccountDetails = (
  value: unknown,
): value is TransferAccountDetails =>
  typeof value === "object" &&
  value !== null &&
  "bank" in value &&
  typeof value.bank === "string" &&
  "beneficiary" in value &&
  typeof value.beneficiary === "string" &&
  "clabe" in value &&
  typeof value.clabe === "string" &&
  "accountNumber" in value &&
  typeof value.accountNumber === "string" &&
  "instructions" in value &&
  typeof value.instructions === "string";

export function PublicMenu({
  categories,
  products,
  paymentOptions,
  extraIngredients,
  staffHref,
}: PublicMenuProps) {
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [selectedSizes, setSelectedSizes] = useState<Record<number, string>>(
    {},
  );
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedExtras, setSelectedExtras] = useState<Record<number, number[]>>(
    {},
  );
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [deliveryType, setDeliveryType] = useState<"DOMICILIO" | "RECOGER">(
    "DOMICILIO",
  );
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [transferDetails, setTransferDetails] =
    useState<TransferAccountDetails | null>(null);
  const [isLoadingTransferDetails, setIsLoadingTransferDetails] =
    useState(false);
  const [transferDetailsError, setTransferDetailsError] = useState("");
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<OrderConfirmation | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const visibleProducts = useMemo(
    () =>
      activeCategory === null
        ? products
        : products.filter(
            (product) => product.id_categoria === activeCategory,
          ),
    [activeCategory, products],
  );
  const total = cart.reduce(
    (sum, line) => sum + line.price * line.quantity,
    0,
  );
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const selectedPaymentMethod = paymentOptions.methods.find(
    (method) => method.id === Number(paymentMethodId),
  );

  useEffect(() => {
    if (selectedPaymentMethod?.name !== "Transferencia") {
      return;
    }

    const controller = new AbortController();
    void fetch("/api/payments/transfer", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            await responseMessage(
              response,
              "No fue posible cargar los datos de transferencia.",
            ),
          );
        }
        const result: unknown = await response.json();
        if (
          typeof result !== "object" ||
          result === null ||
          !("transfer" in result) ||
          !isTransferAccountDetails(result.transfer)
        ) {
          throw new Error("La respuesta de transferencia no es válida.");
        }
        setTransferDetails(result.transfer);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof Error && loadError.name === "AbortError") {
          return;
        }
        setTransferDetails(null);
        setTransferDetailsError(
          loadError instanceof Error
            ? loadError.message
            : "No fue posible cargar los datos de transferencia.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingTransferDetails(false);
      });

    return () => controller.abort();
  }, [selectedPaymentMethod?.name]);

  const addProduct = (product: MenuProduct) => {
    const sizeId = product.producto_tamanos.length
      ? Number(
          selectedSizes[product.id_producto] ??
            (product.producto_tamanos.find((size) => size.disponible) ??
              product.producto_tamanos[0]).id_tamano,
        )
      : null;
    const selectedSize = product.producto_tamanos.find(
      (size) => size.id_tamano === sizeId,
    );
    if (!product.disponible || (selectedSize && !selectedSize.disponible)) {
      setError("Ese producto o tamaño está agotado.");
      return;
    }
    const extras = selectedExtras[product.id_producto] ?? [];
    const key = `${product.id_producto}:${sizeId ?? "none"}:${extras
      .slice()
      .sort((left, right) => left - right)
      .join(",")}`;
    const extraPrice = extraIngredients
      .filter((ingredient) => extras.includes(ingredient.id))
      .reduce((sum, ingredient) => sum + Number(ingredient.extraPrice), 0);
    const price = Number(selectedSize?.precio ?? product.precio) + extraPrice;

    setCart((current) => {
      const existing = current.find((line) => line.key === key);
      if (existing) {
        return current.map((line) =>
          line.key === key
            ? { ...line, quantity: Math.min(line.quantity + 1, 50) }
            : line,
        );
      }
      return [
        ...current,
        {
          key,
          productId: product.id_producto,
          sizeId,
          name: product.nombre,
          sizeName: selectedSize?.tamanos.nombre ?? null,
          price,
          quantity: 1,
          extraIngredientIds: extras,
        },
      ];
    });
    setError("");
  };

  const changeQuantity = (key: string, quantity: number) => {
    setCart((current) =>
      quantity < 1
        ? current.filter((line) => line.key !== key)
        : current.map((line) =>
            line.key === key ? { ...line, quantity } : line,
          ),
    );
  };

  const submitOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          phone,
          deliveryType,
          deliveryAddress:
            deliveryType === "DOMICILIO" ? deliveryAddress : null,
          paymentMethodId: Number(paymentMethodId),
          items: cart.map((line) => ({
            productId: line.productId,
            sizeId: line.sizeId,
            quantity: line.quantity,
            extraIngredientIds: line.extraIngredientIds,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(
          await responseMessage(response, "No se pudo enviar el pedido."),
        );
      }
      const result = (await response.json()) as OrderConfirmation;
      setConfirmation(result);
      setCart([]);
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo enviar el pedido.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (confirmation) {
    return (
      <main className="min-h-screen bg-stone-100 px-4 py-10 sm:px-6">
        <section className="mx-auto max-w-2xl rounded-3xl bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-red-700">
            Pedido recibido
          </p>
          <h1 className="mt-3 text-3xl font-bold text-stone-900">
            ¡Gracias por tu pedido, {customerName}!
          </h1>
          <p className="mt-4 text-stone-600">
            Tu pedido está pendiente de confirmación por Caja.{" "}
            {confirmation.etaMinutes !== null
              ? `El tiempo estimado una vez confirmado es de ${confirmation.etaMinutes} min.`
              : "El tiempo estimado comenzará cuando Caja lo confirme."}{" "}
            Puedes consultar su estado desde este enlace.
          </p>
          <p className="mt-4 text-lg font-bold">
            Total del pedido: {currency(Number(confirmation.total))}
          </p>
          <div className="mt-6 inline-flex flex-col items-center rounded-xl border border-stone-200 bg-white p-4">
            <TrackingQr href={confirmation.trackingUrl} />
          </div>
          {selectedPaymentMethod?.name === "Transferencia" &&
            transferDetails && (
              <>
                <p className="mt-4 text-sm font-semibold text-blue-950">
                  Realiza la transferencia por el total indicado. El pago aún
                  no está confirmado.
                </p>
                <TransferDetails
                  transfer={transferDetails}
                  className="mt-3 text-left"
                />
              </>
            )}
          <Link
            className="mt-7 inline-flex rounded-xl bg-red-700 px-5 py-3 font-semibold text-white hover:bg-red-800"
            href={confirmation.trackingUrl}
          >
            Monitorear mi pedido
          </Link>
          <p className="mt-4 text-sm text-stone-500">
            Escanea el QR o guarda este enlace privado. No necesitas crear una
            cuenta.
            {selectedPaymentMethod?.name === "Transferencia" &&
              " Puedes adjuntar el comprobante opcionalmente desde el seguimiento; Caja confirmará el pago después de verificar el depósito."}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-100 text-stone-900">
      <header className="bg-[#071C3B] px-4 py-5 text-white sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-red-300">
              Menú digital
            </p>
            <h1 className="mt-1 text-2xl font-black sm:text-3xl">
              Pizzería Planeta
            </h1>
          </div>
          {staffHref ? (
            <Link
              className="rounded-lg border border-white/30 px-3 py-2 text-sm font-semibold hover:bg-white/10"
              href={staffHref}
            >
              Volver a mi panel
            </Link>
          ) : (
            <Link
              className="rounded-lg border border-white/30 px-3 py-2 text-sm font-semibold hover:bg-white/10"
              href="/login"
            >
              Acceso del personal
            </Link>
          )}
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section>
          <div className="mb-6">
            <h2 className="text-2xl font-bold">Elige tus favoritos</h2>
            <p className="mt-1 text-stone-600">
              Precios y disponibilidad sujetos a confirmación al enviar el
              pedido.
            </p>
          </div>
          <div className="mb-6 flex flex-wrap gap-2">
            <button
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                activeCategory === null
                  ? "bg-red-700 text-white"
                  : "bg-white text-stone-700 hover:bg-stone-200"
              }`}
              onClick={() => setActiveCategory(null)}
              type="button"
            >
              Todo
            </button>
            {categories.map((category) => (
              <button
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  activeCategory === category.id_categoria
                    ? "bg-red-700 text-white"
                    : "bg-white text-stone-700 hover:bg-stone-200"
                }`}
                key={category.id_categoria}
                onClick={() => setActiveCategory(category.id_categoria)}
                type="button"
              >
                {category.nombre}
              </button>
            ))}
          </div>

          {visibleProducts.length === 0 ? (
            <div className="rounded-2xl bg-white p-8 text-center text-stone-600">
              No hay productos disponibles en esta categoría por el momento.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleProducts.map((product) => (
                <article
                  className="overflow-hidden rounded-2xl bg-white shadow-sm"
                  key={product.id_producto}
                >
                  {product.imagen ? (
                    <Image
                      alt={product.nombre}
                      className="h-44 w-full object-cover"
                      height={360}
                      unoptimized
                      src={product.imagen}
                      width={640}
                    />
                  ) : (
                    <div className="flex h-44 items-center justify-center bg-red-50 text-5xl">
                      🍕
                    </div>
                  )}
                  <div className="p-5">
                    <p className="text-xs font-bold uppercase tracking-wide text-red-700">
                      {product.categorias.nombre}
                    </p>
                    <h3 className="mt-1 text-lg font-bold">{product.nombre}</h3>
                    {!product.disponible && (
                      <span className="mt-2 inline-flex rounded-full bg-stone-200 px-3 py-1 text-xs font-bold text-stone-700">
                        Agotada
                      </span>
                    )}
                    {product.descripcion && (
                      <p className="mt-2 min-h-10 text-sm text-stone-600">
                        {product.descripcion}
                      </p>
                    )}
                    {product.producto_tamanos.length > 0 ? (
                      <label className="mt-4 block text-sm font-semibold">
                        Tamaño
                        <select
                          className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
                          onChange={(event) =>
                            setSelectedSizes((current) => ({
                              ...current,
                              [product.id_producto]: event.target.value,
                            }))
                          }
                          value={
                            selectedSizes[product.id_producto] ??
                            String(product.producto_tamanos[0].id_tamano)
                          }
                        >
                          {product.producto_tamanos.map((size) => (
                            <option
                              key={size.id_tamano}
                              value={size.id_tamano}
                              disabled={!size.disponible}
                            >
                              {size.tamanos.nombre} ·{" "}
                              {currency(Number(size.precio))}
                              {!size.disponible ? " · Agotada" : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <p className="mt-4 font-bold">
                        {currency(Number(product.precio))}
                      </p>
                    )}
                    {product.tipo_producto === "PIZZA" &&
                      extraIngredients.length > 0 && (
                        <fieldset className="mt-4 rounded-lg border border-stone-200 p-3">
                          <legend className="px-1 text-sm font-semibold">
                            Ingredientes extra
                          </legend>
                          <div className="space-y-2">
                            {extraIngredients.map((ingredient) => (
                              <label
                                className="flex items-start gap-2 text-sm"
                                key={ingredient.id}
                              >
                                <input
                                  checked={(
                                    selectedExtras[product.id_producto] ?? []
                                  ).includes(ingredient.id)}
                                  className="mt-1"
                                  onChange={(event) =>
                                    setSelectedExtras((current) => {
                                      const selected =
                                        current[product.id_producto] ?? [];
                                      return {
                                        ...current,
                                        [product.id_producto]: event.target.checked
                                          ? [...selected, ingredient.id]
                                          : selected.filter(
                                              (id) => id !== ingredient.id,
                                            ),
                                      };
                                    })
                                  }
                                  type="checkbox"
                                />
                                <span>
                                  <span className="block font-medium">
                                    {ingredient.name} (+{" "}
                                    {currency(Number(ingredient.extraPrice))})
                                  </span>
                                  {ingredient.description && (
                                    <span className="block text-xs text-stone-500">
                                      {ingredient.description}
                                    </span>
                                  )}
                                </span>
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      )}
                    <button
                      className="mt-4 w-full rounded-lg bg-stone-900 px-4 py-2.5 font-semibold text-white hover:bg-stone-700"
                      disabled={!product.disponible}
                      onClick={() => addProduct(product)}
                      type="button"
                    >
                      {product.disponible ? "Agregar al pedido" : "Agotada"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="h-fit rounded-2xl bg-white p-5 shadow-sm lg:sticky lg:top-6">
          <h2 className="text-xl font-bold">Tu pedido ({itemCount})</h2>
          {cart.length === 0 ? (
            <p className="mt-4 text-sm text-stone-600">
              Agrega productos para comenzar.
            </p>
          ) : (
            <>
              <ul className="mt-4 space-y-3">
                {cart.map((line) => (
                  <li
                    className="flex items-start justify-between gap-3 border-b border-stone-100 pb-3"
                    key={line.key}
                  >
                    <div>
                      <p className="font-semibold">{line.name}</p>
                      {line.sizeName && (
                        <p className="text-sm text-stone-500">{line.sizeName}</p>
                      )}
                      <p className="text-sm">{currency(line.price)}</p>
                      {line.extraIngredientIds.length > 0 && (
                        <ul className="mt-1 text-xs text-stone-500">
                          {line.extraIngredientIds.map((id) => {
                            const extra = extraIngredients.find(
                              (ingredient) => ingredient.id === id,
                            );
                            return extra ? (
                              <li key={id}>
                                + {extra.name}
                                {extra.description
                                  ? ` — ${extra.description}`
                                  : ""}
                              </li>
                            ) : null;
                          })}
                        </ul>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        aria-label={`Quitar una unidad de ${line.name}`}
                        className="h-8 w-8 rounded-full border border-stone-300"
                        onClick={() =>
                          changeQuantity(line.key, line.quantity - 1)
                        }
                        type="button"
                      >
                        −
                      </button>
                      <span className="min-w-5 text-center">
                        {line.quantity}
                      </span>
                      <button
                        aria-label={`Agregar una unidad de ${line.name}`}
                        className="h-8 w-8 rounded-full border border-stone-300"
                        onClick={() =>
                          changeQuantity(line.key, Math.min(line.quantity + 1, 50))
                        }
                        type="button"
                      >
                        +
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-4 flex justify-between text-lg font-bold">
                <span>Total estimado</span>
                <span>{currency(total)}</span>
              </p>
              <p className="mt-1 text-xs text-stone-500">
                El total final se recalcula al confirmar el pedido.
              </p>

              <form className="mt-5 space-y-3" onSubmit={submitOrder}>
                <label className="block text-sm font-semibold">
                  Tu nombre
                  <input
                    autoComplete="name"
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-normal"
                    maxLength={150}
                    onChange={(event) => setCustomerName(event.target.value)}
                    required
                    value={customerName}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Teléfono
                  <input
                    autoComplete="tel"
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-normal"
                    maxLength={20}
                    onChange={(event) => setPhone(event.target.value)}
                    required
                    type="tel"
                    value={phone}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  ¿Cómo recibirás tu pedido?
                  <select
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 font-normal"
                    onChange={(event) =>
                      setDeliveryType(
                        event.target.value as "DOMICILIO" | "RECOGER",
                      )
                    }
                    value={deliveryType}
                  >
                    <option value="DOMICILIO">Entrega a domicilio</option>
                    <option value="RECOGER">Recoger en sucursal</option>
                  </select>
                </label>
                {deliveryType === "DOMICILIO" && (
                  <label className="block text-sm font-semibold">
                    Dirección de entrega
                    <textarea
                      autoComplete="street-address"
                      className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-normal"
                      maxLength={300}
                      onChange={(event) =>
                        setDeliveryAddress(event.target.value)
                      }
                      required
                      rows={2}
                      value={deliveryAddress}
                    />
                  </label>
                )}
                <label className="block text-sm font-semibold">
                  Método de pago previsto
                  <select
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 font-normal"
                    onChange={(event) => {
                      const nextMethod = paymentOptions.methods.find(
                        (method) => method.id === Number(event.target.value),
                      );
                      setPaymentMethodId(event.target.value);
                      setTransferDetails(null);
                      setTransferDetailsError("");
                      setIsLoadingTransferDetails(
                        nextMethod?.name === "Transferencia",
                      );
                    }}
                    required
                    value={paymentMethodId}
                  >
                    <option value="">Selecciona un método...</option>
                    {paymentOptions.methods.map((method) => (
                      <option
                        disabled={!method.enabled}
                        key={method.id}
                        value={method.id}
                      >
                        {method.name}
                        {!method.enabled ? " · No configurado" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedPaymentMethod?.name === "Transferencia" &&
                  (transferDetails ? (
                    <>
                      <p className="text-sm font-semibold text-blue-950">
                        Transfiere el total estimado de {currency(total)}. El
                        importe final se valida al enviar el pedido.
                      </p>
                      <TransferDetails
                        transfer={transferDetails}
                        className="rounded-xl bg-blue-50 p-4 text-sm text-blue-950"
                      />
                      <p className="text-xs text-stone-600">
                        El envío del pedido no confirma el pago. Caja verificará
                        la transferencia; podrás adjuntar el comprobante desde
                        el enlace de seguimiento.
                      </p>
                    </>
                  ) : isLoadingTransferDetails ? (
                    <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
                      Cargando datos de transferencia...
                    </p>
                  ) : (
                    <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                      {transferDetailsError ||
                        "La transferencia aún no está configurada por la administración."}
                    </p>
                  ))}
                {error && (
                  <p
                    aria-live="polite"
                    className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
                    role="alert"
                  >
                    {error}
                  </p>
                )}
                <button
                  className="w-full rounded-lg bg-red-700 px-4 py-3 font-bold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={
                    isSubmitting ||
                    cart.length === 0 ||
                    !selectedPaymentMethod?.enabled ||
                    (selectedPaymentMethod.name === "Transferencia" &&
                      !transferDetails)
                  }
                  type="submit"
                >
                  {isSubmitting ? "Enviando..." : "Confirmar pedido"}
                </button>
              </form>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
