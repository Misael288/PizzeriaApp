import Link from "next/link";
import { redirect } from "next/navigation";

import { ProfanitySettings } from "@/components/admin/profanity-settings";
import { ADMIN_ROLE, getAuthenticatedUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  if (user.role !== ADMIN_ROLE) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-8 sm:px-6">
      <section className="mx-auto max-w-4xl">
        <Link className="font-semibold text-red-700 hover:underline" href="/dashboard">
          ← Volver al panel
        </Link>
        <h1 className="mt-5 text-3xl font-bold text-stone-900">
          Configuración de administración
        </h1>
        <p className="mt-2 text-stone-600">
          Administra las palabras que no se permiten en los datos capturados.
        </p>
        <div className="mt-7">
          <ProfanitySettings />
        </div>
      </section>
    </main>
  );
}
