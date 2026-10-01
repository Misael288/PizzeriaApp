import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ message: "No autenticado." }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (error: unknown) {
    console.error("Session lookup failed:", error);
    return NextResponse.json(
      { message: "No fue posible validar la sesión." },
      { status: 500 },
    );
  }
}
