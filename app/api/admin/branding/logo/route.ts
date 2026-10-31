import { NextResponse } from "next/server";
import path from "node:path";

import { ADMIN_ROLE, authorizeRoles } from "@/lib/auth/authorization";
import { isSameOriginRequest } from "@/lib/catalog/http";
import { ImageUploadError, saveImageUpload } from "@/lib/images/upload";
import { saveBrandLogo } from "@/repositories/ui-settings-repository";

export const runtime = "nodejs";

const MAX_REQUEST_SIZE = 5 * 1024 * 1024 + 128_000;

export async function POST(request: Request): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { message: "Origen de solicitud no válido." },
      { status: 403 },
    );
  }

  const authorization = await authorizeRoles([ADMIN_ROLE]);
  if (!authorization.authorized) return authorization.response;

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_SIZE) {
    return NextResponse.json(
      { message: "El logotipo no puede superar 5 MB." },
      { status: 413 },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("image");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { message: "Selecciona una imagen para el logotipo." },
        { status: 400 },
      );
    }

    const { image } = await saveImageUpload(
      file,
      path.join(process.cwd(), "public", "uploads", "branding"),
      "/uploads/branding",
    );
    await saveBrandLogo(image);

    return NextResponse.json(
      { logo: image },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: unknown) {
    if (error instanceof ImageUploadError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }
    console.error("Brand logo upload failed:", error);
    return NextResponse.json(
      { message: "No fue posible guardar el logotipo." },
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

  const authorization = await authorizeRoles([ADMIN_ROLE]);
  if (!authorization.authorized) return authorization.response;

  try {
    await saveBrandLogo("");
    return NextResponse.json({ logo: null });
  } catch (error: unknown) {
    console.error("Brand logo reset failed:", error);
    return NextResponse.json(
      { message: "No fue posible restablecer el logotipo." },
      { status: 500 },
    );
  }
}
