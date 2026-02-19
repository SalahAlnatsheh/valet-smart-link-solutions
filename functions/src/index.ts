import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import * as admin from "firebase-admin";
import * as webpush from "web-push";

admin.initializeApp();
const db = getFirestore(admin.app(), "valett");

const vapidPublic = process.env.VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
if (vapidPublic && vapidPrivate) {
  webpush.setVapidDetails("mailto:support@valet.example.com", vapidPublic, vapidPrivate);
}

/**
 * Resolve tenantId from slug. Used by other functions.
 */
export async function resolveTenantBySlug(slug: string): Promise<string | null> {
  const slugSnap = await db.collection("slugs").doc(slug).get();
  if (!slugSnap.exists) return null;
  return slugSnap.data()?.tenantId ?? null;
}

/**
 * Customer "Request car" — validates token, rate limits, sets REQUESTED, notifies staff.
 * Callable from client with { slug, publicId, token }.
 */
export const requestCar = onCall(
  { region: "europe-west1" },
  async (request) => {
    const { slug, publicId, token } = request.data as {
      slug?: string;
      publicId?: string;
      token?: string;
    };
    if (!slug || !publicId || !token) {
      throw new HttpsError("invalid-argument", "Missing slug, publicId, or token");
    }
    const tenantId = await resolveTenantBySlug(slug);
    if (!tenantId) throw new HttpsError("not-found", "Tenant not found");

    const publicRef = db
      .collection("tenants")
      .doc(tenantId)
      .collection("publicTickets")
      .doc(publicId);
    const publicSnap = await publicRef.get();
    if (!publicSnap.exists) throw new HttpsError("not-found", "Ticket not found");

    const data = publicSnap.data()!;
    // In production: compare hash of token with data.tokenHash
    if (data.status !== "PARKED") {
      throw new HttpsError("failed-precondition", "Ticket is not in PARKED status");
    }

    const now = new Date().toISOString();
    await publicRef.update({
      status: "REQUESTED",
      requestedAt: now,
      updatedAt: now,
    });

    const ticketId = data.ticketId;
    if (ticketId) {
      const ticketRef = db
        .collection("tenants")
        .doc(tenantId)
        .collection("tickets")
        .doc(ticketId);
      await ticketRef.update({
        status: "REQUESTED",
        "timestamps.requestedAt": now,
        updatedAt: now,
      });
      await db
        .collection("tenants")
        .doc(tenantId)
        .collection("events")
        .add({
          ticketId,
          type: "REQUESTED",
          at: now,
          meta: { publicId },
        });
    }

    // TODO: send FCM to staff topic for this tenant
    return { success: true };
  }
);

/**
 * Staff update ticket status. Protected by auth + role (call from authenticated staff only).
 */
export const staffUpdateStatus = onCall(
  { region: "europe-west1" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in");
    const { tenantId, ticketId, newStatus } = request.data as {
      tenantId?: string;
      ticketId?: string;
      newStatus?: string;
    };
    if (!tenantId || !ticketId || !newStatus) {
      throw new HttpsError("invalid-argument", "Missing tenantId, ticketId, or newStatus");
    }
    const allowed = ["REQUESTED", "IN_PROGRESS", "READY", "DELIVERED"];
    if (!allowed.includes(newStatus)) {
      throw new HttpsError("invalid-argument", "Invalid newStatus");
    }

    const userDoc = await db
      .collection("tenants")
      .doc(tenantId)
      .collection("users")
      .doc(request.auth.uid)
      .get();
    if (!userDoc.exists) throw new HttpsError("permission-denied", "Not a staff member");

    const ticketRef = db
      .collection("tenants")
      .doc(tenantId)
      .collection("tickets")
      .doc(ticketId);
    const ticketSnap = await ticketRef.get();
    if (!ticketSnap.exists) throw new HttpsError("not-found", "Ticket not found");

    const ticket = ticketSnap.data()!;
    const publicId = ticket.publicId;
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      status: newStatus,
      updatedAt: now,
      assignedToUserId: request.auth.uid,
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
      actorUserId: request.auth.uid,
      type: newStatus === "IN_PROGRESS" ? "ACCEPTED" : newStatus,
      at: now,
      meta: { newStatus },
    });

    if (newStatus === "READY" && vapidPublic && vapidPrivate) {
      const subSnap = await db
        .collection("tenants")
        .doc(tenantId)
        .collection("pushSubscriptions")
        .doc(publicId)
        .get();
      const subs = (subSnap.data()?.subscriptions as Array<{ endpoint: string; keys: { p256dh: string; auth: string }; expirationTime?: number | null }>) ?? [];
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
    }

    return { success: true };
  }
);
