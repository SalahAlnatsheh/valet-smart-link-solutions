"use client";

import { useEffect, useState, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase/client";

const ADMIN_ROLES = ["admin", "manager"];

export function AdminAuthGuard({ slug, children }: { slug: string; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);

  const isLoginPage = pathname?.endsWith("/admin/login");

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (isLoginPage) {
        setChecking(false);
        if (user) router.push(`/j/${slug}/admin`);
        return;
      }
      if (!user) {
        router.replace(`/j/${slug}/staff/login`);
        setChecking(false);
        return;
      }
      const db = getFirebaseDb();
      const slugDoc = await getDoc(doc(db, "slugs", slug));
      const tenantId = slugDoc.data()?.tenantId;
      if (!tenantId) {
        setChecking(false);
        return;
      }
      const userDoc = await getDoc(doc(db, "tenants", tenantId, "users", user.uid));
      const data = userDoc.data();
      if (!userDoc.exists() || !data?.active) {
        setChecking(false);
        return;
      }
      if (!ADMIN_ROLES.includes(data.role as string)) {
        setAllowed(false);
        setChecking(false);
        return;
      }
      setAllowed(true);
      setChecking(false);
    });
    return () => unsubscribe();
  }, [slug, isLoginPage, router]);

  if (isLoginPage) return <>{children}</>;
  if (checking) return <div className="min-h-screen p-6 flex items-center justify-center">Checking auth…</div>;
  if (!allowed) return (
    <div className="min-h-screen p-6 flex items-center justify-center">
      <p className="text-red-600">Access denied. Admin or manager role required.</p>
    </div>
  );
  return <>{children}</>;
}
