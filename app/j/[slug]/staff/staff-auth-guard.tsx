"use client";

import { useEffect, useState, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase/client";

export function StaffAuthGuard({ slug, children }: { slug: string; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);

  const isLoginPage = pathname?.endsWith("/staff/login");

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (isLoginPage) {
        setChecking(false);
        if (user) {
          router.push(`/j/${slug}/staff`);
        }
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
      const userDoc = await getDoc(
        doc(db, "tenants", tenantId, "users", user.uid)
      );
      if (!userDoc.exists() || !userDoc.data()?.active) {
        await auth.signOut();
        router.replace(`/j/${slug}/staff/login`);
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
  if (!allowed) return null;
  return <>{children}</>;
}
