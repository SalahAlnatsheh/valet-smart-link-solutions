import { notFound } from "next/navigation";
import { getTenantConfigBySlugServer } from "@/lib/utils/tenant-server";
import { StaffNav } from "../staff-nav";
import { RequestsQueue } from "./requests-queue";

export default async function StaffRequestsPage({
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
      <h2 className="text-xl font-semibold mb-4">Requests queue</h2>
      <RequestsQueue
        slug={slug}
        tenantId={tenant.id}
        keyStorageMode={tenant.keyStorageMode}
        keyStorageSlotsCount={tenant.keyStorageSlotsCount ?? 100}
      />
    </div>
  );
}
