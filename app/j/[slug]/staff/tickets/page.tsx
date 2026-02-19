import { notFound } from "next/navigation";
import { getTenantConfigBySlugServer } from "@/lib/utils/tenant-server";
import { StaffNav } from "../staff-nav";
import { TicketHistoryList } from "./ticket-history-list";

export default async function StaffTicketsPage({
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
      <h2 className="text-xl font-semibold mb-4">Ticket history</h2>
      <TicketHistoryList tenantId={tenant.id} />
    </div>
  );
}
