import { NextResponse } from "next/server";

import { ADMIN_ROLE, authorizeRoles } from "@/lib/auth/authorization";
import { ReportServiceError, getSalesReport } from "@/services/report-service";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const authorization = await authorizeRoles([ADMIN_ROLE]);
  if (!authorization.authorized) return authorization.response;
  try {
    const search = new URL(request.url).searchParams;
    const report = await getSalesReport(
      search.get("from"),
      search.get("to"),
    );
    return NextResponse.json(report, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error: unknown) {
    if (error instanceof ReportServiceError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }
    console.error("Sales report request failed:", error);
    return NextResponse.json(
      { message: "No fue posible generar el reporte de ventas." },
      { status: 500 },
    );
  }
}
