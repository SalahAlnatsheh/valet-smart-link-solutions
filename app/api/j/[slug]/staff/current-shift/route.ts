import { NextRequest, NextResponse } from "next/server";
import { resolveTenantIdBySlugServer } from "@/lib/utils/tenant-server";
import { verifyIdToken } from "@/lib/auth/verify-token";
import { requireStaffForTenant } from "@/lib/auth/verify-token";
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
  const isStaff = await requireStaffForTenant(tenantId, decoded.uid);
  if (!isStaff) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const db = getAdminFirestore();
    const shiftsSnap = await db
      .collection("tenants")
      .doc(tenantId)
      .collection("shifts")
      .where("userId", "==", decoded.uid)
      .orderBy("checkInAt", "desc")
      .limit(5)
      .get();

    const openShift = shiftsSnap.docs.find((d) => !d.data().checkOutAt);
    if (!openShift) {
      return NextResponse.json({ openShiftId: null });
    }
    const data = openShift.data();
    return NextResponse.json({
      openShiftId: openShift.id,
      checkInAt: data.checkInAt,
    });
  } catch (err) {
    console.error("current-shift error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load shift" },
      { status: 500 }
    );
  }
}
