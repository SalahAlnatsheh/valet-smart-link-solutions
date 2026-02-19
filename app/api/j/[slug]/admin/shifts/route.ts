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

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);

  const db = getAdminFirestore();
  const snaps = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("shifts")
    .orderBy("checkInAt", "desc")
    .limit(limit)
    .get();

  const shifts = snaps.docs.map((d) => ({ id: d.id, ...d.data() })) as { id: string; userId: string; [k: string]: unknown }[];
  const userIds = [...new Set(shifts.map((s) => s.userId).filter(Boolean))];
  const usersRef = db.collection("tenants").doc(tenantId).collection("users");
  const userSnaps = await Promise.all(userIds.map((uid) => usersRef.doc(uid).get()));
  const userMap: Record<string, { displayName?: string; email?: string }> = {};
  userIds.forEach((uid, i) => {
    const data = userSnaps[i]?.data();
    if (data) userMap[uid] = { displayName: data.displayName, email: data.email };
  });

  const shiftsWithNames = shifts.map((s) => ({
    ...s,
    displayName: userMap[s.userId]?.displayName,
    email: userMap[s.userId]?.email,
  }));
  return NextResponse.json({ shifts: shiftsWithNames });
}
