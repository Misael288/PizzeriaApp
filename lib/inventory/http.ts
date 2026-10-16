import { NextResponse } from "next/server";

import { InventoryServiceError } from "@/services/inventory-service";

const inventoryErrorResponse = (error: unknown): NextResponse => {
  if (error instanceof InventoryServiceError) {
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
      { message: "Ya existe un registro con esos datos." },
      { status: 409 },
    );
  }
  console.error("Inventory request failed:", error);
  return NextResponse.json(
    { message: "No fue posible completar la operación de inventario." },
    { status: 500 },
  );
};

export { inventoryErrorResponse };
