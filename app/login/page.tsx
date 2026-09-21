"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Droplet } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-surface rounded-md border border-line p-6 space-y-4"
      >
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-water-soft">
            <Droplet className="w-4 h-4 text-water" strokeWidth={2} />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-ink leading-tight">Meter Readings</h1>
            <p className="text-xs text-ink-soft">Sign in to continue</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">Username</label>
          <input
            className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-water/40 focus:border-water"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1">Password</label>
          <input
            type="password"
            className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-water/40 focus:border-water"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        {error && <p className="text-sm text-bad">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-water text-white text-sm font-medium py-2 hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
