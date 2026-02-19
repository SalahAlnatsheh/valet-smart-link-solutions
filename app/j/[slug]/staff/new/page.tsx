import { notFound } from "next/navigation";
import { getTenantConfigBySlugServer } from "@/lib/utils/tenant-server";
import { StaffNav } from "../staff-nav";
import { NewTicketForm } from "./new-ticket-form";

export default async function NewTicketPage({
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
      <h2 className="text-xl font-semibold mb-4">New ticket</h2>
      <NewTicketForm
        slug={slug}
        tenantId={tenant.id}
        keyStorageMode={tenant.keyStorageMode}
        keyStorageSlotsCount={tenant.keyStorageSlotsCount ?? 100}
        newTicketRequired={tenant.newTicketRequired}
      />
    </div>
  );
}
