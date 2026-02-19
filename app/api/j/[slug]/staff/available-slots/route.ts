import { NextRequest, NextResponse } from "next/server";
import { resolveTenantIdBySlugServer } from "@/lib/utils/tenant-server";
import { verifyIdToken } from "@/lib/auth/verify-token";
import { requireStaffForTenant } from "@/lib/auth/verify-token";
import { getAdminFirestore } from "@/lib/firebase/admin";

const ACTIVE_STATUSES = ["PARKED", "REQUESTED", "IN_PROGRESS", "READY"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const tenantId = await resolveTenantIdBySlugServer(slug);
  if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const decoded = await verifyIdToken(request.headers.get("authorization"));
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isStaff = await requireStaffForTenant(tenantId, decoded.uid);
  if (!isStaff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const forTicketId = searchParams.get("forTicketId") ?? undefined;

  const db = getAdminFirestore();
  const tenantSnap = await db.collection("tenants").doc(tenantId).get();
  const mode = tenantSnap.data()?.keyStorageMode;
  const totalSlots = Math.max(1, Math.min(999, Number(tenantSnap.data()?.keyStorageSlotsCount) || 100));

  if (mode !== "slots") {
    return NextResponse.json({ error: "Key storage is not in slots mode" }, { status: 400 });
  }

  const activeSnap = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("tickets")
    .where("status", "in", ACTIVE_STATUSES)
    .get();

  const used = new Set<number>();
  activeSnap.docs.forEach((d) => {
    if (forTicketId && d.id === forTicketId) return;
    const slot = d.data().slotNumber;
    if (typeof slot === "number") used.add(slot);
  });

  const available: number[] = [];
  for (let s = 1; s <= totalSlots; s++) {
    if (!used.has(s)) available.push(s);
  }

  return NextResponse.json({ available, totalSlots });
}
