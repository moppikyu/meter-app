"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";

export default function PasswordForm({ username }: { username: string }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not change password");
        return;
      }
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="max-w-sm mx-auto space-y-4">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-ink">Change Password</h1>
          <Link
            href="/dashboard"
            className="flex items-center gap-1 text-sm text-ink-soft hover:text-ink"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={2} />
            Dashboard
          </Link>
        </header>

        <form
          onSubmit={handleSubmit}
          className="bg-surface rounded-md border border-line p-5 space-y-4"
        >
          <p className="text-sm text-ink-soft">
            Signed in as <span className="font-medium text-ink">{username}</span>
          </p>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-water/40 focus:border-water"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-water/40 focus:border-water"
              minLength={8}
              required
            />
            <p className="text-xs text-ink-soft mt-1">At least 8 characters.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-water/40 focus:border-water"
              required
            />
          </div>

          {error && <p className="text-sm text-bad">{error}</p>}
          {success && (
            <p className="text-sm text-good flex items-center gap-1.5">
              <Check className="w-4 h-4" strokeWidth={2} />
              Password updated.
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-water text-white text-sm font-medium py-2 hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Saving..." : "Update password"}
          </button>
        </form>
      </div>
    </main>
  );
}
