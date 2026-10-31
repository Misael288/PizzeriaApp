import Link from "next/link";
import { redirect } from "next/navigation";

import { ProfanitySettings } from "@/components/admin/profanity-settings";
import { ADMIN_ROLE, getAuthenticatedUser } from "@/lib/auth/session";
import { BrandingSettings } from "@/components/admin/branding-settings";
import { getBrandLogo } from "@/repositories/ui-settings-repository";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  if (user.role !== ADMIN_ROLE) redirect("/dashboard");
  const brandLogo = await getBrandLogo();

  return (
    <main className="planeta-screen min-h-screen bg-stone-100 px-4 py-8 sm:px-6">
      <section className="mx-auto max-w-4xl">
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
          Configuración de administración
        </h1>
        <p className="mt-2 text-stone-600">
          Administra la identidad visual y las opciones de seguridad del panel.
        </p>
        <div className="mt-7">
          <div className="space-y-6">
            <BrandingSettings initialLogo={brandLogo} />
            <section>
              <h2 className="mb-3 text-xl font-extrabold text-[#25364B]">
                Palabras restringidas
              </h2>
              <ProfanitySettings />
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
