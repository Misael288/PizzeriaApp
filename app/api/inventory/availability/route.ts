import { NextResponse } from "next/server";

import {
  ADMIN_ROLE,
  CASHIER_ROLE,
  authorizeRoles,
} from "@/lib/auth/authorization";
import { inventoryErrorResponse } from "@/lib/inventory/http";
import { getCashierAvailability } from "@/services/inventory-service";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    const authorization = await authorizeRoles([ADMIN_ROLE, CASHIER_ROLE]);
    if (!authorization.authorized) return authorization.response;
    return NextResponse.json(await getCashierAvailability(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error: unknown) {
    return inventoryErrorResponse(error);
  }
}
