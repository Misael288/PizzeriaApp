import { NextResponse } from "next/server";

import { prisma } from "@/lib/database/prisma";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: "ok",
      database: "connected",
      orm: "prisma",
    });
  } catch (error: unknown) {
    console.error("PostgreSQL health check failed:", error);

    return NextResponse.json(
      {
        status: "error",
        database: "unavailable",
        orm: "prisma",
      },
      { status: 503 },
    );
  }
}
