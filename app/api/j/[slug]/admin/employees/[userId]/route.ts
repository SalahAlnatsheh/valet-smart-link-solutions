import { NextRequest, NextResponse } from "next/server";
import { resolveTenantIdBySlugServer } from "@/lib/utils/tenant-server";
import { verifyIdToken } from "@/lib/auth/verify-token";
import { requireAdminForTenant } from "@/lib/auth/verify-token";
import { getAdminFirestore } from "@/lib/firebase/admin";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; userId: string }> }
) {
  const { slug, userId } = await params;
  const tenantId = await resolveTenantIdBySlugServer(slug);
  if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const decoded = await verifyIdToken(request.headers.get("authorization"));
  if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isAdmin = await requireAdminForTenant(tenantId, decoded.uid);
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { active?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.active !== "boolean") {
    return NextResponse.json({ error: "Missing or invalid active" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const userRef = db.collection("tenants").doc(tenantId).collection("users").doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await userRef.update({
    active: body.active,
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true });
}
