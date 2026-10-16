import { NextResponse } from "next/server";

import { getPublicTransferDetails } from "@/services/payment-settings-service";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    const transfer = await getPublicTransferDetails();
    if (!transfer) {
      return NextResponse.json(
        { message: "La transferencia no está configurada." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { transfer },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: unknown) {
    console.error("Public transfer details request failed:", error);
    return NextResponse.json(
      { message: "No fue posible cargar los datos de transferencia." },
      { status: 500 },
    );
  }
}
