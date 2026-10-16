import { NextResponse } from "next/server";

import {
  ADMIN_ROLE,
  CASHIER_ROLE,
  authorizeRoles,
} from "@/lib/auth/authorization";
import { isSameOriginRequest } from "@/lib/catalog/http";
import { orderErrorResponse } from "@/lib/orders/http";
import {
  addGuestOrder,
  getStaffOrderQueue,
} from "@/services/order-service";
import { parseGuestOrderInput } from "@/validators/order-validator";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    const authorization = await authorizeRoles([ADMIN_ROLE, CASHIER_ROLE]);
    if (!authorization.authorized) return authorization.response;

    return NextResponse.json(await getStaffOrderQueue(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error: unknown) {
    return orderErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { message: "Origen de solicitud no válido." },
      { status: 403 },
    );
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "JSON inválido." }, { status: 400 });
    }

    const parsed = parseGuestOrderInput(body);
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.message }, { status: 422 });
    }

    const order = await addGuestOrder(parsed.data);
    return NextResponse.json(
      {
        trackingUrl: `/pedido/seguimiento/${order.trackingToken}`,
        total: order.total,
        etaMinutes: order.etaMinutes,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: unknown) {
    return orderErrorResponse(error);
  }
}
