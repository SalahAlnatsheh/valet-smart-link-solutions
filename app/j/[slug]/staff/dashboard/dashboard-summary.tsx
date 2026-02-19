"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import type { TicketStatus } from "@/lib/types";

const STATUS_LABELS: Record<string, string> = {
  REQUESTED: "Requested",
  IN_PROGRESS: "In progress",
  READY: "Ready",
};

export function DashboardSummary({ slug, tenantId }: { slug: string; tenantId: string }) {
  const [counts, setCounts] = useState<Record<TicketStatus, number>>({
    REQUESTED: 0,
    IN_PROGRESS: 0,
    READY: 0,
    PARKED: 0,
    DELIVERED: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const db = getFirebaseDb();
    const ticketsRef = collection(db, "tenants", tenantId, "tickets");
    const q = query(
      ticketsRef,
      where("status", "in", ["REQUESTED", "IN_PROGRESS", "READY"])
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const next = { REQUESTED: 0, IN_PROGRESS: 0, READY: 0, PARKED: 0, DELIVERED: 0 };
        snap.forEach((doc) => {
          const s = doc.data().status as TicketStatus;
          if (s in next) next[s]++;
        });
        setCounts(next);
        setLoading(false);
      },
      (err) => {
        setError(err.message || "Failed to load");
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [tenantId]);

  const total = counts.REQUESTED + counts.IN_PROGRESS + counts.READY;

  return (
    <div className="max-w-2xl space-y-6">
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Request queue</h3>
        {loading ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-4 text-sm">
              <span>
                <strong>{counts.REQUESTED}</strong> {STATUS_LABELS.REQUESTED}
              </span>
              <span>
                <strong>{counts.IN_PROGRESS}</strong> {STATUS_LABELS.IN_PROGRESS}
              </span>
              <span>
                <strong>{counts.READY}</strong> {STATUS_LABELS.READY}
              </span>
            </div>
            <p className="mt-2 text-gray-600 text-sm">
              {total === 0
                ? "No cars in the request queue right now."
                : `${total} car${total !== 1 ? "s" : ""} waiting for action.`}
            </p>
            <Link
              href={`/j/${slug}/staff/requests`}
              className="mt-3 inline-block rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              View queue
            </Link>
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/j/${slug}/staff/requests`}
          className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Requests queue
        </Link>
        <Link
          href={`/j/${slug}/staff/new`}
          className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          New ticket
        </Link>
        <Link
          href={`/j/${slug}/staff/tickets`}
          className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Ticket history
        </Link>
        <Link
          href={`/j/${slug}/staff/attendance`}
          className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Attendance
        </Link>
      </div>
      <p className="text-sm text-gray-500">
        Quick links to manage valet flow. Open the request queue first to handle car requests, or create a new ticket when a car arrives.
      </p>
    </div>
  );
}
