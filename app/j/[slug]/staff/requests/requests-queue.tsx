"use client";

import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { getFirebaseDb, getFirebaseAuth } from "@/lib/firebase/client";
import type { TicketStatus } from "@/lib/types";
import type { KeyStorageMode } from "@/lib/types";

interface CarMeta {
  color?: string;
  type?: string;
  make?: string;
}

interface QueueTicket {
  id: string;
  ticketNumber: string;
  plateNumber: string;
  status: TicketStatus;
  carMeta?: CarMeta;
  notes?: string | null;
  slotNumber?: number | null;
  tagNumber?: string | null;
  timestamps: { requestedAt?: string; inProgressAt?: string; readyAt?: string };
  updatedAt: string;
}

const STATUS_ORDER: TicketStatus[] = ["REQUESTED", "IN_PROGRESS", "READY"];
const LABELS: Record<string, string> = {
  REQUESTED: "Requested",
  IN_PROGRESS: "In progress",
  READY: "Ready",
};

const TYPE_LABELS: Record<string, string> = {
  sedan: "Sedan",
  suv: "SUV",
  van: "Van",
  pickup: "Pickup",
};

function formatTime(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function RequestsQueue({
  slug,
  tenantId,
  keyStorageMode = "off",
  keyStorageSlotsCount = 100,
}: {
  slug: string;
  tenantId: string;
  keyStorageMode?: KeyStorageMode;
  keyStorageSlotsCount?: number;
}) {
  const [tickets, setTickets] = useState<QueueTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [keyEditTicketId, setKeyEditTicketId] = useState<string | null>(null);
  const [keyEditMode, setKeyEditMode] = useState<"slot" | "tag" | null>(null);
  const [availableSlots, setAvailableSlots] = useState<number[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [slotSelect, setSlotSelect] = useState<number | "">("");

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
        const list: QueueTicket[] = [];
        snap.forEach((doc) => {
          const d = doc.data();
          list.push({
            id: doc.id,
            ticketNumber: d.ticketNumber ?? "",
            plateNumber: d.plateNumber ?? "",
            status: d.status,
            carMeta: d.carMeta ?? undefined,
            notes: d.notes ?? undefined,
            slotNumber: d.slotNumber ?? undefined,
            tagNumber: d.tagNumber ?? undefined,
            timestamps: d.timestamps ?? {},
            updatedAt: d.updatedAt ?? "",
          });
        });
        list.sort((a, b) => {
          const aIdx = STATUS_ORDER.indexOf(a.status);
          const bIdx = STATUS_ORDER.indexOf(b.status);
          if (aIdx !== bIdx) return aIdx - bIdx;
          return (b.updatedAt || "").localeCompare(a.updatedAt || "");
        });
        setTickets(list);
        setLoading(false);
      },
      (err) => {
        setError(err.message || "Failed to load queue");
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [tenantId]);

  const updateStatus = async (ticketId: string, newStatus: TicketStatus) => {
    setUpdatingId(ticketId);
    setError(null);
    try {
      const auth = getFirebaseAuth().currentUser;
      if (!auth) {
        setError("Not signed in");
        return;
      }
      const token = await auth.getIdToken();
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch(`${base}/api/j/${slug}/staff/update-status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ticketId, newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setUpdatingId(null);
    }
  };

  const openSlotEdit = async (ticketId: string, currentSlot?: number | null) => {
    setKeyEditTicketId(ticketId);
    setKeyEditMode("slot");
    setTagInput("");
    const auth = getFirebaseAuth().currentUser;
    if (!auth) return;
    const token = await auth.getIdToken();
    const res = await fetch(`/api/j/${slug}/staff/available-slots?forTicketId=${encodeURIComponent(ticketId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const slots: number[] = res.ok ? ((await res.json()).available ?? []) : [];
    setAvailableSlots(slots);
    setSlotSelect(currentSlot != null && slots.includes(currentSlot) ? currentSlot : slots[0] ?? "");
  };

  const openTagEdit = (ticketId: string, currentTag?: string | null) => {
    setKeyEditTicketId(ticketId);
    setKeyEditMode("tag");
    setTagInput(currentTag ?? "");
  };

  const submitSlotChange = async () => {
    if (keyEditTicketId == null || slotSelect === "") return;
    setError(null);
    try {
      const auth = getFirebaseAuth().currentUser;
      if (!auth) return;
      const token = await auth.getIdToken();
      const res = await fetch(`/api/j/${slug}/staff/tickets/${keyEditTicketId}/assign-slot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ slotNumber: slotSelect }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setKeyEditTicketId(null);
      setKeyEditMode(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to assign slot");
    }
  };

  const submitTagChange = async () => {
    if (keyEditTicketId == null) return;
    const tag = tagInput.trim();
    if (!tag) return;
    setError(null);
    try {
      const auth = getFirebaseAuth().currentUser;
      if (!auth) return;
      const token = await auth.getIdToken();
      const res = await fetch(`/api/j/${slug}/staff/tickets/${keyEditTicketId}/assign-tag`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tagNumber: tag }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setKeyEditTicketId(null);
      setKeyEditMode(null);
      setTagInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to assign tag");
    }
  };

  if (loading) return <p className="text-gray-500">Loading queue…</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  if (tickets.length === 0) {
    return (
      <p className="text-gray-500 rounded-lg border border-gray-200 p-6 text-center">
        No requested or in-progress tickets. New requests will appear here in real time.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {tickets.map((t) => (
        <li
          key={t.id}
          className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-md bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-800">
                  #{t.ticketNumber}
                </span>
                <span className="inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium text-white bg-blue-600">
                  {LABELS[t.status] ?? t.status}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <div>
                  <span className="text-gray-500">Plate</span>
                  <p className="font-semibold text-gray-900">{t.plateNumber || "—"}</p>
                </div>
                {(t.carMeta?.color || t.carMeta?.type || t.carMeta?.make) && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {t.carMeta?.color && (
                      <div>
                        <span className="text-gray-500">Color </span>
                        <span className="font-medium text-gray-900">{t.carMeta.color}</span>
                      </div>
                    )}
                    {t.carMeta?.type && (
                      <div>
                        <span className="text-gray-500">Type </span>
                        <span className="font-medium text-gray-900">
                          {TYPE_LABELS[String(t.carMeta.type).toLowerCase()] ?? t.carMeta.type}
                        </span>
                      </div>
                    )}
                    {t.carMeta?.make && (
                      <div>
                        <span className="text-gray-500">Make </span>
                        <span className="font-medium text-gray-900">{t.carMeta.make}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {t.notes && (
                <div className="text-sm">
                  <span className="text-gray-500">Notes </span>
                  <p className="text-gray-900 mt-0.5">{t.notes}</p>
                </div>
              )}
              {keyStorageMode === "slots" && (
                <div className="text-sm flex flex-wrap items-center gap-2">
                  <span className="text-gray-500">Slot</span>
                  {keyEditTicketId === t.id && keyEditMode === "slot" ? (
                    <span className="flex items-center gap-2">
                      <select
                        value={slotSelect}
                        onChange={(e) => setSlotSelect(e.target.value === "" ? "" : Number(e.target.value))}
                        className="rounded border border-gray-300 px-2 py-1 text-sm"
                      >
                        {availableSlots.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <button type="button" onClick={submitSlotChange} className="rounded bg-gray-700 px-2 py-1 text-xs text-white">Apply</button>
                      <button type="button" onClick={() => { setKeyEditTicketId(null); setKeyEditMode(null); }} className="text-gray-500 text-xs">Cancel</button>
                    </span>
                  ) : (
                    <>
                      <span className="font-medium text-gray-900">{t.slotNumber != null ? t.slotNumber : "—"}</span>
                      <button type="button" onClick={() => openSlotEdit(t.id, t.slotNumber)} className="text-blue-600 text-xs underline">
                        {t.slotNumber != null ? "Change slot" : "Assign slot"}
                      </button>
                    </>
                  )}
                </div>
              )}
              {keyStorageMode === "tags" && (
                <div className="text-sm flex flex-wrap items-center gap-2">
                  <span className="text-gray-500">Tag</span>
                  {keyEditTicketId === t.id && keyEditMode === "tag" ? (
                    <span className="flex items-center gap-2">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        placeholder="Tag number"
                        className="rounded border border-gray-300 px-2 py-1 text-sm w-24"
                      />
                      <button type="button" onClick={submitTagChange} className="rounded bg-gray-700 px-2 py-1 text-xs text-white">Apply</button>
                      <button type="button" onClick={() => { setKeyEditTicketId(null); setKeyEditMode(null); }} className="text-gray-500 text-xs">Cancel</button>
                    </span>
                  ) : (
                    <>
                      <span className="font-medium text-gray-900">{t.tagNumber ?? "—"}</span>
                      <button type="button" onClick={() => openTagEdit(t.id, t.tagNumber)} className="text-blue-600 text-xs underline">
                        {t.tagNumber ? "Change tag" : "Assign tag"}
                      </button>
                    </>
                  )}
                </div>
              )}
              <p className="text-xs text-gray-500">
                Requested at {formatTime(t.timestamps.requestedAt)}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {t.status === "REQUESTED" && (
                <button
                  type="button"
                  onClick={() => updateStatus(t.id, "IN_PROGRESS")}
                  disabled={updatingId === t.id}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {updatingId === t.id ? "…" : "Accept"}
                </button>
              )}
              {t.status === "IN_PROGRESS" && (
                <button
                  type="button"
                  onClick={() => updateStatus(t.id, "READY")}
                  disabled={updatingId === t.id}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {updatingId === t.id ? "…" : "Mark ready"}
                </button>
              )}
              {t.status === "READY" && (
                <button
                  type="button"
                  onClick={() => updateStatus(t.id, "DELIVERED")}
                  disabled={updatingId === t.id}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {updatingId === t.id ? "…" : "Mark delivered"}
                </button>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
