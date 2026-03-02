import { RESULTS_BASE } from "../data/constants";

export async function fetchWithFallback(path, opts = {}) {
  const url = `${RESULTS_BASE.replace("/results", "")}${path}?t=${Date.now()}`;
  try {
    const resp = await fetch(url, opts);
    if (resp.ok) return resp;
  } catch (_) { /* fall through */ }
  // local fallback
  const localResp = await fetch("." + path);
  if (localResp.ok) return localResp;
  throw new Error(`Failed to fetch ${path}`);
}

export async function fetchJSON(path, opts = {}) {
  const resp = await fetchWithFallback(path, opts);
  return resp.json();
}

export async function fetchText(path, opts = {}) {
  const resp = await fetchWithFallback(path, opts);
  return resp.text();
}
