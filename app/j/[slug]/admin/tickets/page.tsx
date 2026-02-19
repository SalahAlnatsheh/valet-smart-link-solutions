import { notFound } from "next/navigation";
import { getTenantConfigBySlugServer } from "@/lib/utils/tenant-server";
import { AdminNav } from "../admin-nav";
import { TicketList } from "./ticket-list";

export default async function AdminTicketsPage({
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
      <h2 className="text-xl font-semibold mb-4">Ticket history</h2>
      <TicketList slug={slug} />
    </div>
  );
}
