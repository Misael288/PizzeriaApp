import { NextResponse } from "next/server";

import { CatalogServiceError } from "@/services/catalog-service";

const catalogErrorResponse = (error: unknown): NextResponse => {
  if (error instanceof CatalogServiceError) {
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

  console.error("Catalog request failed:", error);
  return NextResponse.json(
    { message: "No fue posible completar la operación del catálogo." },
    { status: 500 },
  );
};

const isSameOriginRequest = (request: Request): boolean => {
  const origin = request.headers.get("origin");

  if (!origin) {
    return false;
  }

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
};

const parseRouteId = (value: string): number | null => {
  if (!/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
};

export { catalogErrorResponse, isSameOriginRequest, parseRouteId };
