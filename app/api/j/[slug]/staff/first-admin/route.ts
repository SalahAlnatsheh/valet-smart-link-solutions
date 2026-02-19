import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { getAuth } from "firebase-admin/auth";
import { resolveTenantIdBySlugServer } from "@/lib/utils/tenant-server";
import { getAdminApp } from "@/lib/firebase/admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  const tenantId = await resolveTenantIdBySlugServer(slug);
  if (!tenantId) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  let body: { email?: string; password?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { email, password, name } = body;
  if (!email || !password || !name) {
    return NextResponse.json(
      { error: "Missing email, password, or name" },
      { status: 400 }
    );
  }

  const db = getAdminFirestore();
  const usersSnap = await db.collection("tenants").doc(tenantId).collection("users").limit(1).get();
  if (!usersSnap.empty) {
    return NextResponse.json({ error: "First admin already exists" }, { status: 403 });
  }

  const auth = getAuth(getAdminApp());
  let user;
  try {
    user = await auth.createUser({
      email,
      password,
      displayName: name,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create user";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const now = new Date().toISOString();
  await db
    .collection("tenants")
    .doc(tenantId)
    .collection("users")
    .doc(user.uid)
    .set({
      email,
      name,
      role: "admin",
      active: true,
      createdAt: now,
      updatedAt: now,
    });

  return NextResponse.json({ success: true, uid: user.uid });
}
