"use client";

import { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { getFirebaseDb, getFirebaseAuth } from "@/lib/firebase/client";

interface Employee {
  id: string;
  email?: string;
  name?: string;
  role?: string;
  active?: boolean;
}

export function EmployeesList({
  slug,
  tenantId,
  tenantName,
}: {
  slug: string;
  tenantId: string;
  tenantName: string;
}) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("valet");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    const db = getFirebaseDb();
    const ref = collection(db, "tenants", tenantId, "users");
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        setEmployees(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as Employee))
        );
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [tenantId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setError(null);
    const auth = getFirebaseAuth().currentUser;
    if (!auth) return;
    try {
      const token = await auth.getIdToken();
      const res = await fetch(`/api/j/${slug}/admin/employees`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email, password, name, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setEmail("");
      setPassword("");
      setName("");
      setRole("valet");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add employee");
    } finally {
      setAdding(false);
    }
  };

  const toggleActive = async (userId: string, active: boolean) => {
    setTogglingId(userId);
    setError(null);
    const auth = getFirebaseAuth().currentUser;
    if (!auth) return;
    try {
      const token = await auth.getIdToken();
      const res = await fetch(`/api/j/${slug}/admin/employees/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ active: !active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) return <p className="text-gray-500">Loading…</p>;
  if (error && employees.length === 0) return <p className="text-red-500">{error}</p>;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h3 className="font-medium mb-3">Add employee</h3>
        <form onSubmit={handleAdd} className="flex flex-wrap gap-3 items-end">
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded border border-gray-300 px-3 py-1.5"
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border border-gray-300 px-3 py-1.5"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded border border-gray-300 px-3 py-1.5"
            required
            minLength={6}
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded border border-gray-300 px-3 py-1.5"
          >
            <option value="valet">Valet</option>
            <option value="manager">Manager</option>
          </select>
          <button
            type="submit"
            disabled={adding}
            className="rounded bg-blue-600 px-4 py-1.5 text-white text-sm disabled:opacity-50"
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </form>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Active</th>
              <th className="px-4 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id} className="border-b last:border-0">
                <td className="px-4 py-2">{emp.name ?? "—"}</td>
                <td className="px-4 py-2">{emp.email ?? "—"}</td>
                <td className="px-4 py-2">{emp.role ?? "—"}</td>
                <td className="px-4 py-2">{emp.active ? "Yes" : "No"}</td>
                <td className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() => toggleActive(emp.id, emp.active ?? true)}
                    disabled={togglingId === emp.id}
                    className="text-blue-600 underline text-sm disabled:opacity-50"
                  >
                    {togglingId === emp.id ? "…" : emp.active ? "Disable" : "Enable"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
