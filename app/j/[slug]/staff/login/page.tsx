import { notFound } from "next/navigation";
import { getTenantConfigBySlugServer } from "@/lib/utils/tenant-server";
import { StaffLoginForm } from "./staff-login-form";

export default async function StaffLoginPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getTenantConfigBySlugServer(slug);
  if (!tenant) notFound();
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <StaffLoginForm slug={slug} tenantId={tenant.id} tenantName={tenant.name} />
    </div>
  );
}
