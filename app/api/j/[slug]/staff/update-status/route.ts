import { NextRequest, NextResponse } from "next/server";
import { resolveTenantIdBySlugServer } from "@/lib/utils/tenant-server";
import { verifyIdToken } from "@/lib/auth/verify-token";
import { requireStaffForTenant } from "@/lib/auth/verify-token";
import { getAdminFirestore } from "@/lib/firebase/admin";
import * as webpush from "web-push";

const ALLOWED_STATUSES = ["REQUESTED", "IN_PROGRESS", "READY", "DELIVERED"] as const;

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

  let body: { ticketId?: string; newStatus?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { ticketId, newStatus } = body;
  if (!ticketId || !newStatus) {
    return NextResponse.json(
      { error: "Missing ticketId or newStatus" },
      { status: 400 }
    );
  }
  if (!ALLOWED_STATUSES.includes(newStatus as (typeof ALLOWED_STATUSES)[number])) {
    return NextResponse.json({ error: "Invalid newStatus" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const ticketRef = db.collection("tenants").doc(tenantId).collection("tickets").doc(ticketId);
  const ticketSnap = await ticketRef.get();
  if (!ticketSnap.exists) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const ticket = ticketSnap.data()!;
  const publicId = ticket.publicId as string;
  const now = new Date().toISOString();

  const updates: Record<string, unknown> = {
    status: newStatus,
    updatedAt: now,
    assignedToUserId: decoded.uid,
  };
  if (newStatus === "IN_PROGRESS") updates["timestamps.inProgressAt"] = now;
  if (newStatus === "READY") updates["timestamps.readyAt"] = now;
  if (newStatus === "DELIVERED") updates["timestamps.deliveredAt"] = now;

  await ticketRef.update(updates);

  const publicRef = db
    .collection("tenants")
    .doc(tenantId)
    .collection("publicTickets")
    .doc(publicId);
  await publicRef.update({
    status: newStatus,
    ...(newStatus === "READY" && { readyAt: now }),
    ...(newStatus === "DELIVERED" && { deliveredAt: now }),
    updatedAt: now,
  });

  await db.collection("tenants").doc(tenantId).collection("events").add({
    ticketId,
    actorUserId: decoded.uid,
    type: newStatus === "IN_PROGRESS" ? "ACCEPTED" : newStatus,
    at: now,
    meta: { newStatus },
  });

  const vapidPublic = process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (newStatus === "READY" && vapidPublic && vapidPrivate) {
    try {
      webpush.setVapidDetails("mailto:support@valet.example.com", vapidPublic, vapidPrivate);
      const subSnap = await db
        .collection("tenants")
        .doc(tenantId)
        .collection("pushSubscriptions")
        .doc(publicId)
        .get();
      const subs =
        (subSnap.data()?.subscriptions as Array<{
          endpoint: string;
          keys: { p256dh: string; auth: string };
          expirationTime?: number | null;
        }>) ?? [];
      const payload = JSON.stringify({
        title: "Car ready",
        body: "Your car is ready for pickup.",
        tag: `valet-ready-${publicId}`,
      });
      await Promise.allSettled(
        subs.map((sub) =>
          webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
              expirationTime: sub.expirationTime ?? undefined,
            },
            payload
          )
        )
      );
    } catch {
      // non-fatal: status update already done
    }
  }

  return NextResponse.json({ success: true });
}
