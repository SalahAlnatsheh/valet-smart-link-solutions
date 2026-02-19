"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";

export function StaffLoginForm({
  slug,
  tenantId,
  tenantName,
}: {
  slug: string;
  tenantId: string;
  tenantName: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasUsers, setHasUsers] = useState<boolean | null>(null);
  const [isFirstAdmin, setIsFirstAdmin] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch(`/api/j/${slug}/staff/has-users`)
      .then((r) => r.json())
      .then((data) => {
        setHasUsers(data.hasUsers === true);
        setIsFirstAdmin(data.hasUsers === false);
      })
      .catch(() => setHasUsers(true));
  }, [slug]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const auth = getFirebaseAuth();
      await signInWithEmailAndPassword(auth, email, password);
      router.push(`/j/${slug}/staff`);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Login failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleFirstAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/j/${slug}/staff/first-admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create admin");
      const auth = getFirebaseAuth();
      await signInWithEmailAndPassword(auth, email, password);
      router.push(`/j/${slug}/staff`);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create admin");
    } finally {
      setLoading(false);
    }
  };

  if (hasUsers === null) {
    return (
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow">
      <h1 className="text-xl font-semibold mb-4">{tenantName} — Staff</h1>
      {isFirstAdmin ? (
        <form onSubmit={handleFirstAdmin} className="space-y-4">
          <p className="text-sm text-gray-600">Create the first admin account for this tenant.</p>
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2"
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2"
            required
            minLength={6}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-blue-600 py-2 text-white font-medium disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create admin account"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2"
            required
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-blue-600 py-2 text-white font-medium disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      )}
    </div>
  );
}
