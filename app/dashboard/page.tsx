
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { getAuthenticatedUser } from "@/lib/auth/session";
import {
  getBrandLogo,
  getUserAvatar,
} from "@/repositories/ui-settings-repository";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  const [brandLogo, userAvatar] = await Promise.all([
    getBrandLogo(),
    getUserAvatar(user.id),
  ]);
  const isAdmin = user.role === "ADMIN";

  const menuItems = [
    { label: "Comandas", href: "/orders", show: true },
    { label: "Nueva venta", href: "/", show: true },
    { label: "Pagos", href: "/payment-settings", show: isAdmin },
    { label: "Inventario", href: "/inventory", show: isAdmin },
    { label: "Catálogo", href: "/catalog", show: true },
    { label: "Historial", href: "/orders/history", show: true },
    { label: "Usuarios", href: "/users", show: isAdmin },
    { label: "Configuración", href: "/admin/settings", show: isAdmin },
    { label: "Reportes", href: "/reports", show: isAdmin },
  ];

  return (
    <main className="planeta-screen min-h-screen bg-[#F2F4F7] text-[#26374D]">
      {/* Barra superior */}
      <header className="relative z-10 flex h-[68px] items-center justify-between bg-[#26374D] px-5 text-white shadow-md md:px-12">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/"
            aria-label="Ir al inicio"
            className="flex min-w-0 items-center"
          >
            {brandLogo ? (
              <Image
                src={brandLogo}
                alt="Logotipo de la pizzería"
                width={240}
                height={52}
                unoptimized
                className="max-h-11 w-auto max-w-[42vw] object-contain md:max-w-[260px]"
              />
            ) : (
              <span className="text-xl font-extrabold tracking-tight md:text-3xl">
                Pizzería Planeta
              </span>
            )}
          </Link>
          {isAdmin && (
            <Link
              href="/admin/settings"
              aria-label="Editar logotipo del panel"
              title="Editar logotipo"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-200 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="m15.5 5.5 3 3M4 20l4.5-1 10.8-10.8a2.1 2.1 0 0 0-3-3L5.5 16 4 20Z" />
              </svg>
            </Link>
          )}
        </div>

        <h1 className="absolute left-1/2 hidden -translate-x-1/2 text-2xl font-bold md:block">
          Panel operativo
        </h1>

        <Link
          href="/profile"
          aria-label={`Abrir perfil de ${user.name}`}
          className="flex items-center gap-3 rounded-xl p-1 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:gap-6"
        >
          <div className="text-right">
            <p className="text-sm font-bold uppercase md:text-base">
              {isAdmin ? "ADMINISTRADOR" : "CAJERO"}
            </p>
            <p className="hidden text-xs text-slate-300 sm:block">
              {user.name}
            </p>
          </div>

          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#D1D5DB] text-[#26374D]">
            {userAvatar ? (
              <Image
                src={userAvatar}
                alt=""
                width={44}
                height={44}
                unoptimized
                className="h-full w-full object-cover"
              />
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-10 w-10"
                aria-hidden="true"
              >
                <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.42 0-8 2.24-8 5v2h16v-2c0-2.76-3.58-5-8-5Z" />
              </svg>
            )}
          </div>
        </Link>
      </header>

      {/* Distribución principal */}
      <div className="grid min-h-[calc(100vh-68px)] grid-cols-1 gap-6 p-4 md:p-6 lg:grid-cols-[minmax(0,1fr)_250px] lg:gap-8 lg:px-8 lg:py-8">
        {/* Menú lateral */}
        <aside className="order-first flex flex-col rounded-3xl border border-[#D8E1EC] bg-white p-4 shadow-md lg:order-last lg:min-h-[calc(100vh-105px)] lg:p-5">
          <nav className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-2 lg:overflow-visible lg:pb-0">
            {menuItems
              .filter((item) => item.show)
              .map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex min-h-11 min-w-fit items-center justify-start rounded-lg border px-4 py-2.5 text-sm font-bold transition hover:bg-slate-50 lg:w-full ${
                    item.label === "Comandas"
                      ? "border-[#F2D1CB] bg-[#FDF1EE] text-[#B93A31]"
                      : "border-transparent bg-white text-[#26374D] hover:border-[#D8E1EC]"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
          </nav>

          <div className="mt-auto hidden pt-10 lg:block">
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="w-full rounded-lg border border-[#D8E1EC] px-4 py-3 text-sm font-bold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
              >
                Cerrar sesión
              </button>
            </form>
          </div>

          <form action="/api/auth/logout" method="post" className="mt-3 lg:hidden">
            <button
              type="submit"
              className="w-full rounded-lg border border-[#D8E1EC] px-4 py-3 text-sm font-bold text-slate-600 hover:bg-red-50 hover:text-red-700"
            >
              Cerrar sesión
            </button>
          </form>
        </aside>

        {/* Contenido del dashboard */}
        <section className="order-last min-w-0 lg:order-first">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">
              {isAdmin ? "Panel de administración" : "Panel de caja"}
              </p>
              <h2 className="mt-1 text-2xl font-extrabold md:text-3xl">
                Hola, {user.name}
              </h2>
            </div>
            <Link
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#D94B3D] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#B93A31]"
              href="/"
            >
              Nueva venta
            </Link>
          </div>

          <DashboardOverview />

          <footer className="px-2 py-4 text-xs text-slate-500">
            Pizzería Planeta · Sistema de gestión operativa
          </footer>
        </section>
      </div>
    </main>
  );
}
