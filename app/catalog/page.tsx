import { redirect } from "next/navigation";

import { CatalogManager } from "@/components/catalog/catalog-manager";
import { getAuthenticatedUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  return <CatalogManager role={user.role} />;
}
