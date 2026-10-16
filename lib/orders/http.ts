import { NextResponse } from "next/server";

import { OrderServiceError } from "@/services/order-service";

const orderErrorResponse = (error: unknown): NextResponse => {
  if (error instanceof OrderServiceError) {
    return NextResponse.json(
      { message: error.message },
      { status: error.status },
    );
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  ) {
    return NextResponse.json(
      { message: "Ya existe un pedido con esos datos." },
      { status: 409 },
    );
  }

  console.error("Order request failed:", error);
  return NextResponse.json(
    { message: "No fue posible completar la operación del pedido." },
    { status: 500 },
  );
};

export { orderErrorResponse };
