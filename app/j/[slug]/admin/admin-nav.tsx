"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";

export function AdminNav({ slug, tenantName }: { slug: string; tenantName: string }) {
  const router = useRouter();
  const handleSignOut = async () => {
    await signOut(getFirebaseAuth());
    router.push(`/j/${slug}/staff/login`);
    router.refresh();
  };
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-4 mb-4">
      <h1 className="text-2xl font-semibold">Admin — {tenantName}</h1>
      <nav className="flex items-center gap-4">
        <Link href={`/j/${slug}/admin`} className="text-blue-600 underline">Dashboard</Link>
        <Link href={`/j/${slug}/admin/tickets`} className="text-blue-600 underline">Tickets</Link>
        <Link href={`/j/${slug}/admin/employees`} className="text-blue-600 underline">Employees</Link>
        <Link href={`/j/${slug}/admin/settings`} className="text-blue-600 underline">Settings</Link>
        <Link href={`/j/${slug}/admin/payments`} className="text-gray-400">Payments</Link>
        <Link href={`/j/${slug}/admin/hr`} className="text-blue-600 underline">HR</Link>
        <button type="button" onClick={handleSignOut} className="text-gray-600 underline">Sign out</button>
      </nav>
    </div>
  );
}
