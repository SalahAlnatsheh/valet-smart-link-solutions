"use client";

import { useState, useEffect } from "react";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";

interface TicketRow {
  id: string;
  ticketNumber?: string;
  plateNumber?: string;
  status?: string;
  slotNumber?: number | null;
  tagNumber?: string | null;
  createdAt?: string;
  updatedAt?: string;
  timestamps?: {
    arrivedAt?: string;
    requestedAt?: string;
    inProgressAt?: string;
    readyAt?: string;
    deliveredAt?: string;
  };
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

function formatTime(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function TicketHistoryList({ tenantId }: { tenantId: string }) {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");

  useEffect(() => {
    const db = getFirebaseDb();
    const ticketsRef = collection(db, "tenants", tenantId, "tickets");
    const q = query(
      ticketsRef,
      orderBy("updatedAt", "desc"),
      limit(80)
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list: TicketRow[] = [];
        snap.forEach((doc) => {
          const d = doc.data();
          list.push({
            id: doc.id,
            ticketNumber: d.ticketNumber,
            plateNumber: d.plateNumber,
            status: d.status,
            slotNumber: d.slotNumber ?? undefined,
            tagNumber: d.tagNumber ?? undefined,
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
            timestamps: d.timestamps ?? {},
          });
        });
        setTickets(list);
        setLoading(false);
      },
      (err) => {
        setError(err.message || "Failed to load tickets");
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [tenantId]);

  const filtered = statusFilter
    ? tickets.filter((t) => t.status === statusFilter)
    : tickets;

  if (loading && tickets.length === 0) return <p className="text-gray-500">Loading…</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Recent tickets (latest first). Use this to see what’s been created, requested, and delivered.
      </p>
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
              <th className="px-4 py-2 font-medium">Key (slot/tag)</th>
              <th className="px-4 py-2 font-medium">Created</th>
              <th className="px-4 py-2 font-medium">Requested</th>
              <th className="px-4 py-2 font-medium">Ready</th>
              <th className="px-4 py-2 font-medium">Delivered</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                  No tickets yet. Create one from New ticket.
                </td>
              </tr>
            ) : (
              filtered.map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="px-4 py-2 font-medium">{t.ticketNumber ?? t.id.slice(0, 8)}</td>
                  <td className="px-4 py-2">{t.plateNumber ?? "—"}</td>
                  <td className="px-4 py-2">{STATUS_LABELS[t.status ?? ""] ?? t.status}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {t.slotNumber != null ? `Slot ${t.slotNumber}` : t.tagNumber ? `Tag ${t.tagNumber}` : "—"}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{formatDate(t.createdAt)}</td>
                  <td className="px-4 py-2 text-gray-600">{formatTime(t.timestamps?.requestedAt)}</td>
                  <td className="px-4 py-2 text-gray-600">{formatTime(t.timestamps?.readyAt)}</td>
                  <td className="px-4 py-2 text-gray-600">{formatTime(t.timestamps?.deliveredAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
