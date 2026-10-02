import "bootstrap/dist/css/bootstrap.min.css";

import { redirect } from "next/navigation";

import { getAuthenticatedUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function CatalogLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  return children;
}
