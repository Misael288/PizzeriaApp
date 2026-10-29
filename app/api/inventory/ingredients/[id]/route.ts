import { NextResponse } from "next/server";

import { ADMIN_ROLE, authorizeRoles } from "@/lib/auth/authorization";
import {
  isSameOriginRequest,
  parseRouteId,
} from "@/lib/catalog/http";
import { inventoryErrorResponse } from "@/lib/inventory/http";
import {
  editIngredient,
  removeUnusedIngredient,
  setIngredientActive,
} from "@/services/inventory-service";
import { parseIngredientInput } from "@/validators/inventory-validator";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const getIngredientId = async (
  context: RouteContext,
): Promise<number | null> => {
  const { id } = await context.params;
  return parseRouteId(id);
};

export async function PUT(
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
    const authorization = await authorizeRoles([ADMIN_ROLE]);
    if (!authorization.authorized) return authorization.response;
    const id = await getIngredientId(context);
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
    const authorization = await authorizeRoles([ADMIN_ROLE]);
    if (!authorization.authorized) return authorization.response;
    const id = await getIngredientId(context);
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
      !("active" in body) ||
      typeof body.active !== "boolean" ||
      Object.keys(body).length !== 1
    ) {
      return NextResponse.json(
        { message: "active debe ser el único campo booleano de la solicitud." },
        { status: 422 },
      );
    }
    return NextResponse.json(await setIngredientActive(id, body.active));
  } catch (error: unknown) {
    return inventoryErrorResponse(error);
  }
}

export async function DELETE(
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
    const authorization = await authorizeRoles([ADMIN_ROLE]);
    if (!authorization.authorized) return authorization.response;
    const id = await getIngredientId(context);
    if (!id) {
      return NextResponse.json(
        { message: "Identificador inválido." },
        { status: 400 },
      );
    }
    return NextResponse.json(await removeUnusedIngredient(id));
  } catch (error: unknown) {
    return inventoryErrorResponse(error);
  }
}
