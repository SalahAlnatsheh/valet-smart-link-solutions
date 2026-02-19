import { notFound } from "next/navigation";
import { getTenantConfigBySlugServer } from "@/lib/utils/tenant-server";
import { AdminNav } from "./admin-nav";
import { AdminDashboard } from "./admin-dashboard";

export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getTenantConfigBySlugServer(slug);
  if (!tenant) notFound();
  return (
    <div className="min-h-screen p-6">
      <AdminNav slug={slug} tenantName={tenant.name} />
      <h2 className="text-xl font-semibold mb-4">Dashboard</h2>
      <AdminDashboard slug={slug} tenantName={tenant.name} />
    </div>
  );
}
