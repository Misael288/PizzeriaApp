import { NextResponse } from "next/server";

import {
  ADMIN_ROLE,
  CASHIER_ROLE,
  authorizeRoles,
} from "@/lib/auth/authorization";
import { orderErrorResponse } from "@/lib/orders/http";
import { getStaffPaymentMethods } from "@/services/order-service";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    const authorization = await authorizeRoles([ADMIN_ROLE, CASHIER_ROLE]);
    if (!authorization.authorized) return authorization.response;
    return NextResponse.json(
      { methods: await getStaffPaymentMethods() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: unknown) {
    return orderErrorResponse(error);
  }
}
