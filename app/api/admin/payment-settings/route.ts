import { NextResponse } from "next/server";

import { ADMIN_ROLE, authorizeRoles } from "@/lib/auth/authorization";
import { isSameOriginRequest } from "@/lib/catalog/http";
import {
  getAdminTransferSettings,
  updateAdminTransferSettings,
} from "@/services/payment-settings-service";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const authorization = await authorizeRoles([ADMIN_ROLE]);
  if (!authorization.authorized) return authorization.response;
  try {
    return NextResponse.json(
      { settings: await getAdminTransferSettings() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: unknown) {
    console.error("Transfer settings lookup failed:", error);
    return NextResponse.json(
      { message: "No fue posible cargar la configuración de transferencia." },
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
    const result = await updateAdminTransferSettings(body);
    if (!result.success) {
      return NextResponse.json(
        { message: result.message },
        { status: 422 },
      );
    }
    return NextResponse.json({ settings: result.settings });
  } catch (error: unknown) {
    console.error("Transfer settings update failed:", error);
    return NextResponse.json(
      { message: "No fue posible guardar la configuración de transferencia." },
      { status: 500 },
    );
  }
}
