import { NextResponse } from "next/server";

import { orderErrorResponse } from "@/lib/orders/http";
import { getGuestOrderTracking } from "@/services/order-service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  try {
    const { token } = await context.params;
    const order = await getGuestOrderTracking(token);
    return NextResponse.json(order, {
      headers: {
        "Cache-Control": "no-store, private",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error: unknown) {
    return orderErrorResponse(error);
  }
}
