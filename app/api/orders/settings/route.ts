import { NextResponse } from "next/server";

import { ADMIN_ROLE, authorizeRoles } from "@/lib/auth/authorization";
import { isSameOriginRequest } from "@/lib/catalog/http";
import { orderErrorResponse } from "@/lib/orders/http";
import {
  getOrderSettings,
  updateOrderSettings,
} from "@/services/order-service";
import { parsePreparationMinutes } from "@/validators/order-validator";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    const authorization = await authorizeRoles([ADMIN_ROLE]);
    if (!authorization.authorized) return authorization.response;

    return NextResponse.json(await getOrderSettings());
  } catch (error: unknown) {
    return orderErrorResponse(error);
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { message: "Origen de solicitud no válido." },
      { status: 403 },
    );
  }

  try {
    const authorization = await authorizeRoles([ADMIN_ROLE]);
    if (!authorization.authorized) return authorization.response;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "JSON inválido." }, { status: 400 });
    }

    if (
      typeof body !== "object" ||
      body === null ||
      !("preparationMinutes" in body)
    ) {
      return NextResponse.json(
        { message: "El tiempo de preparación es obligatorio." },
        { status: 422 },
      );
    }

    const parsed = parsePreparationMinutes(body.preparationMinutes);
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.message }, { status: 422 });
    }

    return NextResponse.json(
      await updateOrderSettings(parsed.data),
    );
  } catch (error: unknown) {
    return orderErrorResponse(error);
  }
}
