"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, addDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFirebaseDb, getFirebaseStorage, getFirebaseAuth } from "@/lib/firebase/client";
import type { CarMeta, KeyStorageMode, NewTicketRequiredFields, TicketStatus } from "@/lib/types";

const CAR_TYPES = ["sedan", "SUV", "van", "pickup", "other"] as const;

const CAR_MAKES = [
  "Acura", "Alfa Romeo", "Audi", "BMW", "Buick", "Cadillac", "Chevrolet", "Chrysler", "Citroën", "Dodge", "Fiat",
  "Ford", "GMC", "Honda", "Hyundai", "Infiniti", "Jaguar", "Jeep", "Kia", "Land Rover", "Lexus", "Maserati",
  "Mazda", "Mercedes-Benz", "Mini", "Mitsubishi", "Nissan", "Peugeot", "Porsche", "Ram", "Renault", "Subaru",
  "Suzuki", "Tesla", "Toyota", "Volkswagen", "Volvo",
].sort();

function randomId(len: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function randomToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const DEFAULT_REQUIRED: NewTicketRequiredFields = {
  plateNumber: true,
  carColor: false,
  carType: false,
  carMake: false,
  notes: false,
  plateImage: false,
  carImage: false,
  tagNumber: false,
};

export function NewTicketForm({
  slug,
  tenantId,
  keyStorageMode = "off",
  keyStorageSlotsCount = 100,
  newTicketRequired,
}: {
  slug: string;
  tenantId: string;
  keyStorageMode?: KeyStorageMode;
  keyStorageSlotsCount?: number;
  newTicketRequired?: NewTicketRequiredFields | null;
}) {
  const req = { ...DEFAULT_REQUIRED, ...newTicketRequired };
  const tagRequired = keyStorageMode === "tags" && req.tagNumber;
  const router = useRouter();
  const [plateNumber, setPlateNumber] = useState("");
  const [carColor, setCarColor] = useState("");
  const [carType, setCarType] = useState<string>("sedan");
  const [carMake, setCarMake] = useState("");
  const [showMakeSuggestions, setShowMakeSuggestions] = useState(false);
  const [notes, setNotes] = useState("");
  const [plateFile, setPlateFile] = useState<File | null>(null);
  const [carFile, setCarFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [slotMessage, setSlotMessage] = useState<{ slotNumber?: number; noSlots?: boolean } | null>(null);
  const [tagNumber, setTagNumber] = useState("");
  const [tagMessage, setTagMessage] = useState<{ tagNumber?: string; error?: string } | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<"plate" | "car" | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!cameraOpen || !cameraTarget) return;
    setCameraError(null);
    const video = videoRef.current;
    if (!video) return;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        streamRef.current = stream;
        video.srcObject = stream;
        video.play();
      })
      .catch((err) => {
        setCameraError(err.message || "Camera access denied");
      });
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (video) video.srcObject = null;
    };
  }, [cameraOpen, cameraTarget]);

  const openCamera = (target: "plate" | "car") => {
    setCameraTarget(target);
    setCameraOpen(true);
  };

  const closeCamera = () => {
    setCameraOpen(false);
    setCameraTarget(null);
    setCameraError(null);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !cameraTarget) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const name = cameraTarget === "plate" ? "plate.jpg" : "car.jpg";
        const file = new File([blob], name, { type: "image/jpeg" });
        if (cameraTarget === "plate") setPlateFile(file);
        else setCarFile(file);
        closeCamera();
      },
      "image/jpeg",
      0.9
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (req.plateNumber && !plateNumber.trim()) {
      setError("Plate number is required");
      return;
    }
    if (req.carColor && !carColor.trim()) {
      setError("Car color is required");
      return;
    }
    if (req.carMake && !carMake.trim()) {
      setError("Car brand (make) is required");
      return;
    }
    if (req.notes && !notes.trim()) {
      setError("Notes are required");
      return;
    }
    if (req.plateImage && !plateFile) {
      setError("Plate image is required");
      return;
    }
    if (req.carImage && !carFile) {
      setError("Car image is required");
      return;
    }
    if (tagRequired && !tagNumber.trim()) {
      setError("Tag number is required when key storage is in Tags mode");
      return;
    }
    setLoading(true);
    setError("");
    setCreatedUrl(null);
    setSlotMessage(null);
    setTagMessage(null);
    try {
      const auth = getFirebaseAuth();
      const user = auth.currentUser;
      if (!user) throw new Error("Not signed in");
      const db = getFirebaseDb();
      const storage = getFirebaseStorage();
      const now = new Date().toISOString();
      const publicId = randomId(10);
      const token = randomToken();
      const tokenHash = await sha256Hex(token);
      const ticketNumber = `T${Date.now().toString().slice(-8)}`;

      const carMeta = {
        ...(carColor.trim() && { color: carColor.trim() }),
        ...(carType && { type: carType }),
        ...(carMake.trim() && { make: carMake.trim() }),
      };
      const timestamps = {
        arrivedAt: now,
        parkedAt: now,
      };

      const ticketsRef = collection(db, "tenants", tenantId, "tickets");
      const ticketRef = await addDoc(ticketsRef, {
        ticketNumber,
        status: "PARKED" as TicketStatus,
        plateNumber: plateNumber.trim(),
        carMeta,
        timestamps,
        publicId,
        tokenHash,
        notes: notes.trim() || null,
        createdAt: now,
        updatedAt: now,
        tenantId,
      });
      const ticketId = ticketRef.id;

      let plateUrl: string | null = null;
      let carUrl: string | null = null;
      if (plateFile) {
        const platePath = `tenants/${tenantId}/tickets/${ticketId}/plate_${Date.now()}.jpg`;
        const plateRef = ref(storage, platePath);
        await uploadBytes(plateRef, plateFile);
        plateUrl = await getDownloadURL(plateRef);
      }
      if (carFile) {
        const carPath = `tenants/${tenantId}/tickets/${ticketId}/car_${Date.now()}.jpg`;
        const carRef = ref(storage, carPath);
        await uploadBytes(carRef, carFile);
        carUrl = await getDownloadURL(carRef);
      }
      if (plateUrl || carUrl) {
        await setDoc(
          ticketRef,
          {
            photoUrls: { plate: plateUrl, car: carUrl },
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }

      const publicTicketRef = doc(db, "tenants", tenantId, "publicTickets", publicId);
      await setDoc(publicTicketRef, {
        publicId,
        ticketId,
        status: "PARKED" as TicketStatus,
        updatedAt: now,
      });

      const eventsRef = collection(db, "tenants", tenantId, "events");
      await addDoc(eventsRef, {
        ticketId,
        actorUserId: user.uid,
        type: "TICKET_CREATED",
        at: now,
        meta: { publicId, ticketNumber },
      });

      if (keyStorageMode === "slots") {
        try {
          const token = await user.getIdToken();
          const res = await fetch(`/api/j/${slug}/staff/tickets/${ticketId}/assign-slot`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({}),
          });
          const data = await res.json();
          if (res.ok) setSlotMessage({ slotNumber: data.slotNumber });
          else if (data.noSlotsAvailable) setSlotMessage({ noSlots: true });
        } catch {
          setSlotMessage({ noSlots: true });
        }
      }

      if (keyStorageMode === "tags" && tagNumber.trim()) {
        try {
          const token = await user.getIdToken();
          const res = await fetch(`/api/j/${slug}/staff/tickets/${ticketId}/assign-tag`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ tagNumber: tagNumber.trim() }),
          });
          const data = await res.json();
          if (res.ok) setTagMessage({ tagNumber: data.tagNumber });
          else setTagMessage({ error: data.error ?? "Tag already in use" });
        } catch {
          setTagMessage({ error: "Failed to assign tag" });
        }
      }

      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
      const customerUrl = `${baseUrl}/j/${slug}/t/${publicId}?k=${token}`;
      setCreatedUrl(customerUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create ticket");
    } finally {
      setLoading(false);
    }
  };

  if (createdUrl) {
    return (
      <div className="max-w-lg space-y-4">
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="font-medium text-green-800">Ticket created</p>
          {slotMessage?.slotNumber != null && (
            <p className="mt-2 text-sm font-medium text-green-800">Key in slot {slotMessage.slotNumber}</p>
          )}
          {slotMessage?.noSlots && (
            <p className="mt-2 text-sm text-amber-700">No slots available. Assign a slot from the Requests queue when one is free.</p>
          )}
          {tagMessage?.tagNumber && (
            <p className="mt-2 text-sm font-medium text-green-800">Tag {tagMessage.tagNumber}</p>
          )}
          {tagMessage?.error && (
            <p className="mt-2 text-sm text-amber-700">{tagMessage.error}. You can assign a different tag from the Requests queue.</p>
          )}
          <p className="mt-2 text-sm text-green-700">Customer link (tap NFC or share):</p>
          <div className="mt-2 flex items-center gap-2">
            <input
              readOnly
              value={createdUrl}
              className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(createdUrl);
              }}
              className="rounded bg-gray-800 px-3 py-2 text-sm text-white"
            >
              Copy
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
    setCreatedUrl(null);
    setSlotMessage(null);
    setTagMessage(null);
            setPlateNumber("");
            setCarColor("");
            setCarType("sedan");
            setCarMake("");
            setNotes("");
            setPlateFile(null);
            setCarFile(null);
            setTagNumber("");
          }}
          className="rounded bg-blue-600 px-4 py-2 text-white"
        >
          Create another ticket
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Plate number {req.plateNumber ? "*" : ""}
        </label>
        <input
          type="text"
          value={plateNumber}
          onChange={(e) => setPlateNumber(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          required={req.plateNumber}
          placeholder="e.g. ABC 1234"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Car color {req.carColor ? "*" : ""}
        </label>
        <input
          type="text"
          value={carColor}
          onChange={(e) => setCarColor(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          required={req.carColor}
          placeholder="e.g. White"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Car type {req.carType ? "*" : ""}
        </label>
        <select
          value={carType}
          onChange={(e) => setCarType(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          required={req.carType}
        >
          {CAR_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700">
          Car brand (make) {req.carMake ? "*" : ""}
        </label>
        <input
          type="text"
          value={carMake}
          onChange={(e) => {
            setCarMake(e.target.value);
            setShowMakeSuggestions(true);
          }}
          onFocus={() => setShowMakeSuggestions(true)}
          onBlur={() => setTimeout(() => setShowMakeSuggestions(false), 200)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          placeholder="e.g. Toyota"
          autoComplete="off"
          required={req.carMake}
        />
        {showMakeSuggestions && (
          <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded border border-gray-200 bg-white py-1 shadow-lg">
            {CAR_MAKES.filter((m) =>
              m.toLowerCase().startsWith(carMake.trim().toLowerCase())
            )
              .slice(0, 12)
              .map((m) => (
                <li key={m}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setCarMake(m);
                      setShowMakeSuggestions(false);
                    }}
                  >
                    {m}
                  </button>
                </li>
              ))}
            {CAR_MAKES.filter((m) =>
              m.toLowerCase().startsWith(carMake.trim().toLowerCase())
            ).length === 0 && (
              <li className="px-3 py-2 text-sm text-gray-500">No match — you can type any brand</li>
            )}
          </ul>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Notes {req.notes ? "*" : ""}
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          rows={2}
          required={req.notes}
        />
      </div>
      {keyStorageMode === "tags" && (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Tag number {tagRequired ? "*" : "(optional)"}
          </label>
          <input
            type="text"
            value={tagNumber}
            onChange={(e) => setTagNumber(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            required={tagRequired}
            placeholder="e.g. K-001 or scan barcode"
          />
          {!tagRequired && (
            <p className="mt-1 text-xs text-gray-500">Leave empty to assign from the Requests queue later.</p>
          )}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Plate image {req.plateImage ? "*" : "(optional)"}
        </label>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openCamera("plate")}
            className="rounded bg-gray-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            Take photo
          </button>
          <span className="text-sm text-gray-500">or</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setPlateFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
          {plateFile && (
            <span className="text-sm text-green-600">{plateFile.name}</span>
          )}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Car image {req.carImage ? "*" : "(optional)"}
        </label>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openCamera("car")}
            className="rounded bg-gray-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            Take photo
          </button>
          <span className="text-sm text-gray-500">or</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setCarFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
          {carFile && (
            <span className="text-sm text-green-600">{carFile.name}</span>
          )}
        </div>
      </div>
      {cameraOpen && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4">
          <p className="mb-2 text-sm text-white">
            {cameraTarget === "plate" ? "Plate image" : "Car image"} — position and tap Capture
          </p>
          <video
            ref={videoRef}
            playsInline
            muted
            className="max-h-[70vh] max-w-full rounded-lg object-contain"
          />
          {cameraError && (
            <p className="mt-2 text-sm text-red-400">{cameraError}</p>
          )}
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={capturePhoto}
              disabled={!!cameraError}
              className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              Capture
            </button>
            <button
              type="button"
              onClick={closeCamera}
              className="rounded border border-white px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create ticket"}
        </button>
        <button
          type="button"
          onClick={() => router.push(`/j/${slug}/staff`)}
          className="rounded border border-gray-300 px-4 py-2"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
