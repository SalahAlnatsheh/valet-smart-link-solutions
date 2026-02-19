"use client";

import { useState, useEffect } from "react";
import { getFirebaseAuth } from "@/lib/firebase/client";

export function AttendanceActions({ slug }: { slug: string }) {
  const [hasOpenShift, setHasOpenShift] = useState<boolean | null>(null);
  const [checkInAt, setCheckInAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCurrentShift = async () => {
    const auth = getFirebaseAuth().currentUser;
    if (!auth) return;
    setLoading(true);
    setError(null);
    try {
      const token = await auth.getIdToken();
      const res = await fetch(`/api/j/${slug}/staff/current-shift`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const text = await res.text();
      let data: { openShiftId?: string | null; checkInAt?: string; error?: string } = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(res.ok ? "Invalid response" : "Failed to load");
        }
      }
      if (!res.ok) throw new Error(data.error || "Failed");
      setHasOpenShift(!!data.openShiftId);
      setCheckInAt(data.checkInAt ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentShift();
  }, [slug]);

  const getLocation = (): Promise<{ lat: number; lng: number; accuracy?: number }> =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Location not supported"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          }),
        (err) => reject(new Error(err.message || "Location denied")),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });

  const handleCheckIn = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const loc = await getLocation();
      const auth = getFirebaseAuth().currentUser;
      if (!auth) return;
      const token = await auth.getIdToken();
      const res = await fetch(`/api/j/${slug}/staff/check-in`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(loc),
      });
      const text = await res.text();
      const data = text ? (() => { try { return JSON.parse(text); } catch { return {}; } })() : {};
      if (!res.ok) throw new Error((data as { error?: string }).error || "Check-in failed");
      setHasOpenShift(true);
      setCheckInAt(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check-in failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const loc = await getLocation();
      const auth = getFirebaseAuth().currentUser;
      if (!auth) return;
      const token = await auth.getIdToken();
      const res = await fetch(`/api/j/${slug}/staff/check-out`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(loc),
      });
      const text = await res.text();
      const data = text ? (() => { try { return JSON.parse(text); } catch { return {}; } })() : {};
      if (!res.ok) throw new Error((data as { error?: string }).error || "Check-out failed");
      setHasOpenShift(false);
      setCheckInAt(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check-out failed");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <p className="text-gray-500">Loading…</p>;

  return (
    <div className="space-y-4 max-w-md">
      {error && <p className="text-red-500 text-sm">{error}</p>}
      {hasOpenShift && checkInAt && (
        <p className="text-sm text-gray-600">
          Checked in at {new Date(checkInAt).toLocaleTimeString()}
        </p>
      )}
      <div className="flex gap-3">
        {!hasOpenShift ? (
          <button
            type="button"
            onClick={handleCheckIn}
            disabled={actionLoading}
            className="rounded bg-green-600 px-4 py-2 text-white font-medium disabled:opacity-50"
          >
            {actionLoading ? "…" : "Check in"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCheckOut}
            disabled={actionLoading}
            className="rounded bg-amber-600 px-4 py-2 text-white font-medium disabled:opacity-50"
          >
            {actionLoading ? "…" : "Check out"}
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500">
        Location is used to verify you are at the venue. If a geofence is set in Admin → Settings, check-in/out is only allowed within that area.
      </p>
    </div>
  );
}
