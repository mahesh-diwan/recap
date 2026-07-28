import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

interface CacheEntry {
  videoId: string;
  title: string;
  thumbnail: string;
  transcript: string;
  summary: string;
  markdown: string;
}

export async function GET() {
  try {
    const cachePath = path.join(process.cwd(), "data", "demo-cache.json");
    const raw = fs.readFileSync(cachePath, "utf-8");
    const entries: CacheEntry[] = JSON.parse(raw);

    if (!entries.length) {
      return NextResponse.json({ error: "Demo cache is empty" }, { status: 404 });
    }

    const entry = entries[0];

    return NextResponse.json({
      videoId: entry.videoId,
      title: entry.title,
      thumbnail: entry.thumbnail,
      summary: JSON.parse(entry.summary),
      markdown: entry.markdown,
    });
  } catch (error: any) {
    console.error("Demo route error:", error);
    return NextResponse.json(
      { error: "Failed to load demo summary" },
      { status: 500 }
    );
  }
}
