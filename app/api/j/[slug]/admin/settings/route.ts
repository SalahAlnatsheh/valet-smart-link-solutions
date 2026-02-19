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

  const db = getAdminFirestore();
  const tenantSnap = await db.collection("tenants").doc(tenantId).get();
  if (!tenantSnap.exists) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  return NextResponse.json({ id: tenantSnap.id, ...tenantSnap.data() });
}

export async function PATCH(
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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const allowed = [
    "name",
    "country",
    "currency",
    "pricing",
    "payment",
    "cashEnabled",
    "branding",
    "geofence",
    "keyStorageMode",
    "keyStorageSlotsCount",
    "newTicketRequired",
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key] === null ? null : body[key];
  }
  updates.updatedAt = new Date().toISOString();

  const db = getAdminFirestore();
  await db.collection("tenants").doc(tenantId).update(updates);
  const updated = await db.collection("tenants").doc(tenantId).get();
  return NextResponse.json({ success: true, settings: { id: updated.id, ...updated.data() } });
}
