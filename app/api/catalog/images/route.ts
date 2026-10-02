import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

import { authorizeRoles, ADMIN_ROLE } from "@/lib/auth/authorization";
import { isSameOriginRequest } from "@/lib/catalog/http";

export const runtime = "nodejs";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const UPLOAD_DIRECTORY = path.join(process.cwd(), "public", "uploads", "products");

type ImageFormat = {
  extension: "jpg" | "png" | "webp";
  contentType: string;
};

const detectImageFormat = (bytes: Uint8Array): ImageFormat | null => {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { extension: "png", contentType: "image/png" };
  }

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { extension: "jpg", contentType: "image/jpeg" };
  }

  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return { extension: "webp", contentType: "image/webp" };
  }

  return null;
};

export async function POST(request: Request): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { message: "Origen de solicitud no válido." },
      { status: 403 },
    );
  }

  try {
    const authorization = await authorizeRoles([ADMIN_ROLE]);
    if (!authorization.authorized) return authorization.response;

    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_SIZE + 128_000) {
      return NextResponse.json(
        { message: "La imagen no puede superar 5 MB." },
        { status: 413 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("image");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { message: "Selecciona una imagen para importar." },
        { status: 400 },
      );
    }

    if (file.size === 0 || file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { message: "La imagen debe pesar entre 1 byte y 5 MB." },
        { status: 413 },
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const format = detectImageFormat(bytes);

    if (!format) {
      return NextResponse.json(
        { message: "Formato no válido. Usa PNG, JPEG o WebP." },
        { status: 415 },
      );
    }

    const fileName = `${randomUUID()}.${format.extension}`;
    await mkdir(UPLOAD_DIRECTORY, { recursive: true });
    await writeFile(path.join(UPLOAD_DIRECTORY, fileName), bytes, {
      flag: "wx",
    });

    return NextResponse.json(
      {
        image: `/uploads/products/${fileName}`,
        contentType: format.contentType,
      },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error: unknown) {
    console.error("Product image upload failed:", error);
    return NextResponse.json(
      { message: "No fue posible importar la imagen." },
      { status: 500 },
    );
  }
}
