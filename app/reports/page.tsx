import Link from "next/link";
import { redirect } from "next/navigation";

import { SalesReport } from "@/components/reports/sales-report";
import { ADMIN_ROLE, getAuthenticatedUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  if (user.role !== ADMIN_ROLE) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-8 sm:px-6">
      <section className="mx-auto max-w-6xl">
        <Link
          className="font-semibold text-red-700 hover:underline"
          href="/dashboard"
        >
          ← Volver al panel
        </Link>
        <h1 className="mt-5 text-3xl font-bold text-stone-900">
          Reporte de ventas
        </h1>
        <p className="mb-7 mt-2 text-stone-600">
          Solo incluye pedidos con pago registrado. El resumen abarca todo el
          periodo y el detalle muestra como máximo los 100 pagos más recientes.
        </p>
        <SalesReport />
      </section>
    </main>
  );
}
