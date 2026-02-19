import { notFound } from "next/navigation";
import { getTenantConfigBySlugServer } from "@/lib/utils/tenant-server";
import { StaffNav } from "../staff-nav";
import { DashboardSummary } from "./dashboard-summary";

export default async function StaffDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getTenantConfigBySlugServer(slug);
  if (!tenant) notFound();
  return (
    <div className="min-h-screen p-6">
      <StaffNav slug={slug} tenantName={tenant.name} />
      <h2 className="text-xl font-semibold mb-4">Dashboard</h2>
      <DashboardSummary slug={slug} tenantId={tenant.id} />
    </div>
  );
}
