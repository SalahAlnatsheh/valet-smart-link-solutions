import { notFound } from "next/navigation";
import { getTenantConfigBySlugServer } from "@/lib/utils/tenant-server";
import { CustomerTicketView } from "./customer-ticket-view";

export default async function CustomerTicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; publicId: string }>;
  searchParams: Promise<{ k?: string }>;
}) {
  const { slug, publicId } = await params;
  const { k: token } = await searchParams;
  const tenant = await getTenantConfigBySlugServer(slug);
  if (!tenant) notFound();
  return (
    <CustomerTicketView
      slug={slug}
      publicId={publicId}
      token={token ?? ""}
      tenantId={tenant.id}
      tenantName={tenant.name}
    />
  );
}
