import { NextResponse } from "next/server";

import { isSameOriginRequest } from "@/lib/catalog/http";
import { staffUserErrorResponse } from "@/lib/users/http";
import { registerPublicUser } from "@/services/staff-user-service";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { message: "Origen de solicitud no válido." },
      { status: 403 },
    );
  }
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "JSON inválido." }, { status: 400 });
    }
    const result = await registerPublicUser(body);
    if (!result.success) {
      return NextResponse.json(
        { message: result.message },
        { status: result.status },
      );
    }
    return NextResponse.json(
      {
        message:
          "Solicitud de cuenta recibida. Un administrador debe asignarte un rol antes de que puedas iniciar sesión.",
      },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { message: "No se pudo registrar la cuenta con esos datos." },
        { status: 409 },
      );
    }
    return staffUserErrorResponse(error);
  }
}
