import { NextResponse } from "next/server";

import {
  ADMIN_ROLE,
  CASHIER_ROLE,
  authorizeRoles,
} from "@/lib/auth/authorization";
import { isSameOriginRequest, parseRouteId } from "@/lib/catalog/http";
import { orderErrorResponse } from "@/lib/orders/http";
import { recordStaffPayment } from "@/services/order-service";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { message: "Origen de solicitud no válido." },
      { status: 403 },
    );
  }
  try {
    const authorization = await authorizeRoles([ADMIN_ROLE, CASHIER_ROLE]);
    if (!authorization.authorized) return authorization.response;
    const { id: rawId } = await context.params;
    const id = parseRouteId(rawId);
    if (!id) {
      return NextResponse.json(
        { message: "Identificador inválido." },
        { status: 400 },
      );
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "JSON inválido." }, { status: 400 });
    }
    if (
      typeof body !== "object" ||
      body === null ||
      !("paymentMethodId" in body) ||
      typeof body.paymentMethodId !== "number" ||
      !Number.isSafeInteger(body.paymentMethodId) ||
      body.paymentMethodId < 1
    ) {
      return NextResponse.json(
        { message: "El método de pago no es válido." },
        { status: 422 },
      );
    }
    return NextResponse.json(
      await recordStaffPayment(
        id,
        body.paymentMethodId,
        authorization.user.id,
      ),
    );
  } catch (error: unknown) {
    return orderErrorResponse(error);
  }
}
