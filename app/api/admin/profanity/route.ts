import { NextResponse } from "next/server";

import { ADMIN_ROLE, authorizeRoles } from "@/lib/auth/authorization";
import { isSameOriginRequest } from "@/lib/catalog/http";
import {
  getProfanityWords,
  updateProfanityWords,
} from "@/services/profanity-service";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const authorization = await authorizeRoles([ADMIN_ROLE]);
  if (!authorization.authorized) return authorization.response;
  try {
    return NextResponse.json({ words: await getProfanityWords() });
  } catch (error: unknown) {
    console.error("Could not load profanity settings:", error);
    return NextResponse.json(
      { message: "No fue posible cargar la configuración de palabras." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
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
    if (
      typeof body !== "object" ||
      body === null ||
      !("words" in body) ||
      Object.keys(body).length !== 1
    ) {
      return NextResponse.json(
        { message: "Envía únicamente la lista words." },
        { status: 422 },
      );
    }
    const result = await updateProfanityWords(body.words);
    if (!result.success) {
      return NextResponse.json(
        { message: result.message },
        { status: 422 },
      );
    }
    return NextResponse.json({ words: result.words });
  } catch (error: unknown) {
    console.error("Could not save profanity settings:", error);
    return NextResponse.json(
      { message: "No fue posible guardar la configuración de palabras." },
      { status: 500 },
    );
  }
}
