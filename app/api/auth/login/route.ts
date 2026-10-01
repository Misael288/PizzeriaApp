import { NextResponse } from "next/server";

import { authenticateCredentials } from "@/services/auth-service";
import { createSession } from "@/lib/auth/session";

export const runtime = "nodejs";

const INVALID_CREDENTIALS = "Correo o contraseña incorrectos.";

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Solicitud JSON inválida." }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("email" in body) ||
    !("password" in body) ||
    typeof body.email !== "string" ||
    typeof body.password !== "string"
  ) {
    return NextResponse.json(
      { message: "Correo y contraseña son obligatorios." },
      { status: 400 },
    );
  }

  const email = body.email.trim().toLowerCase();
  const password = body.password;

  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    password.length < 1 ||
    password.length > 1024
  ) {
    return NextResponse.json({ message: INVALID_CREDENTIALS }, { status: 401 });
  }

  try {
    const user = await authenticateCredentials(email, password);
    if (!user) {
      return NextResponse.json({ message: INVALID_CREDENTIALS }, { status: 401 });
    }

    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    await createSession(user.id, response);
    return response;
  } catch (error: unknown) {
    console.error("Login failed:", error);
    return NextResponse.json(
      { message: "No fue posible iniciar sesión. Intenta nuevamente." },
      { status: 500 },
    );
  }
}
