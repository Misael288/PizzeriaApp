import { NextResponse } from "next/server";

import { isSameOriginRequest } from "@/lib/catalog/http";
import { authorizeRoles, ADMIN_ROLE, CASHIER_ROLE } from "@/lib/auth/authorization";
import {
  changeOwnPassword,
  ProfileServiceError,
} from "@/services/profile-service";
import { parsePasswordChangeInput } from "@/validators/profile-validator";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { message: "Origen de solicitud no válido." },
      { status: 403 },
    );
  }

  const authorization = await authorizeRoles([ADMIN_ROLE, CASHIER_ROLE]);
  if (!authorization.authorized) return authorization.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Solicitud JSON inválida." },
      { status: 400 },
    );
  }

  const input = parsePasswordChangeInput(body);
  if (!input.success) {
    return NextResponse.json({ message: input.message }, { status: 400 });
  }

  try {
    await changeOwnPassword(
      authorization.user.id,
      input.data.currentPassword,
      input.data.newPassword,
    );
    return NextResponse.json({ message: "Contraseña actualizada." });
  } catch (error: unknown) {
    if (error instanceof ProfileServiceError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }
    console.error("Profile password change failed:", error);
    return NextResponse.json(
      { message: "No fue posible cambiar la contraseña." },
      { status: 500 },
    );
  }
}
