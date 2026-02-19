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
  const mode = tenantSnap.data()?.keyStorageMode;
  if (mode !== "tags") {
    return NextResponse.json({ error: "Key storage is not in tags mode" }, { status: 400 });
  }

  let body: { tagNumber?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const tagNumber = typeof body.tagNumber === "string" ? body.tagNumber.trim() : "";
  if (!tagNumber) {
    return NextResponse.json({ error: "Tag number is required" }, { status: 400 });
  }

  const ticketRef = db.collection("tenants").doc(tenantId).collection("tickets").doc(ticketId);
  const ticketSnap = await ticketRef.get();
  if (!ticketSnap.exists) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const existingSnap = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("tickets")
    .where("status", "in", ACTIVE_STATUSES)
    .get();

  for (const d of existingSnap.docs) {
    if (d.id === ticketId) continue;
    if ((d.data().tagNumber ?? "").toString().trim() === tagNumber) {
      return NextResponse.json(
        { error: "That tag number is already in use by another ticket" },
        { status: 409 }
      );
    }
  }

  await ticketRef.update({
    tagNumber,
    updatedAt: new Date().toISOString(),
  });
  return NextResponse.json({ tagNumber });
}
