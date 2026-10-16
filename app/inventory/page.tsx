import { redirect } from "next/navigation";

import { InventoryManager } from "@/components/inventory/inventory-manager";
import { ADMIN_ROLE, getAuthenticatedUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  if (user.role !== ADMIN_ROLE) redirect("/dashboard");
  return <InventoryManager />;
}
