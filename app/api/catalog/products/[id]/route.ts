import { NextResponse } from "next/server";

import {
  authorizeRoles,
  ADMIN_ROLE,
  CASHIER_ROLE,
} from "@/lib/auth/authorization";
import {
  catalogErrorResponse,
  isSameOriginRequest,
  parseRouteId,
} from "@/lib/catalog/http";
import { editProduct } from "@/services/catalog-service";
import { parseProductInput } from "@/validators/catalog-validator";
import { setProductAvailability } from "@/services/inventory-service";
import { inventoryErrorResponse } from "@/lib/inventory/http";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  request: Request,
  context: RouteContext,
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
      !("available" in body) ||
      typeof body.available !== "boolean" ||
      Object.keys(body).length !== 1
    ) {
      return NextResponse.json(
        { message: "La solicitud solo puede cambiar la disponibilidad." },
        { status: 422 },
      );
    }
    const product = await setProductAvailability(id, body.available);
    return NextResponse.json({ product });
  } catch (error: unknown) {
    return inventoryErrorResponse(error);
  }
}

export async function PUT(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ message: "Origen de solicitud no válido." }, { status: 403 });
  }

  try {
    const authorization = await authorizeRoles([ADMIN_ROLE]);
    if (!authorization.authorized) return authorization.response;

    const { id: rawId } = await context.params;
    const id = parseRouteId(rawId);
    if (!id) {
      return NextResponse.json({ message: "Identificador inválido." }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "JSON inválido." }, { status: 400 });
    }

    const parsed = parseProductInput(body);
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.message }, { status: 422 });
    }

    await editProduct(id, parsed.data);
    return NextResponse.json({ message: "Producto actualizado." });
  } catch (error: unknown) {
    return catalogErrorResponse(error);
  }
}
