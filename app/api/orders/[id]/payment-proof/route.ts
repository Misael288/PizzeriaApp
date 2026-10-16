import { NextResponse } from "next/server";

import {
  ADMIN_ROLE,
  authorizeRoles,
  CASHIER_ROLE,
} from "@/lib/auth/authorization";
import { parseRouteId } from "@/lib/catalog/http";
import {
  getStaffPaymentProof,
  PaymentProofError,
} from "@/services/payment-proof-service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const authorization = await authorizeRoles([ADMIN_ROLE, CASHIER_ROLE]);
  if (!authorization.authorized) return authorization.response;
  try {
    const { id: rawId } = await context.params;
    const id = parseRouteId(rawId);
    if (!id) {
      return NextResponse.json(
        { message: "Identificador inválido." },
        { status: 400 },
      );
    }
    const proof = await getStaffPaymentProof(id);
    return new NextResponse(proof.bytes, {
      headers: {
        "Content-Type": proof.contentType,
        "Content-Disposition": `inline; filename="comprobante-${id}.${proof.extension}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: unknown) {
    if (error instanceof PaymentProofError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }
    console.error("Staff payment proof access failed:", error);
    return NextResponse.json(
      { message: "No fue posible consultar el comprobante." },
      { status: 500 },
    );
  }
}
