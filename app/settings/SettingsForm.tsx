"use client";

import { useEffect, useState } from "react";

interface KeyStatus {
  cloudflareAccountId: string | null;
  cloudflareApiTokenMasked: string | null;
  hasCloudflareApiToken: boolean;
  serpApiKeyMasked: string | null;
  hasSerpApiKey: boolean;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export default function SettingsForm() {
  const [status, setStatus] = useState<KeyStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [cloudflareAccountId, setCloudflareAccountId] = useState("");
  const [cloudflareApiToken, setCloudflareApiToken] = useState("");
  const [serpApiKey, setSerpApiKey] = useState("");

  const [cloudflareSave, setCloudflareSave] = useState<SaveState>("idle");
  const [serpApiSave, setSerpApiSave] = useState<SaveState>("idle");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) throw new Error("Could not load your saved keys");
        const data: KeyStatus = await res.json();
        if (!cancelled) {
          setStatus(data);
          setCloudflareAccountId(data.cloudflareAccountId ?? "");
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Could not load settings"
          );
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshStatus() {
    const res = await fetch("/api/settings");
    if (res.ok) setStatus(await res.json());
  }

  async function saveCloudflare() {
    setCloudflareSave("saving");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cloudflareAccountId,
          cloudflareApiToken: cloudflareApiToken || undefined,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setCloudflareApiToken("");
      setCloudflareSave("saved");
      await refreshStatus();
      setTimeout(() => setCloudflareSave("idle"), 2000);
    } catch {
      setCloudflareSave("error");
    }
  }

  async function clearCloudflare() {
    setCloudflareSave("saving");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearCloudflare: true }),
      });
      if (!res.ok) throw new Error("Clear failed");
      setCloudflareAccountId("");
      setCloudflareApiToken("");
      await refreshStatus();
      setCloudflareSave("idle");
    } catch {
      setCloudflareSave("error");
    }
  }

  async function saveSerpApi() {
    setSerpApiSave("saving");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serpApiKey }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSerpApiKey("");
      setSerpApiSave("saved");
      await refreshStatus();
      setTimeout(() => setSerpApiSave("idle"), 2000);
    } catch {
      setSerpApiSave("error");
    }
  }

  async function clearSerpApi() {
    setSerpApiSave("saving");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearSerpApi: true }),
      });
      if (!res.ok) throw new Error("Clear failed");
      setSerpApiKey("");
      await refreshStatus();
      setSerpApiSave("idle");
    } catch {
      setSerpApiSave("error");
    }
  }

  if (loadError) {
    return (
      <p className="text-sm text-red-600" role="alert">
        {loadError}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-900">
          Cloudflare Workers AI
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Used to generate your renovated room images. Get a free Account ID
          and API token (Workers AI permissions) from the{" "}
          <a
            href="https://dash.cloudflare.com/?to=/:account/ai/workers-ai"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Cloudflare dashboard
          </a>
          .
        </p>

        {status?.hasCloudflareApiToken && (
          <p className="mt-3 text-xs font-medium text-green-700">
            Currently saved: token {status.cloudflareApiTokenMasked}
          </p>
        )}

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Account ID
            </label>
            <input
              type="text"
              value={cloudflareAccountId}
              onChange={(e) => setCloudflareAccountId(e.target.value)}
              placeholder="e.g. a1b2c3d4e5f6..."
              className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm text-gray-900 outline-none focus:border-gray-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-gray-400">
              API Token
            </label>
            <input
              type="password"
              value={cloudflareApiToken}
              onChange={(e) => setCloudflareApiToken(e.target.value)}
              placeholder={
                status?.hasCloudflareApiToken
                  ? "Leave blank to keep current token"
                  : "Paste your Workers AI API token"
              }
              className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm text-gray-900 outline-none focus:border-gray-500"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={saveCloudflare}
            disabled={cloudflareSave === "saving" || !cloudflareAccountId}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {cloudflareSave === "saving" ? "Saving..." : "Save"}
          </button>
          {status?.hasCloudflareApiToken && (
            <button
              onClick={clearCloudflare}
              className="text-sm font-medium text-gray-500 hover:text-gray-900"
            >
              Remove saved key
            </button>
          )}
          {cloudflareSave === "saved" && (
            <span className="text-sm text-green-600">Saved ✓</span>
          )}
          {cloudflareSave === "error" && (
            <span className="text-sm text-red-600">Could not save</span>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-900">SerpAPI</h2>
        <p className="mt-1 text-sm text-gray-500">
          Used to find shoppable product matches for items in your design.
          Get a free key at{" "}
          <a
            href="https://serpapi.com/manage-api-key"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            serpapi.com
          </a>
          .
        </p>

        {status?.hasSerpApiKey && (
          <p className="mt-3 text-xs font-medium text-green-700">
            Currently saved: {status.serpApiKeyMasked}
          </p>
        )}

        <div className="mt-4">
          <label className="text-xs font-medium uppercase tracking-wide text-gray-400">
            API Key
          </label>
          <input
            type="password"
            value={serpApiKey}
            onChange={(e) => setSerpApiKey(e.target.value)}
            placeholder={
              status?.hasSerpApiKey
                ? "Leave blank to keep current key"
                : "Paste your SerpAPI key"
            }
            className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm text-gray-900 outline-none focus:border-gray-500"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={saveSerpApi}
            disabled={serpApiSave === "saving" || !serpApiKey}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {serpApiSave === "saving" ? "Saving..." : "Save"}
          </button>
          {status?.hasSerpApiKey && (
            <button
              onClick={clearSerpApi}
              className="text-sm font-medium text-gray-500 hover:text-gray-900"
            >
              Remove saved key
            </button>
          )}
          {serpApiSave === "saved" && (
            <span className="text-sm text-green-600">Saved ✓</span>
          )}
          {serpApiSave === "error" && (
            <span className="text-sm text-red-600">Could not save</span>
          )}
        </div>
      </section>
    </div>
  );
}