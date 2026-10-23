
import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthenticatedUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  const isAdmin = user.role === "ADMIN";

  const menuItems = [
    { label: "Comandas", href: "/orders", show: true },
    { label: "Nueva venta", href: "/orders", show: true },
    { label: "Pagos", href: "/payment-settings", show: isAdmin },
    { label: "Inventario", href: "/inventory", show: isAdmin },
    { label: "Catálogo", href: "/catalog", show: true },
    { label: "Historial", href: "/orders/history", show: true },
    { label: "Usuarios", href: "/users", show: isAdmin },
    { label: "Reportes", href: "/reports", show: isAdmin },
  ];

  const cards = [
    {
      title: "Pedidos",
      value: "Comandas",
      description: "Consulta y administra los pedidos.",
      href: "/orders",
      button: "VER",
      color: "bg-[#3282F6]",
    },
    {
      title: "Productos",
      value: "Catálogo",
      description: isAdmin
        ? "Administra categorías y productos."
        : "Consulta los productos disponibles.",
      href: "/catalog",
      button: "VER",
      color: "bg-[#3282F6]",
    },
    ...(isAdmin
      ? [
          {
            title: "Inventario",
            value: "Ingredientes y recetas",
            description: "Consulta y administra las existencias.",
            href: "/inventory",
            button: "VER",
            color: "bg-[#3282F6]",
          },
          {
            title: "Administración",
            value: "Usuarios y reportes",
            description: "Gestiona accesos y consulta reportes.",
            href: "/users",
            button: "VER",
            color: "bg-[#3282F6]",
          },
        ]
      : [
          {
            title: "Historial",
            value: "Pedidos anteriores",
            description: "Consulta el historial de pedidos.",
            href: "/orders/history",
            button: "VER",
            color: "bg-[#3282F6]",
          },
          {
            title: "Sesión",
            value: "Caja activa",
            description: "Tu sesión está iniciada correctamente.",
            href: "/orders",
            button: "ENTRAR",
            color: "bg-[#39D878]",
          },
        ]),
  ];

  return (
    <main className="min-h-screen bg-[#F2F4F7] text-[#26374D]">
      {/* Barra superior */}
      <header className="relative z-10 flex h-[68px] items-center justify-between bg-[#26374D] px-5 text-white shadow-md md:px-12">
        <Link
          href="/"
          className="text-xl font-extrabold tracking-tight md:text-3xl"
        >
          Pizzería Planeta
        </Link>

        <h1 className="absolute left-1/2 hidden -translate-x-1/2 text-2xl font-bold md:block">
          Panel operativo
        </h1>

        <div className="flex items-center gap-3 md:gap-6">
          <div className="text-right">
            <p className="text-sm font-bold uppercase md:text-base">
              {isAdmin ? "ADMINISTRADOR" : "CAJERO"}
            </p>
            <p className="hidden text-xs text-slate-300 sm:block">
              {user.name}
            </p>
          </div>

          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#D1D5DB] text-[#26374D]">
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-10 w-10"
              aria-hidden="true"
            >
              <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.42 0-8 2.24-8 5v2h16v-2c0-2.76-3.58-5-8-5Z" />
            </svg>
          </div>
        </div>
      </header>

      {/* Distribución principal */}
      <div className="grid min-h-[calc(100vh-68px)] grid-cols-1 gap-6 p-4 md:p-6 lg:grid-cols-[245px_minmax(0,1fr)] lg:gap-9 lg:px-8 lg:py-8">
        {/* Menú lateral */}
        <aside className="flex flex-col rounded-[32px] border border-[#D8E1EC] bg-white p-5 shadow-md lg:min-h-[calc(100vh-105px)] lg:px-6 lg:py-12">
          <nav className="flex gap-3 overflow-x-auto pb-2 lg:flex-col lg:gap-7 lg:overflow-visible lg:pb-0">
            {menuItems
              .filter((item) => item.show)
              .map((item, index) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex min-h-[52px] min-w-fit items-center justify-center rounded-xl border px-5 py-3 text-sm font-bold shadow-md transition hover:-translate-y-0.5 hover:shadow-lg lg:w-full ${
                    index === 0
                      ? "border-[#E8F0FE] bg-[#E8F0FE] text-blue-600"
                      : "border-[#D8E1EC] bg-white text-[#263238] hover:bg-slate-50"
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
                className="w-full rounded-xl border border-[#D8E1EC] px-4 py-3 text-sm font-bold text-slate-600 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
              >
                Cerrar sesión
              </button>
            </form>
          </div>

          <form action="/api/auth/logout" method="post" className="mt-4 lg:hidden">
            <button
              type="submit"
              className="w-full rounded-xl border border-[#D8E1EC] px-4 py-3 text-sm font-bold text-slate-600 shadow-sm hover:bg-red-50 hover:text-red-700"
            >
              Cerrar sesión
            </button>
          </form>
        </aside>

        {/* Contenido del dashboard */}
        <section className="min-w-0">
          {/* Título compacto */}
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">
              {isAdmin ? "Panel de administración" : "Panel de caja"}
            </p>
            <h2 className="mt-1 text-2xl font-extrabold md:text-3xl">
              Hola, {user.name}
            </h2>
          </div>

          {/* Tarjetas superiores, como en la referencia */}
          <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
            <Link
              href="/orders"
              className="min-h-[86px] rounded-2xl border border-[#D8E1EC] bg-white px-5 py-4 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <p className="text-sm text-[#64748B]">Operación</p>
              <p className="mt-1 text-lg font-extrabold md:text-xl">
                Comandas
              </p>
            </Link>

            <Link
              href="/catalog"
              className="min-h-[86px] rounded-2xl border border-[#D8E1EC] bg-white px-5 py-4 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <p className="text-sm text-[#64748B]">Menú</p>
              <p className="mt-1 text-lg font-extrabold md:text-xl">
                Productos
              </p>
            </Link>

            <Link
              href={isAdmin ? "/inventory" : "/orders/history"}
              className="min-h-[86px] rounded-2xl border border-[#D8E1EC] bg-white px-5 py-4 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <p className="text-sm text-[#64748B]">
                {isAdmin ? "Control" : "Consultas"}
              </p>
              <p className="mt-1 text-lg font-extrabold md:text-xl">
                {isAdmin ? "Inventario" : "Historial"}
              </p>
            </Link>

            <div className="min-h-[86px] rounded-2xl border border-[#D8E1EC] bg-white px-5 py-4 shadow-md">
              <p className="text-sm text-[#64748B]">Usuario</p>
              <p className="mt-1 truncate text-lg font-extrabold md:text-xl">
                {isAdmin ? "Administrador" : "Cajero"}
              </p>
            </div>
          </div>

          {/* Panel central grande */}
          <div className="min-h-[480px] rounded-[48px] border border-[#D8E1EC] bg-white p-4 shadow-md sm:p-6 md:min-h-[540px] md:p-8 lg:p-10">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-extrabold md:text-2xl">
                  Accesos del sistema
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Selecciona una opción para continuar.
                </p>
              </div>

              <span className="w-fit rounded-full bg-[#E8F0FE] px-4 py-2 text-xs font-bold text-blue-700">
                {isAdmin ? "MODO ADMINISTRADOR" : "MODO CAJERO"}
              </span>
            </div>

            <div className="space-y-5">
              {cards.map((card) => (
                <div
                  key={card.title}
                  className="flex flex-col gap-4 rounded-xl border border-[#D8E1EC] bg-white px-5 py-4 shadow-md transition hover:shadow-lg sm:flex-row sm:items-center sm:justify-between md:px-6"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-500">
                      {card.title}
                    </p>
                    <p className="mt-1 truncate text-base font-bold text-[#26374D] md:text-lg">
                      {card.value}
                    </p>
                  </div>

                  <p className="hidden flex-1 text-sm text-slate-500 md:block">
                    {card.description}
                  </p>

                  <Link
                    href={card.href}
                    className={`inline-flex min-w-[100px] items-center justify-center rounded-xl px-6 py-3 text-sm font-extrabold text-white shadow-md transition hover:brightness-95 ${card.color}`}
                  >
                    {card.button}
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* Pie de página */}
          <footer className="px-2 py-3 text-xs text-slate-500">
            Pizzería Planeta · Sistema de gestión operativa
          </footer>
        </section>
      </div>
    </main>
  );
}
