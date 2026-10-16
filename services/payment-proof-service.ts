import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  findPaymentProofByOrderId,
  findPaymentProofUploadContext,
  replacePaymentProof,
} from "@/repositories/payment-proof-repository";
import { hashTrackingToken, isValidTrackingToken } from "@/lib/orders/tracking-token";

const MAX_PROOF_SIZE = 5 * 1024 * 1024;
const PROOF_DIRECTORY = path.join(process.cwd(), "private", "payment-proofs");
const STORAGE_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|pdf)$/i;

class PaymentProofError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PaymentProofError";
  }
}

type ProofFormat = { extension: "jpg" | "png" | "pdf"; contentType: string };

const detectProofFormat = (bytes: Uint8Array): ProofFormat | null => {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return { extension: "jpg", contentType: "image/jpeg" };
  }
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
    bytes.length >= 5 &&
    String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-"
  ) {
    return { extension: "pdf", contentType: "application/pdf" };
  }
  return null;
};

const getSafeStoragePath = (storageKey: string): string => {
  if (!STORAGE_KEY_PATTERN.test(storageKey)) {
    throw new PaymentProofError("La ruta del comprobante no es válida.", 500);
  }
  return path.join(PROOF_DIRECTORY, storageKey);
};

const checkUploadPermission = async (token: string) => {
  if (!isValidTrackingToken(token)) {
    throw new PaymentProofError("No se encontró el pedido.", 404);
  }
  const order = await findPaymentProofUploadContext(hashTrackingToken(token));
  if (!order) throw new PaymentProofError("No se encontró el pedido.", 404);
  if (order.pagado_en) {
    throw new PaymentProofError(
      "El pago ya fue confirmado; ya no se puede cambiar el comprobante.",
      409,
    );
  }
  if (order.estados_pedido.nombre === "CANCELADO") {
    throw new PaymentProofError(
      "No se puede cargar comprobante para un pedido cancelado.",
      409,
    );
  }
  if (order.metodo_pago_previsto?.nombre !== "Transferencia") {
    throw new PaymentProofError(
      "Este pedido no tiene transferencia como método de pago previsto.",
      409,
    );
  }
  return order;
};

const uploadPaymentProof = async (
  token: string,
  file: File,
): Promise<{ uploaded: true; createdAt: string }> => {
  const order = await checkUploadPermission(token);
  if (file.size < 1 || file.size > MAX_PROOF_SIZE) {
    throw new PaymentProofError(
      "El comprobante debe pesar entre 1 byte y 5 MB.",
      413,
    );
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = detectProofFormat(bytes);
  if (!format) {
    throw new PaymentProofError(
      "Formato no válido. Adjunta un JPG, PNG o PDF auténtico.",
      415,
    );
  }

  const storageKey = `${randomUUID()}.${format.extension}`;
  const safeBaseName =
    path
      .basename(file.name, path.extname(file.name))
      .replace(/[^\w.-]/g, "_")
      .slice(0, 140) || "comprobante";
  const fileName = `${safeBaseName}.${format.extension}`;
  const storagePath = getSafeStoragePath(storageKey);
  await mkdir(PROOF_DIRECTORY, { recursive: true });
  await writeFile(storagePath, bytes, { flag: "wx", mode: 0o600 });

  let result: Awaited<ReturnType<typeof replacePaymentProof>>;
  try {
    result = await replacePaymentProof(order.id_pedido, {
      storageKey,
      fileName,
      contentType: format.contentType,
    });
  } catch (error: unknown) {
    await rm(storagePath, { force: true });
    throw error;
  }
  if (result.error) {
    await rm(storagePath, { force: true });
    const failures: Record<string, [string, number]> = {
      ORDER_NOT_FOUND: ["No se encontró el pedido.", 404],
      ORDER_ALREADY_PAID: [
        "El pago ya fue confirmado; ya no se puede cambiar el comprobante.",
        409,
      ],
      ORDER_CANCELLED: [
        "No se puede cargar comprobante para un pedido cancelado.",
        409,
      ],
      ORDER_NOT_TRANSFER: [
        "Este pedido no tiene transferencia como método de pago previsto.",
        409,
      ],
    };
    const [message, status] = failures[result.error];
    throw new PaymentProofError(message, status);
  }
  if (result.previousStorageKey) {
    try {
      await rm(getSafeStoragePath(result.previousStorageKey), { force: true });
    } catch (error: unknown) {
      console.error("Old payment proof cleanup failed:", error);
    }
  }
  return { uploaded: true, createdAt: new Date().toISOString() };
};

const getStaffPaymentProof = async (orderId: number) => {
  if (!Number.isSafeInteger(orderId) || orderId < 1) {
    throw new PaymentProofError("Identificador inválido.", 400);
  }
  const proof = await findPaymentProofByOrderId(orderId);
  if (!proof) throw new PaymentProofError("No hay comprobante adjunto.", 404);
  const bytes = await readFile(getSafeStoragePath(proof.clave_almacenamiento));
  return {
    bytes: new Uint8Array(bytes),
    contentType: proof.tipo_contenido,
    extension: proof.clave_almacenamiento.split(".").at(-1) ?? "bin",
  };
};

export {
  getStaffPaymentProof,
  MAX_PROOF_SIZE,
  PaymentProofError,
  uploadPaymentProof,
};
