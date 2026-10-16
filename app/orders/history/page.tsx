import Link from "next/link";
import { redirect } from "next/navigation";

import { OrderHistory } from "@/components/orders/order-history";
import { getAuthenticatedUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function OrderHistoryPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-8 sm:px-6">
      <section className="mx-auto max-w-5xl">
        <Link
          className="font-semibold text-red-700 hover:underline"
          href="/dashboard"
        >
          ← Volver al panel
        </Link>
        <h1 className="mt-5 text-3xl font-bold text-stone-900">
          Historial de pedidos
        </h1>
        <p className="mb-7 mt-2 text-stone-600">
          Pedidos recientes, detalle de productos y cambios de estado.
        </p>
        <OrderHistory />
      </section>
    </main>
  );
}
