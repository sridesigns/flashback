/**
 * Lightweight JSON blob storage via jsonblob.com.
 * Free, no API key, CORS-friendly — used for Duet Mode photo sharing.
 * Blobs are deleted after 90 days of inactivity or first read (retention is best-effort).
 */

const API = "https://jsonblob.com/api/jsonBlob";

/**
 * Upload a JSON payload and return the blob ID (a numeric string ~19 chars).
 * The resulting share URL becomes: `${origin}/#duet=jb_${id}` — very short.
 */
export async function uploadBlob(data: unknown): Promise<string> {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Blob upload failed: ${res.status}`);
  const location = res.headers.get("Location") ?? "";
  const id = location.split("/").pop();
  if (!id) throw new Error("No blob ID in response");
  return id;
}

/**
 * Fetch a previously uploaded blob by its ID.
 */
export async function downloadBlob(id: string): Promise<unknown> {
  const res = await fetch(`${API}/${id}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Blob download failed: ${res.status}`);
  return res.json();
}
