import { NextRequest, NextResponse } from "next/server";
import { getTenantConfigBySlugServer, getThemeCss } from "@/lib/utils/tenant-server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!slug) {
    return new NextResponse("Missing slug", { status: 400 });
  }
  const tenant = await getTenantConfigBySlugServer(slug);
  if (!tenant) {
    return new NextResponse("Tenant not found", { status: 404 });
  }
  const css = getThemeCss(tenant);
  return new NextResponse(css, {
    status: 200,
    headers: {
      "Content-Type": "text/css; charset=utf-8",
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
