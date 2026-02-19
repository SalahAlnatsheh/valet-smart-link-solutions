"use client";

import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { getFirebaseDb, getFirebaseFunctions, httpsCallable } from "@/lib/firebase/client";

interface CustomerTicketViewProps {
  slug: string;
  publicId: string;
  token: string;
  tenantId: string;
  tenantName: string;
}

type Status = "PARKED" | "REQUESTED" | "IN_PROGRESS" | "READY" | "DELIVERED";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Url = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Url);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function CustomerTicketView({
  slug,
  publicId,
  token,
  tenantId,
  tenantName,
}: CustomerTicketViewProps) {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [notifyStatus, setNotifyStatus] = useState<"idle" | "asked" | "subscribed" | "denied" | "unsupported">("idle");

  useEffect(() => {
    if (!token || !slug || !publicId) return;
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey || typeof navigator === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setNotifyStatus("unsupported");
      return;
    }
    (async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setNotifyStatus("denied");
          return;
        }
        setNotifyStatus("asked");
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        await reg.update();
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,

        });
        const base = typeof window !== "undefined" ? window.location.origin : "";
        const res = await fetch(`${base}/api/j/${slug}/push-subscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicId,
            token,
            subscription: sub.toJSON(),
          }),
        });
        if (res.ok) setNotifyStatus("subscribed");
      } catch {
        setNotifyStatus("unsupported");
      }
    })();
  }, [token, slug, publicId]);

  useEffect(() => {
    if (!token) {
      setError("Invalid link. Please use the NFC card provided.");
      setLoading(false);
      return;
    }
    const db = getFirebaseDb();
    const publicRef = doc(db, "tenants", tenantId, "publicTickets", publicId);
    const unsubscribe = onSnapshot(
      publicRef,
      (snap) => {
        if (!snap.exists()) {
          setError("Ticket not found.");
          setLoading(false);
          return;
        }
        const data = snap.data();
        setStatus((data?.status as Status) ?? null);
        setLoading(false);
      },
      (err) => {
        setError(err.message || "Failed to load ticket.");
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [tenantId, publicId, token]);

  const handleRequestCar = async () => {
    setRequesting(true);
    setError(null);
    try {
      const functions = getFirebaseFunctions();
      const requestCarFn = httpsCallable<{ slug: string; publicId: string; token: string }>(
        functions,
        "requestCar"
      );
      await requestCarFn({ slug, publicId, token });
      setStatus("REQUESTED");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setRequesting(false);
    }
  };

  if (loading) return <div className="min-h-screen p-6 bg-[var(--bg,#0f172a)] text-[var(--text,#f8fafc)]">Loading...</div>;
  if (error) return <div className="min-h-screen p-6 bg-[var(--bg,#0f172a)] text-red-400">{error}</div>;

  const statusLabel =
    status === "PARKED"
      ? "Parked"
      : status === "REQUESTED"
        ? "Requested"
        : status === "IN_PROGRESS"
          ? "In progress"
          : status === "READY"
            ? "Ready at entrance"
            : status === "DELIVERED"
              ? "Delivered"
              : "—";

  return (
    <div className="min-h-screen p-6 bg-[var(--bg,#0f172a)] text-[var(--text,#f8fafc)]">
      <h1 className="text-xl font-semibold mb-2">{tenantName}</h1>
      <p className="text-sm text-gray-400 mb-6">Valet ticket</p>
      {notifyStatus === "subscribed" && (
        <p className="text-xs text-gray-500 mb-2">You’ll get a notification when your car is ready.</p>
      )}
      <div className="rounded-lg border border-gray-600 p-4 mb-6">
        <p className="text-sm text-gray-400">Status</p>
        <p className="text-lg font-medium">{statusLabel}</p>
      </div>
      {status === "PARKED" && (
        <button
          type="button"
          onClick={handleRequestCar}
          disabled={requesting}
          className="w-full py-3 rounded-lg font-medium text-white disabled:opacity-50 bg-[var(--primary,#0ea5e9)] border-2 border-[var(--primary,#0ea5e9)]"
        >
          {requesting ? "Requesting…" : "Request my car"}
        </button>
      )}
    </div>
  );
}
