"use client";

import { useState, useEffect } from "react";
import { getFirebaseAuth } from "@/lib/firebase/client";

interface ShiftRow {
  id: string;
  userId: string;
  displayName?: string;
  email?: string;
  checkInAt?: string;
  checkOutAt?: string;
  checkInLocation?: { lat: number; lng: number };
  checkOutLocation?: { lat: number; lng: number };
}

export function ShiftsList({ slug }: { slug: string }) {
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth().currentUser;
    if (!auth) return;
    auth
      .getIdToken()
      .then((token) =>
        fetch(`/api/j/${slug}/admin/shifts`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      )
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((data) => setShifts(data.shifts || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <p className="text-gray-500">Loading…</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  const formatDt = (iso?: string) => (iso ? new Date(iso).toLocaleString() : "—");

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b bg-gray-50">
          <tr>
            <th className="px-4 py-2 font-medium">Staff</th>
            <th className="px-4 py-2 font-medium">Check-in</th>
            <th className="px-4 py-2 font-medium">Check-out</th>
          </tr>
        </thead>
        <tbody>
          {shifts.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-4 py-6 text-center text-gray-500">
                No shifts yet. Staff check in from the Attendance page.
              </td>
            </tr>
          ) : (
            shifts.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="px-4 py-2" title={s.userId}>
                  {s.displayName || s.email || s.userId}
                </td>
                <td className="px-4 py-2">{formatDt(s.checkInAt)}</td>
                <td className="px-4 py-2">{formatDt(s.checkOutAt)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
