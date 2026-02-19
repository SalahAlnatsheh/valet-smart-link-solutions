import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { resolveTenantIdBySlugServer } from "@/lib/utils/tenant-server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  const tenantId = await resolveTenantIdBySlugServer(slug);
  if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  const db = getAdminFirestore();
  const usersSnap = await db.collection("tenants").doc(tenantId).collection("users").limit(1).get();
  return NextResponse.json({ hasUsers: !usersSnap.empty });
}
