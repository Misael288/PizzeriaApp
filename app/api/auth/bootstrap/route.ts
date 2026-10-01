import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { bootstrapInitialAccounts } from "@/services/auth-service";

export const runtime = "nodejs";

const secretsMatch = (provided: string | null, expected: string): boolean => {
  if (!provided) {
    return false;
  }

  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
};

export async function POST(request: Request): Promise<NextResponse> {
  const bootstrapToken = process.env.BOOTSTRAP_TOKEN;
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
  const adminName = process.env.INITIAL_ADMIN_NAME?.trim();
  const cashierEmail = process.env.INITIAL_CASHIER_EMAIL?.trim().toLowerCase();
  const cashierPassword = process.env.INITIAL_CASHIER_PASSWORD;
  const cashierName = process.env.INITIAL_CASHIER_NAME?.trim();

  if (
    !bootstrapToken ||
    !adminEmail ||
    !adminPassword ||
    !adminName ||
    !cashierEmail ||
    !cashierPassword ||
    !cashierName ||
    bootstrapToken.length < 32 ||
    !secretsMatch(request.headers.get("x-bootstrap-token"), bootstrapToken)
  ) {
    return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  }

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail) ||
    adminPassword.length < 14 ||
    adminName.length === 0 ||
    adminName.length > 150 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cashierEmail) ||
    cashierPassword.length < 14 ||
    cashierName.length === 0 ||
    cashierName.length > 150 ||
    adminEmail === cashierEmail ||
    adminPassword === cashierPassword
  ) {
    return NextResponse.json(
      { message: "La configuración inicial de las cuentas no es válida." },
      { status: 500 },
    );
  }

  try {
    const accountsCreated = await bootstrapInitialAccounts(
      { name: adminName, email: adminEmail, password: adminPassword },
      { name: cashierName, email: cashierEmail, password: cashierPassword },
    );

    if (!accountsCreated) {
      return NextResponse.json(
        { message: "El administrador principal ya fue creado." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        message: "Las cuentas iniciales fueron creadas.",
        roles: ["ADMIN", "CASHIER"],
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    console.error("Initial account bootstrap failed:", error);
    return NextResponse.json(
      { message: "No fue posible crear las cuentas iniciales." },
      { status: 500 },
    );
  }
}
