import { NextResponse } from "next/server";

import { ADMIN_ROLE, authorizeRoles } from "@/lib/auth/authorization";
import {
  isSameOriginRequest,
  parseRouteId,
} from "@/lib/catalog/http";
import { inventoryErrorResponse } from "@/lib/inventory/http";
import { editIngredient } from "@/services/inventory-service";
import { parseIngredientInput } from "@/validators/inventory-validator";

export const runtime = "nodejs";

export async function PUT(
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
    const authorization = await authorizeRoles([ADMIN_ROLE]);
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
    const parsed = parseIngredientInput(body);
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.message }, { status: 422 });
    }
    const ingredient = await editIngredient(
      id,
      parsed.data,
      authorization.user.id,
    );
    return NextResponse.json({ ingredient });
  } catch (error: unknown) {
    return inventoryErrorResponse(error);
  }
}
