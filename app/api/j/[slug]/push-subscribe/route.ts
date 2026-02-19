import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { resolveTenantIdBySlugServer } from "@/lib/utils/tenant-server";
import { getAdminFirestore } from "@/lib/firebase/admin";

interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

interface PushSubscriptionBody {
  endpoint: string;
  expirationTime?: number | null;
  keys: PushSubscriptionKeys;
}

function sha256Hex(message: string): string {
  return createHash("sha256").update(message).digest("hex");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const tenantId = await resolveTenantIdBySlugServer(slug);
  if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  let body: { publicId?: string; token?: string; subscription?: PushSubscriptionBody };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { publicId, token, subscription } = body;
  if (!publicId || !token || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return NextResponse.json(
      { error: "Missing publicId, token, or subscription (endpoint and keys)" },
      { status: 400 }
    );
  }

  const db = getAdminFirestore();
  const publicRef = db.collection("tenants").doc(tenantId).collection("publicTickets").doc(publicId);
  const publicSnap = await publicRef.get();
  if (!publicSnap.exists) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const ticketId = publicSnap.data()?.ticketId;
  if (!ticketId) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const ticketSnap = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("tickets")
    .doc(ticketId)
    .get();
  if (!ticketSnap.exists) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const tokenHash = ticketSnap.data()?.tokenHash;
  const expectedHash = sha256Hex(token);
  if (tokenHash !== expectedHash) return NextResponse.json({ error: "Invalid token" }, { status: 403 });

  const subDoc = db.collection("tenants").doc(tenantId).collection("pushSubscriptions").doc(publicId);
  const existing = await subDoc.get();
  const subs: PushSubscriptionBody[] = existing.exists ? (existing.data()?.subscriptions ?? []) : [];
  const filtered = subs.filter((s) => s.endpoint !== subscription.endpoint);
  filtered.push({
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime ?? null,
    keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
  });

  await subDoc.set({ subscriptions: filtered, updatedAt: new Date().toISOString() });
  return NextResponse.json({ success: true });
}
