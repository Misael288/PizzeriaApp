import { NextResponse } from "next/server";

import { authorizeRoles, ADMIN_ROLE, CASHIER_ROLE } from "@/lib/auth/authorization";
import { catalogErrorResponse, isSameOriginRequest } from "@/lib/catalog/http";
import { addCategory, getCategories } from "@/services/catalog-service";
import { parseCategoryInput } from "@/validators/catalog-validator";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    const authorization = await authorizeRoles([ADMIN_ROLE, CASHIER_ROLE]);
    if (!authorization.authorized) return authorization.response;

    const categories = await getCategories(
      authorization.user.role === CASHIER_ROLE,
    );

    return NextResponse.json({ categories });
  } catch (error: unknown) {
    return catalogErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ message: "Origen de solicitud no válido." }, { status: 403 });
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

    const parsed = parseCategoryInput(body);
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.message }, { status: 422 });
    }

    const category = await addCategory(parsed.data);
    return NextResponse.json({ category }, { status: 201 });
  } catch (error: unknown) {
    return catalogErrorResponse(error);
  }
}
