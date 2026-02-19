import { getAuth } from "firebase-admin/auth";
import { getAdminApp } from "@/lib/firebase/admin";
import { getAdminFirestore } from "@/lib/firebase/admin";

export async function verifyIdToken(
  authHeader: string | null
): Promise<{ uid: string } | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  try {
    const auth = getAuth(getAdminApp());
    const decoded = await auth.verifyIdToken(token);
    return { uid: decoded.uid };
  } catch {
    return null;
  }
}

export async function requireAdminForTenant(
  tenantId: string,
  uid: string
): Promise<boolean> {
  const db = getAdminFirestore();
  const userDoc = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("users")
    .doc(uid)
    .get();
  if (!userDoc.exists) return false;
  const role = userDoc.data()?.role;
  return role === "admin" || role === "manager";
}

export async function requireStaffForTenant(
  tenantId: string,
  uid: string
): Promise<boolean> {
  const db = getAdminFirestore();
  const userDoc = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("users")
    .doc(uid)
    .get();
  if (!userDoc.exists) return false;
  return userDoc.data()?.active === true;
}
