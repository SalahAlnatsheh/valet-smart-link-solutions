import { NextRequest, NextResponse } from "next/server";
import { resolveTenantIdBySlugServer } from "@/lib/utils/tenant-server";
import { verifyIdToken } from "@/lib/auth/verify-token";
import { requireStaffForTenant } from "@/lib/auth/verify-token";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isWithinRadius } from "@/lib/utils/geofence";

export async function POST(
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

  let body: { lat: number; lng: number; accuracy?: number; deviceId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { lat, lng, accuracy, deviceId } = body;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json({ error: "Missing lat/lng" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const tenantSnap = await db.collection("tenants").doc(tenantId).get();
  const tenant = tenantSnap.data();
  const geofence = tenant?.geofence as { lat: number; lng: number; radiusMeters: number } | undefined;
  if (geofence) {
    const within = isWithinRadius(geofence.lat, geofence.lng, geofence.radiusMeters, lat, lng);
    if (!within) {
      return NextResponse.json(
        { error: "Check-in only allowed within the venue area. Please enable location." },
        { status: 400 }
      );
    }
  }

  const now = new Date().toISOString();
  const shiftRef = await db.collection("tenants").doc(tenantId).collection("shifts").add({
    userId: decoded.uid,
    tenantId,
    checkInAt: now,
    checkInLocation: { lat, lng, ...(typeof accuracy === "number" && { accuracy }) },
    ...(deviceId && { deviceId }),
  });

  return NextResponse.json({ success: true, shiftId: shiftRef.id });
}
