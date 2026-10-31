
import Link from "next/link";
import { redirect } from "next/navigation";

import { PreparationQueue } from "@/components/orders/preparation-queue";
import { getAuthenticatedUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function OrderHistoryPage() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="planeta-screen min-h-screen bg-[#f4f6f9] text-[#25364b]">
      {/* Encabezado del maquetado */}
      <header className="border-b border-white/10 bg-[#25364b] text-white shadow-lg">
        <div className="mx-auto flex min-h-[88px] max-w-[1440px] flex-wrap items-center justify-between gap-5 px-5 py-5 sm:px-8 lg:px-12">
          <div className="flex flex-wrap items-center gap-x-10 gap-y-2">
            <Link
              href="/dashboard"
              className="text-2xl font-extrabold tracking-tight sm:text-3xl"
            >
              Pizzería Planeta
            </Link>

            <div className="border-l border-white/25 pl-5">
              <p className="text-lg font-bold sm:text-xl">
                Comandas
              </p>
              <p className="text-xs text-slate-300">
                Cola de preparación
              </p>
            </div>
          </div>

          <span className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-xs font-extrabold tracking-[0.18em]">
            COCINA
          </span>
        </div>
      </header>

      {/* Contenido principal */}
      <section className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link
              href="/dashboard"
              className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#52647a] transition hover:text-[#25364b]"
            >
              <span aria-hidden="true">←</span>
              Volver al panel
            </Link>

            <h1 className="text-3xl font-extrabold tracking-tight text-[#25364b] sm:text-4xl">
              Cola de preparación
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
              Orden automático por nivel de prioridad y tiempo de espera.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="text-sm font-semibold text-slate-600">
              Área de cocina
            </span>
          </div>
        </div>

        <PreparationQueue />
      </section>
    </main>
  );
}
