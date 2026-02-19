import { NextRequest, NextResponse } from "next/server";
import { resolveTenantIdBySlugServer } from "@/lib/utils/tenant-server";
import { verifyIdToken } from "@/lib/auth/verify-token";
import { requireAdminForTenant } from "@/lib/auth/verify-token";
import { getAdminFirestore } from "@/lib/firebase/admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const tenantId = await resolveTenantIdBySlugServer(slug);
  if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const decoded = await verifyIdToken(request.headers.get("authorization"));
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isAdmin = await requireAdminForTenant(tenantId, decoded.uid);
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);

  const db = getAdminFirestore();
  const snap = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("tickets")
    .orderBy("updatedAt", "desc")
    .limit(limit * 2)
    .get();

  interface TicketRow {
    id: string;
    status?: string;
    [key: string]: unknown;
  }
  let tickets: TicketRow[] = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  if (status) tickets = tickets.filter((t) => t.status === status).slice(0, limit);
  else tickets = tickets.slice(0, limit);

  return NextResponse.json({ tickets });
}
