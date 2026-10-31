import Link from "next/link";
import { redirect } from "next/navigation";

import { StaffUserManager } from "@/components/users/staff-user-manager";
import { ADMIN_ROLE, getAuthenticatedUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  if (user.role !== ADMIN_ROLE) redirect("/dashboard");

  return (
    <main className="planeta-screen min-h-screen bg-stone-100 px-4 py-8 sm:px-6">
      <section className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link
            className="text-xl font-extrabold tracking-tight text-[#25364B]"
            href="/"
          >
            Pizzería Planeta
          </Link>
          <Link
            className="font-semibold text-red-700 hover:underline"
            href="/dashboard"
          >
            ← Volver al panel
          </Link>
        </header>
        <h1 className="text-3xl font-extrabold tracking-tight text-stone-900 sm:text-4xl">
          Usuarios y accesos
        </h1>
        <p className="mt-2 text-stone-600">
          Administra cuentas de administración y caja. Las cuentas de cocina
          no son necesarias: las comandas se imprimen desde Caja.
        </p>
        <div className="mt-7">
          <StaffUserManager />
        </div>
      </section>
    </main>
  );
}
