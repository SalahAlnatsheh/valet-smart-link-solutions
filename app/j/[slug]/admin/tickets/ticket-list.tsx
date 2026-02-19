"use client";

import { useState, useEffect } from "react";
import { getFirebaseAuth } from "@/lib/firebase/client";

interface TicketRow {
  id: string;
  ticketNumber?: string;
  plateNumber?: string;
  status?: string;
  timestamps?: { requestedAt?: string; readyAt?: string; deliveredAt?: string };
  updatedAt?: string;
}

const STATUS_LABELS: Record<string, string> = {
  PARKED: "Parked",
  REQUESTED: "Requested",
  IN_PROGRESS: "In progress",
  READY: "Ready",
  DELIVERED: "Delivered",
};

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export function TicketList({ slug }: { slug: string }) {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const fetchTickets = () => {
    const auth = getFirebaseAuth().currentUser;
    if (!auth) return;
    setLoading(true);
    auth
      .getIdToken()
      .then((token) => {
        const url = statusFilter
          ? `/api/j/${slug}/admin/tickets?status=${encodeURIComponent(statusFilter)}`
          : `/api/j/${slug}/admin/tickets`;
        return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((data) => setTickets(data.tickets || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTickets();
  }, [slug, statusFilter]);

  if (loading && tickets.length === 0) return <p className="text-gray-500">Loading…</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600">Status:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="">All</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-4 py-2 font-medium">Ticket</th>
              <th className="px-4 py-2 font-medium">Plate</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {tickets.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">No tickets</td></tr>
            ) : (
              tickets.map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="px-4 py-2">{t.ticketNumber ?? t.id}</td>
                  <td className="px-4 py-2">{t.plateNumber ?? "—"}</td>
                  <td className="px-4 py-2">{STATUS_LABELS[t.status ?? ""] ?? t.status}</td>
                  <td className="px-4 py-2">{formatDate(t.updatedAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
