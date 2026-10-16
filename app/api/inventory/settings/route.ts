import { NextResponse } from "next/server";

import { ADMIN_ROLE, authorizeRoles } from "@/lib/auth/authorization";
import { isSameOriginRequest } from "@/lib/catalog/http";
import { inventoryErrorResponse } from "@/lib/inventory/http";
import {
  getInventoryOverview,
  updateSoldOutVisibility,
} from "@/services/inventory-service";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const authorization = await authorizeRoles([ADMIN_ROLE]);
  if (!authorization.authorized) return authorization.response;
  try {
    const inventory = await getInventoryOverview();
    return NextResponse.json({ showSoldOut: inventory.showSoldOut });
  } catch (error: unknown) {
    return inventoryErrorResponse(error);
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { message: "Origen de solicitud no válido." },
      { status: 403 },
    );
  }
  const authorization = await authorizeRoles([ADMIN_ROLE]);
  if (!authorization.authorized) return authorization.response;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "JSON inválido." }, { status: 400 });
    }
    if (
      typeof body !== "object" ||
      body === null ||
      !("showSoldOut" in body) ||
      typeof body.showSoldOut !== "boolean"
    ) {
      return NextResponse.json(
        { message: "showSoldOut debe ser booleano." },
        { status: 422 },
      );
    }
    return NextResponse.json(
      await updateSoldOutVisibility(body.showSoldOut),
    );
  } catch (error: unknown) {
    return inventoryErrorResponse(error);
  }
}
