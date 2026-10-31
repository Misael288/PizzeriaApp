import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ProfileSettings } from "@/components/profile/profile-settings";
import { getAuthenticatedUser } from "@/lib/auth/session";
import {
  getBrandLogo,
  getUserAvatar,
} from "@/repositories/ui-settings-repository";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const [brandLogo, avatar] = await Promise.all([
    getBrandLogo(),
    getUserAvatar(user.id),
  ]);

  return (
    <main className="planeta-screen min-h-screen bg-[#F2F4F7] px-4 py-6 text-[#26374D] sm:px-6 sm:py-9">
      <section className="mx-auto max-w-3xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/dashboard"
            aria-label="Volver al panel"
            className="flex min-h-11 items-center"
          >
            {brandLogo ? (
              <Image
                src={brandLogo}
                alt="Logotipo de la pizzería"
                width={220}
                height={48}
                unoptimized
                className="max-h-11 w-auto max-w-[55vw] object-contain"
              />
            ) : (
              <span className="text-xl font-extrabold tracking-tight">
                Pizzería Planeta
              </span>
            )}
          </Link>
          <Link
            className="font-semibold text-[#B93A31] hover:underline"
            href="/dashboard"
          >
            ← Volver al panel
          </Link>
        </header>

        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">
            Cuenta personal
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#25364B] sm:text-4xl">
            Mi perfil
          </h1>
          <p className="mt-2 text-slate-600">
            Administra tu foto de perfil y las credenciales de acceso.
          </p>
        </div>

        <ProfileSettings
          name={user.name}
          email={user.email}
          role={user.role}
          initialAvatar={avatar}
        />
      </section>
    </main>
  );
}
