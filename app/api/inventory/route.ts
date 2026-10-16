import { NextResponse } from "next/server";

import { ADMIN_ROLE, authorizeRoles } from "@/lib/auth/authorization";
import { isSameOriginRequest } from "@/lib/catalog/http";
import { inventoryErrorResponse } from "@/lib/inventory/http";
import {
  addIngredient,
  getInventoryOverview,
} from "@/services/inventory-service";
import { parseIngredientInput } from "@/validators/inventory-validator";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    const authorization = await authorizeRoles([ADMIN_ROLE]);
    if (!authorization.authorized) return authorization.response;
    return NextResponse.json(await getInventoryOverview(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error: unknown) {
    return inventoryErrorResponse(error);
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
    const authorization = await authorizeRoles([ADMIN_ROLE]);
    if (!authorization.authorized) return authorization.response;
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
    const ingredient = await addIngredient(parsed.data, authorization.user.id);
    return NextResponse.json({ ingredient }, { status: 201 });
  } catch (error: unknown) {
    return inventoryErrorResponse(error);
  }
}
