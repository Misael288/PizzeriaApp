import { NextResponse } from "next/server";

import { authorizeRoles, ADMIN_ROLE } from "@/lib/auth/authorization";
import { catalogErrorResponse, isSameOriginRequest } from "@/lib/catalog/http";
import { addSize, getSizes } from "@/services/catalog-service";
import { parseSizeInput } from "@/validators/catalog-validator";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    const authorization = await authorizeRoles([ADMIN_ROLE]);
    if (!authorization.authorized) return authorization.response;

    const sizes = await getSizes();
    return NextResponse.json({ sizes });
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

    const parsed = parseSizeInput(body);
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.message }, { status: 422 });
    }

    const size = await addSize(parsed.data);
    return NextResponse.json({ size }, { status: 201 });
  } catch (error: unknown) {
    return catalogErrorResponse(error);
  }
}
