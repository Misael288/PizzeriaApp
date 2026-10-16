import { redirect } from "next/navigation";
import Link from "next/link";

import { getAuthenticatedUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-stone-100 px-6 py-10">
      <section className="mx-auto max-w-5xl rounded-2xl bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-700">
          {user.role === "ADMIN" ? "Panel de administración" : "Panel de caja"}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-stone-900">
          Hola, {user.name}
        </h1>
        <p className="mt-3 text-stone-600">
          Sesión iniciada como {user.role === "ADMIN" ? "Administrador Principal" : "Cajero"}.
        </p>
        <nav className="mt-6 flex flex-wrap gap-3">
          <Link
            className="inline-flex rounded-lg bg-red-700 px-4 py-2 font-semibold text-white hover:bg-red-800"
            href="/orders"
          >
            Ver cola de pedidos
          </Link>
          {user.role === "ADMIN" && (
            <>
              <Link
                className="inline-flex rounded-lg border border-stone-300 px-4 py-2 font-semibold text-stone-700 hover:bg-stone-50"
                href="/inventory"
              >
                Inventario y recetas
              </Link>
              <Link
                className="inline-flex rounded-lg border border-stone-300 px-4 py-2 font-semibold text-stone-700 hover:bg-stone-50"
                href="/users"
              >
                Usuarios y accesos
              </Link>
              <Link
                className="inline-flex rounded-lg border border-stone-300 px-4 py-2 font-semibold text-stone-700 hover:bg-stone-50"
                href="/reports"
              >
                Reportes de ventas
              </Link>
              <Link
                className="inline-flex rounded-lg border border-stone-300 px-4 py-2 font-semibold text-stone-700 hover:bg-stone-50"
                href="/payment-settings"
              >
                Configurar transferencia
              </Link>
            </>
          )}
          <Link
            className="inline-flex rounded-lg border border-stone-300 px-4 py-2 font-semibold text-stone-700 hover:bg-stone-50"
            href="/catalog"
          >
            {user.role === "ADMIN"
              ? "Administrar categorías y productos"
              : "Consultar productos disponibles"}
          </Link>
          <Link
            className="inline-flex rounded-lg border border-stone-300 px-4 py-2 font-semibold text-stone-700 hover:bg-stone-50"
            href="/"
          >
            Ver menú público
          </Link>
          <Link
            className="inline-flex rounded-lg border border-stone-300 px-4 py-2 font-semibold text-stone-700 hover:bg-stone-50"
            href="/orders/history"
          >
            Historial de pedidos
          </Link>
        </nav>
        <form action="/api/auth/logout" method="post" className="mt-8">
          <button className="rounded-lg border border-stone-300 px-4 py-2 font-medium text-stone-700 hover:bg-stone-50">
            Cerrar sesión
          </button>
        </form>
      </section>
    </main>
  );
}
