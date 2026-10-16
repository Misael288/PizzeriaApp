import { NextResponse } from "next/server";

import {
  ADMIN_ROLE,
  CASHIER_ROLE,
  authorizeRoles,
} from "@/lib/auth/authorization";
import {
  isSameOriginRequest,
  parseRouteId,
} from "@/lib/catalog/http";
import { orderErrorResponse } from "@/lib/orders/http";
import { updateStaffOrder } from "@/services/order-service";
import { parseOrderUpdateInput } from "@/validators/order-validator";

export const runtime = "nodejs";

export async function PATCH(
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
    if (id === null) {
      return NextResponse.json(
        { message: "El identificador del pedido no es válido." },
        { status: 400 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "JSON inválido." }, { status: 400 });
    }

    const parsed = parseOrderUpdateInput(body);
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.message }, { status: 422 });
    }

    await updateStaffOrder(id, parsed.data, authorization.user.id);
    return NextResponse.json({ updated: true });
  } catch (error: unknown) {
    return orderErrorResponse(error);
  }
}
