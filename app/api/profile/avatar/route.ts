import { NextResponse } from "next/server";
import path from "node:path";

import { saveImageUpload, ImageUploadError } from "@/lib/images/upload";
import { isSameOriginRequest } from "@/lib/catalog/http";
import { authorizeRoles, ADMIN_ROLE, CASHIER_ROLE } from "@/lib/auth/authorization";
import { saveUserAvatar } from "@/repositories/ui-settings-repository";

export const runtime = "nodejs";

const MAX_REQUEST_SIZE = 5 * 1024 * 1024 + 128_000;

export async function POST(request: Request): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { message: "Origen de solicitud no válido." },
      { status: 403 },
    );
  }

  const authorization = await authorizeRoles([ADMIN_ROLE, CASHIER_ROLE]);
  if (!authorization.authorized) return authorization.response;

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_SIZE) {
    return NextResponse.json(
      { message: "La imagen no puede superar 5 MB." },
      { status: 413 },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("image");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { message: "Selecciona una imagen de perfil." },
        { status: 400 },
      );
    }

    const { image } = await saveImageUpload(
      file,
      path.join(process.cwd(), "public", "uploads", "avatars"),
      "/uploads/avatars",
    );
    await saveUserAvatar(authorization.user.id, image);

    return NextResponse.json(
      { avatar: image },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: unknown) {
    if (error instanceof ImageUploadError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }
    console.error("Profile avatar upload failed:", error);
    return NextResponse.json(
      { message: "No fue posible guardar la foto de perfil." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { message: "Origen de solicitud no válido." },
      { status: 403 },
    );
  }

  const authorization = await authorizeRoles([ADMIN_ROLE, CASHIER_ROLE]);
  if (!authorization.authorized) return authorization.response;

  try {
    await saveUserAvatar(authorization.user.id, "");
    return NextResponse.json({ avatar: null });
  } catch (error: unknown) {
    console.error("Profile avatar removal failed:", error);
    return NextResponse.json(
      { message: "No fue posible quitar la foto de perfil." },
      { status: 500 },
    );
  }
}
