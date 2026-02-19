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
  const ticketsRef = db.collection("tenants").doc(tenantId).collection("tickets");
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  const weekStartISO = weekStart.toISOString();

  const [todaySnap, weekSnap, allSnap] = await Promise.all([
    ticketsRef.where("createdAt", ">=", todayStart).get(),
    ticketsRef.where("createdAt", ">=", weekStartISO).get(),
    ticketsRef.get(),
  ]);

  const ticketsWithTimestamps = allSnap.docs.map((d) => d.data());
  const withRequestReady = ticketsWithTimestamps.filter(
    (t) => t.timestamps?.requestedAt && t.timestamps?.readyAt
  );
  const withReadyDelivered = ticketsWithTimestamps.filter(
    (t) => t.timestamps?.readyAt && t.timestamps?.deliveredAt
  );
  const avgRequestReady =
    withRequestReady.length > 0
      ? withRequestReady.reduce((acc, t) => {
          const req = new Date(t.timestamps.requestedAt).getTime();
          const ready = new Date(t.timestamps.readyAt).getTime();
          return acc + (ready - req) / 60000;
        }, 0) / withRequestReady.length
      : null;
  const avgReadyDelivered =
    withReadyDelivered.length > 0
      ? withReadyDelivered.reduce((acc, t) => {
          const ready = new Date(t.timestamps.readyAt).getTime();
          const del = new Date(t.timestamps.deliveredAt).getTime();
          return acc + (del - ready) / 60000;
        }, 0) / withReadyDelivered.length
      : null;

  return NextResponse.json({
    ticketsToday: todaySnap.size,
    ticketsThisWeek: weekSnap.size,
    avgRequestToReadyMinutes: avgRequestReady != null ? Math.round(avgRequestReady) : null,
    avgReadyToDeliveredMinutes: avgReadyDelivered != null ? Math.round(avgReadyDelivered) : null,
  });
}
