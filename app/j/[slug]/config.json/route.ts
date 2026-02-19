import { NextRequest, NextResponse } from "next/server";
import { getTenantConfigBySlugServer, getPublicConfig } from "@/lib/utils/tenant-server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }
  const tenant = await getTenantConfigBySlugServer(slug);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }
  const config = getPublicConfig(tenant);
  return NextResponse.json(config, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
