import { NextResponse } from "next/server";

import { LastActiveAdministratorError } from "@/repositories/staff-user-repository";

const staffUserErrorResponse = (error: unknown): NextResponse => {
  if (error instanceof LastActiveAdministratorError) {
    return NextResponse.json({ message: error.message }, { status: 409 });
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  ) {
    return NextResponse.json(
      { message: "Ya existe un usuario con ese correo." },
      { status: 409 },
    );
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2034"
  ) {
    return NextResponse.json(
      { message: "Conflicto al actualizar usuarios. Intenta de nuevo." },
      { status: 409 },
    );
  }
  if (error instanceof Error && error.message === "USER_NOT_FOUND") {
    return NextResponse.json(
      { message: "No se encontró el usuario." },
      { status: 404 },
    );
  }
  if (
    error instanceof Error &&
    error.message === "PENDING_APPROVAL_ROLE_REQUIRED"
  ) {
    return NextResponse.json(
      { message: "Asigna un rol operativo al aprobar la cuenta." },
      { status: 422 },
    );
  }
  console.error("Staff user request failed:", error);
  return NextResponse.json(
    { message: "No fue posible completar la operación de usuarios." },
    { status: 500 },
  );
};

export { staffUserErrorResponse };
