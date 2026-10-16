import { redirect } from "next/navigation";

import { StaffOrderQueue } from "@/components/orders/staff-order-queue";
import { getAuthenticatedUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  return <StaffOrderQueue role={user.role} />;
}
