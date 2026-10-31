import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

type ImageFormat = {
  extension: "jpg" | "png" | "webp";
  contentType: string;
};

class ImageUploadError extends Error {
  constructor(
    message: string,
    readonly status: 413 | 415,
  ) {
    super(message);
    this.name = "ImageUploadError";
  }
}

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

  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
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

const saveImageUpload = async (
  file: File,
  uploadDirectory: string,
  publicDirectory: string,
): Promise<{ image: string; contentType: string }> => {
  if (file.size === 0 || file.size > MAX_IMAGE_SIZE) {
    throw new ImageUploadError(
      "La imagen debe pesar entre 1 byte y 5 MB.",
      413,
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = detectImageFormat(bytes);
  if (!format) {
    throw new ImageUploadError(
      "Formato no válido. Usa PNG, JPEG o WebP.",
      415,
    );
  }

  const fileName = `${randomUUID()}.${format.extension}`;
  await mkdir(uploadDirectory, { recursive: true });
  await writeFile(path.join(uploadDirectory, fileName), bytes, {
    flag: "wx",
  });

  return {
    image: `${publicDirectory}/${fileName}`,
    contentType: format.contentType,
  };
};

export { ImageUploadError, saveImageUpload };
