/**
 * Server-side proxy for jsonblob.com.
 * Runs on Vercel edge/serverless — no CORS restrictions, Location header is accessible.
 *
 * POST /api/blob          → upload JSON payload, returns { id }
 * GET  /api/blob?id=xxx   → fetch blob by ID, returns the stored JSON
 */

import { NextRequest, NextResponse } from "next/server";

const JSONBLOB = "https://jsonblob.com/api/jsonBlob";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const upstream = await fetch(JSONBLOB, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body,
    });
    if (!upstream.ok) {
      return NextResponse.json({ error: `upstream ${upstream.status}` }, { status: 502 });
    }
    const location = upstream.headers.get("Location") ?? "";
    const id = location.split("/").pop();
    if (!id) return NextResponse.json({ error: "no blob id in response" }, { status: 502 });
    return NextResponse.json({ id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  try {
    const upstream = await fetch(`${JSONBLOB}/${id}`, {
      headers: { Accept: "application/json" },
    });
    if (!upstream.ok) {
      return NextResponse.json({ error: "blob not found" }, { status: 404 });
    }
    const data = await upstream.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
