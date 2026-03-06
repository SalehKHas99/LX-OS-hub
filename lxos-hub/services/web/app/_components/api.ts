const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

function headers(extra?: HeadersInit): HeadersInit {
  const key = typeof window !== "undefined" ? localStorage.getItem("lxos_api_key") : null;
  return {
    "content-type": "application/json",
    ...(key ? { authorization: `Bearer ${key}` } : {}),
    ...(extra || {}),
  };
}

export function setApiKey(key: string) {
  if (typeof window !== "undefined") localStorage.setItem("lxos_api_key", key);
}

export function getApiKey(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem("lxos_api_key") : null;
}

export async function apiGet(path: string) {
  const r = await fetch(`${API_BASE}${path}`, { headers: headers(), cache: "no-store" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function apiPost(path: string, body?: unknown) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST", headers: headers(), body: JSON.stringify(body || {}),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function apiPatch(path: string, body?: unknown) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "PATCH", headers: headers(), body: JSON.stringify(body || {}),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function apiDelete(path: string) {
  const r = await fetch(`${API_BASE}${path}`, { method: "DELETE", headers: headers() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
