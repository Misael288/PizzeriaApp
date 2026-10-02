import { NextResponse } from "next/server";

import { authorizeRoles, ADMIN_ROLE } from "@/lib/auth/authorization";
import {
  catalogErrorResponse,
  isSameOriginRequest,
  parseRouteId,
} from "@/lib/catalog/http";
import { editCategory } from "@/services/catalog-service";
import { parseCategoryInput } from "@/validators/catalog-validator";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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

    const parsed = parseCategoryInput(body);
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.message }, { status: 422 });
    }

    const category = await editCategory(id, parsed.data);
    return NextResponse.json({ category });
  } catch (error: unknown) {
    return catalogErrorResponse(error);
  }
}
