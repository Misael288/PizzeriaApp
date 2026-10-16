import { PublicMenu } from "@/components/orders/public-menu";
import { ADMIN_ROLE } from "@/lib/auth/constants";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { getPublicMenu } from "@/services/order-service";
import { getPublicPaymentOptions } from "@/services/payment-settings-service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [menu, user, paymentOptions] = await Promise.all([
    getPublicMenu(),
    getAuthenticatedUser(),
    getPublicPaymentOptions(),
  ]);
  return (
    <PublicMenu
      {...menu}
      paymentOptions={paymentOptions}
      staffHref={user ? (user.role === ADMIN_ROLE ? "/dashboard" : "/orders") : null}
    />
  );
}
