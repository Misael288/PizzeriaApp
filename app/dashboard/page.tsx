import { redirect } from "next/navigation";

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
          Panel de administración
        </p>
        <h1 className="mt-2 text-3xl font-bold text-stone-900">
          Hola, {user.name}
        </h1>
        <p className="mt-3 text-stone-600">
          Sesión iniciada como {user.role === "ADMIN" ? "Administrador Principal" : "Cajero"}.
        </p>
        <a
          className="mt-6 inline-flex rounded-lg bg-red-700 px-4 py-2 font-semibold text-white hover:bg-red-800"
          href="/catalog"
        >
          {user.role === "ADMIN"
            ? "Administrar categorías y productos"
            : "Consultar productos disponibles"}
        </a>
        <form action="/api/auth/logout" method="post" className="mt-8">
          <button className="rounded-lg border border-stone-300 px-4 py-2 font-medium text-stone-700 hover:bg-stone-50">
            Cerrar sesión
          </button>
        </form>
      </section>
    </main>
  );
}
