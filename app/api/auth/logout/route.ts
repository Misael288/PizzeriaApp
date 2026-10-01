import { NextResponse } from "next/server";

import { destroySession } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const response = NextResponse.redirect(new URL("/login", request.url), 303);
    await destroySession(response);
    return response;
  } catch (error: unknown) {
    console.error("Logout failed:", error);
    return NextResponse.json(
      { message: "No fue posible cerrar la sesión." },
      { status: 500 },
    );
  }
}
