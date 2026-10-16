import { NextResponse } from "next/server";

import { isSameOriginRequest } from "@/lib/catalog/http";
import {
  MAX_PROOF_SIZE,
  PaymentProofError,
  uploadPaymentProof,
} from "@/services/payment-proof-service";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { message: "Origen de solicitud no válido." },
      { status: 403 },
    );
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_PROOF_SIZE + 128_000
  ) {
    return NextResponse.json(
      { message: "El comprobante no puede superar 5 MB." },
      { status: 413 },
    );
  }
  try {
    const { token } = await context.params;
    const formData = await request.formData();
    const file = formData.get("proof");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { message: "Selecciona un comprobante." },
        { status: 400 },
      );
    }
    const result = await uploadPaymentProof(token, file);
    return NextResponse.json(result, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error: unknown) {
    if (error instanceof PaymentProofError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }
    console.error("Public payment proof upload failed:", error);
    return NextResponse.json(
      { message: "No fue posible adjuntar el comprobante." },
      { status: 500 },
    );
  }
}
