import { NextRequest, NextResponse } from "next/server";
import { resolveTenantIdBySlugServer } from "@/lib/utils/tenant-server";
import { verifyIdToken } from "@/lib/auth/verify-token";
import { requireStaffForTenant } from "@/lib/auth/verify-token";
import { getAdminFirestore } from "@/lib/firebase/admin";

const ACTIVE_STATUSES = ["PARKED", "REQUESTED", "IN_PROGRESS", "READY"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; ticketId: string }> }
) {
  const { slug, ticketId } = await params;
  const tenantId = await resolveTenantIdBySlugServer(slug);
  if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const decoded = await verifyIdToken(request.headers.get("authorization"));
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isStaff = await requireStaffForTenant(tenantId, decoded.uid);
  if (!isStaff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = getAdminFirestore();
  const tenantSnap = await db.collection("tenants").doc(tenantId).get();
  const tenant = tenantSnap.data();
  const mode = tenant?.keyStorageMode;
  const totalSlots = Math.max(1, Math.min(999, Number(tenant?.keyStorageSlotsCount) || 100));

  if (mode !== "slots") {
    return NextResponse.json({ error: "Key storage is not in slots mode" }, { status: 400 });
  }

  const ticketRef = db.collection("tenants").doc(tenantId).collection("tickets").doc(ticketId);
  const ticketSnap = await ticketRef.get();
  if (!ticketSnap.exists) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  let body: { slotNumber?: number };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const requestedSlot = body.slotNumber;

  const activeTicketsSnap = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("tickets")
    .where("status", "in", ACTIVE_STATUSES)
    .get();

  const usedSlots = new Set<number>();
  activeTicketsSnap.docs.forEach((d) => {
    if (d.id === ticketId) return;
    const slot = d.data().slotNumber;
    if (typeof slot === "number") usedSlots.add(slot);
  });

  if (requestedSlot !== undefined) {
    if (requestedSlot < 1 || requestedSlot > totalSlots) {
      return NextResponse.json(
        { error: `Slot must be between 1 and ${totalSlots}` },
        { status: 400 }
      );
    }
    if (usedSlots.has(requestedSlot)) {
      return NextResponse.json({ error: "That slot is already in use" }, { status: 409 });
    }
    await ticketRef.update({
      slotNumber: requestedSlot,
      updatedAt: new Date().toISOString(),
    });
    return NextResponse.json({ slotNumber: requestedSlot });
  }

  for (let s = 1; s <= totalSlots; s++) {
    if (!usedSlots.has(s)) {
      await ticketRef.update({
        slotNumber: s,
        updatedAt: new Date().toISOString(),
      });
      return NextResponse.json({ slotNumber: s });
    }
  }

  return NextResponse.json(
    { error: "No slots available", noSlotsAvailable: true },
    { status: 409 }
  );
}
