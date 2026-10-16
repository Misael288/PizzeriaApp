import type { Metadata } from "next";

import { OrderTracking } from "@/components/orders/order-tracking";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Seguimiento de pedido | Pizzería",
  robots: { index: false, follow: false },
};

export default async function OrderTrackingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <OrderTracking token={token} />;
}
