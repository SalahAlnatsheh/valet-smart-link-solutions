"use client";

import { useState, useEffect } from "react";
import { getFirebaseAuth } from "@/lib/firebase/client";

interface TenantSettings {
  id: string;
  name?: string;
  country?: string;
  currency?: string;
  pricing?: { baseValetPrice?: number; currency?: string };
  cashEnabled?: boolean;
  branding?: { primaryColor?: string; backgroundColor?: string; textColor?: string; logoUrl?: string };
  geofence?: { lat: number; lng: number; radiusMeters: number } | null;
  keyStorageMode?: "off" | "slots" | "tags";
  keyStorageSlotsCount?: number;
  newTicketRequired?: {
    plateNumber?: boolean;
    carColor?: boolean;
    carType?: boolean;
    carMake?: boolean;
    notes?: boolean;
    plateImage?: boolean;
    carImage?: boolean;
    tagNumber?: boolean;
  };
}

type FormState = {
  name: string;
  country: string;
  currency: string;
  baseValetPrice: number;
  cashEnabled: boolean;
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  geofenceLat: string;
  geofenceLng: string;
  geofenceRadius: string;
  keyStorageMode: string;
  keyStorageSlotsCount: string;
  reqPlateNumber: boolean;
  reqCarColor: boolean;
  reqCarType: boolean;
  reqCarMake: boolean;
  reqNotes: boolean;
  reqPlateImage: boolean;
  reqCarImage: boolean;
  reqTagNumber: boolean;
};

function settingsToForm(data: TenantSettings | null | undefined): FormState {
  if (!data) {
    return {
      name: "",
      country: "",
      currency: "",
      baseValetPrice: 25,
      cashEnabled: true,
      primaryColor: "#0ea5e9",
      backgroundColor: "#0b1220",
      textColor: "#ffffff",
      geofenceLat: "",
      geofenceLng: "",
      geofenceRadius: "",
      keyStorageMode: "off",
      keyStorageSlotsCount: "100",
      reqPlateNumber: true,
      reqCarColor: false,
      reqCarType: false,
      reqCarMake: false,
      reqNotes: false,
      reqPlateImage: false,
      reqCarImage: false,
      reqTagNumber: false,
    };
  }
  const g = data.geofence;
  const r = data.newTicketRequired ?? {};
  return {
    name: data.name ?? "",
    country: data.country ?? "",
    currency: data.currency ?? "",
    baseValetPrice: data.pricing?.baseValetPrice ?? 25,
    cashEnabled: data.cashEnabled ?? true,
    primaryColor: data.branding?.primaryColor ?? "#0ea5e9",
    backgroundColor: data.branding?.backgroundColor ?? "#0b1220",
    textColor: data.branding?.textColor ?? "#ffffff",
    geofenceLat: g?.lat != null ? String(g.lat) : "",
    geofenceLng: g?.lng != null ? String(g.lng) : "",
    geofenceRadius: g?.radiusMeters != null ? String(g.radiusMeters) : "",
    keyStorageMode: data.keyStorageMode ?? "off",
    keyStorageSlotsCount: data.keyStorageSlotsCount != null ? String(data.keyStorageSlotsCount) : "100",
    reqPlateNumber: r.plateNumber ?? true,
    reqCarColor: r.carColor ?? false,
    reqCarType: r.carType ?? false,
    reqCarMake: r.carMake ?? false,
    reqNotes: r.notes ?? false,
    reqPlateImage: r.plateImage ?? false,
    reqCarImage: r.carImage ?? false,
    reqTagNumber: r.tagNumber ?? false,
  };
}

