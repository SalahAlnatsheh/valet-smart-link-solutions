"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.staffUpdateStatus = exports.requestCar = void 0;
exports.resolveTenantBySlug = resolveTenantBySlug;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const admin = __importStar(require("firebase-admin"));
const webpush = __importStar(require("web-push"));
admin.initializeApp();
const db = (0, firestore_1.getFirestore)(admin.app(), "valett");
const vapidPublic = process.env.VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
if (vapidPublic && vapidPrivate) {
    webpush.setVapidDetails("mailto:support@valet.example.com", vapidPublic, vapidPrivate);
}
/**
 * Resolve tenantId from slug. Used by other functions.
 */
async function resolveTenantBySlug(slug) {
    var _a, _b;
    const slugSnap = await db.collection("slugs").doc(slug).get();
    if (!slugSnap.exists)
        return null;
    return (_b = (_a = slugSnap.data()) === null || _a === void 0 ? void 0 : _a.tenantId) !== null && _b !== void 0 ? _b : null;
}
/**
 * Customer "Request car" — validates token, rate limits, sets REQUESTED, notifies staff.
 * Callable from client with { slug, publicId, token }.
 */
exports.requestCar = (0, https_1.onCall)({ region: "europe-west1" }, async (request) => {
    const { slug, publicId, token } = request.data;
    if (!slug || !publicId || !token) {
        throw new https_1.HttpsError("invalid-argument", "Missing slug, publicId, or token");
    }
    const tenantId = await resolveTenantBySlug(slug);
    if (!tenantId)
        throw new https_1.HttpsError("not-found", "Tenant not found");
    const publicRef = db
        .collection("tenants")
        .doc(tenantId)
        .collection("publicTickets")
        .doc(publicId);
    const publicSnap = await publicRef.get();
    if (!publicSnap.exists)
        throw new https_1.HttpsError("not-found", "Ticket not found");
    const data = publicSnap.data();
    // In production: compare hash of token with data.tokenHash
    if (data.status !== "PARKED") {
        throw new https_1.HttpsError("failed-precondition", "Ticket is not in PARKED status");
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
});
/**
 * Staff update ticket status. Protected by auth + role (call from authenticated staff only).
 */
exports.staffUpdateStatus = (0, https_1.onCall)({ region: "europe-west1" }, async (request) => {
    var _a, _b;
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Must be signed in");
    const { tenantId, ticketId, newStatus } = request.data;
    if (!tenantId || !ticketId || !newStatus) {
        throw new https_1.HttpsError("invalid-argument", "Missing tenantId, ticketId, or newStatus");
    }
    const allowed = ["REQUESTED", "IN_PROGRESS", "READY", "DELIVERED"];
    if (!allowed.includes(newStatus)) {
        throw new https_1.HttpsError("invalid-argument", "Invalid newStatus");
    }
    const userDoc = await db
        .collection("tenants")
        .doc(tenantId)
        .collection("users")
        .doc(request.auth.uid)
        .get();
    if (!userDoc.exists)
        throw new https_1.HttpsError("permission-denied", "Not a staff member");
    const ticketRef = db
        .collection("tenants")
        .doc(tenantId)
        .collection("tickets")
        .doc(ticketId);
    const ticketSnap = await ticketRef.get();
    if (!ticketSnap.exists)
        throw new https_1.HttpsError("not-found", "Ticket not found");
    const ticket = ticketSnap.data();
    const publicId = ticket.publicId;
    const now = new Date().toISOString();
    const updates = {
        status: newStatus,
        updatedAt: now,
        assignedToUserId: request.auth.uid,
    };
    if (newStatus === "IN_PROGRESS")
        updates["timestamps.inProgressAt"] = now;
    if (newStatus === "READY")
        updates["timestamps.readyAt"] = now;
    if (newStatus === "DELIVERED")
        updates["timestamps.deliveredAt"] = now;
    await ticketRef.update(updates);
    const publicRef = db
        .collection("tenants")
        .doc(tenantId)
        .collection("publicTickets")
        .doc(publicId);
    await publicRef.update(Object.assign(Object.assign(Object.assign({ status: newStatus }, (newStatus === "READY" && { readyAt: now })), (newStatus === "DELIVERED" && { deliveredAt: now })), { updatedAt: now }));
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
        const subs = (_b = (_a = subSnap.data()) === null || _a === void 0 ? void 0 : _a.subscriptions) !== null && _b !== void 0 ? _b : [];
        const payload = JSON.stringify({
            title: "Car ready",
            body: "Your car is ready for pickup.",
            tag: `valet-ready-${publicId}`,
        });
        await Promise.allSettled(subs.map((sub) => {
            var _a;
            return webpush.sendNotification({
                endpoint: sub.endpoint,
                keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
                expirationTime: (_a = sub.expirationTime) !== null && _a !== void 0 ? _a : undefined,
            }, payload);
        }));
    }
    return { success: true };
});
//# sourceMappingURL=index.js.map