import { NextResponse } from "next/server";

import {
  ADMIN_ROLE,
  CASHIER_ROLE,
  authorizeRoles,
} from "@/lib/auth/authorization";
import { isSameOriginRequest, parseRouteId } from "@/lib/catalog/http";
import { orderErrorResponse } from "@/lib/orders/http";
import { confirmStaffOrder } from "@/services/order-service";

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
    return NextResponse.json(
      await confirmStaffOrder(id, authorization.user.id),
    );
  } catch (error: unknown) {
    return orderErrorResponse(error);
  }
}