export function SettingsForm({ slug }: { slug: string }) {
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(settingsToForm(null));

  useEffect(() => {
    const auth = getFirebaseAuth().currentUser;
    if (!auth) return;
    auth
      .getIdToken()
      .then((token) =>
        fetch(`/api/j/${slug}/admin/settings`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      )
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((data) => {
        setSettings(data);
        setForm(settingsToForm(data));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const auth = getFirebaseAuth().currentUser;
    if (!auth) return;
    try {
      const token = await auth.getIdToken();
      const res = await fetch(`/api/j/${slug}/admin/settings`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: form.name,
          country: form.country,
          currency: form.currency,
          pricing: { baseValetPrice: form.baseValetPrice, currency: form.currency },
          cashEnabled: form.cashEnabled,
          branding: {
            primaryColor: form.primaryColor,
            backgroundColor: form.backgroundColor,
            textColor: form.textColor,
          },
          geofence:
            form.geofenceLat !== "" && form.geofenceLng !== "" && form.geofenceRadius !== ""
              ? {
                  lat: Number(form.geofenceLat),
                  lng: Number(form.geofenceLng),
                  radiusMeters: Number(form.geofenceRadius),
                }
              : null,
          keyStorageMode: form.keyStorageMode === "off" ? "off" : form.keyStorageMode === "tags" ? "tags" : "slots",
          keyStorageSlotsCount:
            form.keyStorageMode === "slots"
              ? Math.max(1, Math.min(999, Number(form.keyStorageSlotsCount) || 100))
              : undefined,
          newTicketRequired: {
            plateNumber: form.reqPlateNumber,
            carColor: form.reqCarColor,
            carType: form.reqCarType,
            carMake: form.reqCarMake,
            notes: form.reqNotes,
            plateImage: form.reqPlateImage,
            carImage: form.reqCarImage,
            tagNumber: form.reqTagNumber,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save");
      const next = data.settings ?? data;
      setSettings(next);
      const nextForm = settingsToForm(next);
      setForm((prev) => ({
        ...nextForm,
        geofenceLat: nextForm.geofenceLat !== "" ? nextForm.geofenceLat : prev.geofenceLat,
        geofenceLng: nextForm.geofenceLng !== "" ? nextForm.geofenceLng : prev.geofenceLng,
        geofenceRadius: nextForm.geofenceRadius !== "" ? nextForm.geofenceRadius : prev.geofenceRadius,
        keyStorageMode: nextForm.keyStorageMode || prev.keyStorageMode,
        keyStorageSlotsCount: nextForm.keyStorageSlotsCount !== "" ? nextForm.keyStorageSlotsCount : prev.keyStorageSlotsCount,
        reqPlateNumber: nextForm.reqPlateNumber,
        reqCarColor: nextForm.reqCarColor,
        reqCarType: nextForm.reqCarType,
        reqCarMake: nextForm.reqCarMake,
        reqNotes: nextForm.reqNotes,
        reqPlateImage: nextForm.reqPlateImage,
        reqCarImage: nextForm.reqCarImage,
        reqTagNumber: nextForm.reqTagNumber,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-gray-500">Loading…</p>;
  if (error && !settings) return <p className="text-red-500">{error}</p>;

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Tenant name</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Country</label>
          <input
            type="text"
            value={form.country}
            onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            placeholder="AE"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Currency</label>
          <input
            type="text"
            value={form.currency}
            onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            placeholder="AED"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Valet price (base)</label>
        <input
          type="number"
          value={form.baseValetPrice}
          onChange={(e) => setForm((f) => ({ ...f, baseValetPrice: Number(e.target.value) }))}
          className="mt-1 w-full max-w-xs rounded border border-gray-300 px-3 py-2"
        />
        <p className="mt-1 text-xs text-gray-500">Price shown to customers. Online payments include a platform fee (not set by you).</p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="cashEnabled"
          checked={form.cashEnabled}
          onChange={(e) => setForm((f) => ({ ...f, cashEnabled: e.target.checked }))}
          className="rounded"
        />
        <label htmlFor="cashEnabled" className="text-sm">Cash payment enabled</label>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Attendance geofence (optional)</h3>
        <p className="text-xs text-gray-500 mb-2">Staff can only check in/out when within this radius of the venue. Leave empty to allow anywhere.</p>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs text-gray-500">Latitude</label>
            <input
              type="number"
              step="any"
              value={form.geofenceLat}
              onChange={(e) => setForm((f) => ({ ...f, geofenceLat: e.target.value }))}
              className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"
              placeholder="25.123"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Longitude</label>
            <input
              type="number"
              step="any"
              value={form.geofenceLng}
              onChange={(e) => setForm((f) => ({ ...f, geofenceLng: e.target.value }))}
              className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"
              placeholder="55.456"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Radius (m)</label>
            <input
              type="number"
              min="50"
              value={form.geofenceRadius}
              onChange={(e) => setForm((f) => ({ ...f, geofenceRadius: e.target.value }))}
              className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"
              placeholder="150"
            />
          </div>
        </div>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Key storage (valet keys)</h3>
        <p className="text-xs text-gray-500 mb-2">How staff track where keys are stored. Off = no key tracking.</p>
        <div className="space-y-2">
          <label className="block text-xs text-gray-500">Mode</label>
          <select
            value={form.keyStorageMode}
            onChange={(e) => setForm((f) => ({ ...f, keyStorageMode: e.target.value }))}
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="off">Off</option>
            <option value="slots">Slots (numbered cabinet/drawer)</option>
            <option value="tags">Tags (key tags with numbers)</option>
          </select>
          {form.keyStorageMode === "slots" && (
            <div className="mt-2">
              <label className="block text-xs text-gray-500">Total slots (e.g. 1–100)</label>
              <input
                type="number"
                min="1"
                max="999"
                value={form.keyStorageSlotsCount}
                onChange={(e) => setForm((f) => ({ ...f, keyStorageSlotsCount: e.target.value }))}
                className="mt-0.5 w-24 rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </div>
          )}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">New ticket form</h3>
        <p className="text-xs text-gray-500 mb-2">Choose which fields are required when staff create a ticket. Tag number only applies when key storage is Tags.</p>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.reqPlateNumber} onChange={(e) => setForm((f) => ({ ...f, reqPlateNumber: e.target.checked }))} className="rounded" />
            <span className="text-sm">Plate number</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.reqCarColor} onChange={(e) => setForm((f) => ({ ...f, reqCarColor: e.target.checked }))} className="rounded" />
            <span className="text-sm">Car color</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.reqCarType} onChange={(e) => setForm((f) => ({ ...f, reqCarType: e.target.checked }))} className="rounded" />
            <span className="text-sm">Car type</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.reqCarMake} onChange={(e) => setForm((f) => ({ ...f, reqCarMake: e.target.checked }))} className="rounded" />
            <span className="text-sm">Car brand (make)</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.reqNotes} onChange={(e) => setForm((f) => ({ ...f, reqNotes: e.target.checked }))} className="rounded" />
            <span className="text-sm">Notes</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.reqPlateImage} onChange={(e) => setForm((f) => ({ ...f, reqPlateImage: e.target.checked }))} className="rounded" />
            <span className="text-sm">Plate image</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.reqCarImage} onChange={(e) => setForm((f) => ({ ...f, reqCarImage: e.target.checked }))} className="rounded" />
            <span className="text-sm">Car image</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.reqTagNumber} onChange={(e) => setForm((f) => ({ ...f, reqTagNumber: e.target.checked }))} className="rounded" />
            <span className="text-sm">Tag number</span>
          </label>
        </div>
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Branding (theme)</h3>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs text-gray-500">Primary</label>
            <input
              type="text"
              value={form.primaryColor}
              onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
              className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Background</label>
            <input
              type="text"
              value={form.backgroundColor}
              onChange={(e) => setForm((f) => ({ ...f, backgroundColor: e.target.value }))}
              className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Text</label>
            <input
              type="text"
              value={form.textColor}
              onChange={(e) => setForm((f) => ({ ...f, textColor: e.target.value }))}
              className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </div>
        </div>
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
