import { NextRequest, NextResponse } from "next/server";
import { resolveTenantIdBySlugServer } from "@/lib/utils/tenant-server";
import { verifyIdToken } from "@/lib/auth/verify-token";
import { requireAdminForTenant } from "@/lib/auth/verify-token";
import { getAuth } from "firebase-admin/auth";
import { getAdminApp } from "@/lib/firebase/admin";
import { getAdminFirestore } from "@/lib/firebase/admin";

export async function POST(
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

  let body: { email?: string; password?: string; name?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { email, password, name, role } = body;
  if (!email || !password || !name) {
    return NextResponse.json({ error: "Missing email, password, or name" }, { status: 400 });
  }
  const safeRole = role === "manager" || role === "valet" ? role : "valet";

  const auth = getAuth(getAdminApp());
  let user;
  try {
    user = await auth.createUser({ email, password, displayName: name });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create user";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const now = new Date().toISOString();
  const db = getAdminFirestore();
  await db
    .collection("tenants")
    .doc(tenantId)
    .collection("users")
    .doc(user.uid)
    .set({
      email,
      name,
      role: safeRole,
      active: true,
      createdAt: now,
      updatedAt: now,
    });

  return NextResponse.json({ success: true, uid: user.uid });
}
