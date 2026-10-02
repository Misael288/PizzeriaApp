import { NextResponse } from "next/server";

import {
  ADMIN_ROLE,
  CASHIER_ROLE,
  getAuthenticatedUser,
  type AuthenticatedUser,
} from "@/lib/auth/session";

type AuthorizationResult =
  | { authorized: true; user: AuthenticatedUser }
  | { authorized: false; response: NextResponse };

const authorizeRoles = async (
  allowedRoles: readonly (typeof ADMIN_ROLE | typeof CASHIER_ROLE)[],
): Promise<AuthorizationResult> => {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json(
        { message: "Debes iniciar sesión para continuar." },
        { status: 401 },
      ),
    };
  }

  if (!allowedRoles.includes(user.role)) {
    return {
      authorized: false,
      response: NextResponse.json(
        { message: "No tienes permisos para realizar esta operación." },
        { status: 403 },
      ),
    };
  }

  return { authorized: true, user };
};

export { ADMIN_ROLE, CASHIER_ROLE, authorizeRoles };
