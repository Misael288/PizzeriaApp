import { NextResponse } from "next/server";

import { ADMIN_ROLE, authorizeRoles } from "@/lib/auth/authorization";
import { isSameOriginRequest } from "@/lib/catalog/http";
import { addStaffUser, getStaffUsers } from "@/services/staff-user-service";
import { staffUserErrorResponse } from "@/lib/users/http";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const authorization = await authorizeRoles([ADMIN_ROLE]);
  if (!authorization.authorized) return authorization.response;
  try {
    return NextResponse.json(
      { users: await getStaffUsers() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: unknown) {
    return staffUserErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
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
    const result = await addStaffUser(body);
    if (!result.success) {
      return NextResponse.json(
        { message: result.message },
        { status: result.status },
      );
    }
    return NextResponse.json({ user: result.user }, { status: 201 });
  } catch (error: unknown) {
    return staffUserErrorResponse(error);
  }
}
