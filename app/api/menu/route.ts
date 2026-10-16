import { NextResponse } from "next/server";

import { orderErrorResponse } from "@/lib/orders/http";
import { getPublicMenu } from "@/services/order-service";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json(await getPublicMenu(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error: unknown) {
    return orderErrorResponse(error);
  }
}
