import { redirect } from "next/navigation";
import { getVerifiedTenantContext } from "@/lib/auth/session";
import { requirePermission } from "@/lib/tenant/access";

export const dynamic = "force-dynamic";

export default async function ProcurementLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const auth = await getVerifiedTenantContext();
  if (!auth) redirect("/login");
  try {
    requirePermission(auth.context, "procurement.purchase_order.read");
  } catch {
    redirect("/overview?access=denied");
  }
  return children;
}
