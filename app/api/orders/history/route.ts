import { NextResponse } from "next/server";

import {
  ADMIN_ROLE,
  authorizeRoles,
  CASHIER_ROLE,
} from "@/lib/auth/authorization";
import { getRecentOrderHistory } from "@/services/order-history-service";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const authorization = await authorizeRoles([ADMIN_ROLE, CASHIER_ROLE]);
  if (!authorization.authorized) return authorization.response;
  try {
    return NextResponse.json(
      { orders: await getRecentOrderHistory() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: unknown) {
    console.error("Order history request failed:", error);
    return NextResponse.json(
      { message: "No fue posible cargar el historial de pedidos." },
      { status: 500 },
    );
  }
}
