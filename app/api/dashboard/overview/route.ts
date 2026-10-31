import { NextResponse } from "next/server";

import {
  ADMIN_ROLE,
  CASHIER_ROLE,
  authorizeRoles,
} from "@/lib/auth/authorization";
import { getStaffOrderQueue } from "@/services/order-service";
import {
  getDashboardSalesTotal,
  ReportServiceError,
} from "@/services/report-service";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  const authorization = await authorizeRoles([ADMIN_ROLE, CASHIER_ROLE]);
  if (!authorization.authorized) return authorization.response;

  try {
    const search = new URL(request.url).searchParams;
    const [queue, totalSales] = await Promise.all([
      getStaffOrderQueue(),
      getDashboardSalesTotal(search.get("from"), search.get("until")),
    ]);

    return NextResponse.json(
      { orders: queue.orders, totalSales },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: unknown) {
    if (error instanceof ReportServiceError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }
    console.error("Dashboard overview request failed:", error);
    return NextResponse.json(
      { message: "No fue posible cargar el panel operativo." },
      { status: 500 },
    );
  }
}
