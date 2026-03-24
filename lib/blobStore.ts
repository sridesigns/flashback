/**
 * Blob storage for Duet Mode photo sharing.
 * Routes through /api/blob (our own Next.js route) which proxies to jsonblob.com
 * server-side — avoiding CORS restrictions that block the Location header in browser.
 *
 * Share URLs: citofoto.vercel.app/#duet=jb_<id>  (~50 chars total)
 */

export async function uploadBlob(data: unknown): Promise<string> {
  const res = await fetch("/api/blob", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const json = await res.json() as { id?: string; error?: string };
  if (!json.id) throw new Error(json.error ?? "No ID returned");
  return json.id;
}

export async function downloadBlob(id: string): Promise<unknown> {
  const res = await fetch(`/api/blob?id=${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return res.json();
}
