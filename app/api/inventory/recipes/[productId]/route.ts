import { NextResponse } from "next/server";

import { ADMIN_ROLE, authorizeRoles } from "@/lib/auth/authorization";
import {
  isSameOriginRequest,
  parseRouteId,
} from "@/lib/catalog/http";
import { inventoryErrorResponse } from "@/lib/inventory/http";
import { saveRecipe } from "@/services/inventory-service";
import { parseRecipeInput } from "@/validators/inventory-validator";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  context: { params: Promise<{ productId: string }> },
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
    const { productId: rawId } = await context.params;
    const productId = parseRouteId(rawId);
    if (!productId) {
      return NextResponse.json(
        { message: "Identificador de producto inválido." },
        { status: 400 },
      );
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "JSON inválido." }, { status: 400 });
    }
    const parsed = parseRecipeInput(body);
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.message }, { status: 422 });
    }
    return NextResponse.json(
      await saveRecipe(productId, parsed.data),
    );
  } catch (error: unknown) {
    return inventoryErrorResponse(error);
  }
}
