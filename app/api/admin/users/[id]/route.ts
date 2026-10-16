import { NextResponse } from "next/server";

import { ADMIN_ROLE, authorizeRoles } from "@/lib/auth/authorization";
import { isSameOriginRequest } from "@/lib/catalog/http";
import { staffUserErrorResponse } from "@/lib/users/http";
import { editStaffUser } from "@/services/staff-user-service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

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
  const authorization = await authorizeRoles([ADMIN_ROLE]);
  if (!authorization.authorized) return authorization.response;
  try {
    const { id } = await context.params;
    const userId = Number(id);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "JSON inválido." }, { status: 400 });
    }
    const result = await editStaffUser(userId, body);
    if (!result.success) {
      return NextResponse.json(
        { message: result.message },
        { status: result.status },
      );
    }
    return NextResponse.json({ user: result.user });
  } catch (error: unknown) {
    return staffUserErrorResponse(error);
  }
}
