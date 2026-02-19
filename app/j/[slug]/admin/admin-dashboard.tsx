"use client";

import { useState, useEffect } from "react";
import { getFirebaseAuth } from "@/lib/firebase/client";

interface Kpis {
  ticketsToday: number;
  ticketsThisWeek: number;
  avgRequestToReadyMinutes: number | null;
  avgReadyToDeliveredMinutes: number | null;
}

export function AdminDashboard({
  slug,
  tenantName,
}: {
  slug: string;
  tenantName: string;
}) {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }
    user
      .getIdToken()
      .then((token) =>
        fetch(`/api/j/${slug}/admin/kpis`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      )
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 403 ? "Forbidden" : "Failed to load");
        return r.json();
      })
      .then(setKpis)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <p className="text-gray-500">Loading…</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (!kpis) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Tickets today</p>
          <p className="text-2xl font-semibold">{kpis.ticketsToday}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Tickets this week</p>
          <p className="text-2xl font-semibold">{kpis.ticketsThisWeek}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Avg. request → ready (min)</p>
          <p className="text-2xl font-semibold">
            {kpis.avgRequestToReadyMinutes != null ? kpis.avgRequestToReadyMinutes : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Avg. ready → delivered (min)</p>
          <p className="text-2xl font-semibold">
            {kpis.avgReadyToDeliveredMinutes != null ? kpis.avgReadyToDeliveredMinutes : "—"}
          </p>
        </div>
      </div>
      <p className="text-sm text-gray-500">
        Use Tickets for history, Employees to manage staff, Settings for pricing and branding.
      </p>
    </div>
  );
}
