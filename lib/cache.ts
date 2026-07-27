import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const CACHE_DIR = join(process.cwd(), "data");
const CACHE_FILE = join(CACHE_DIR, "cache.json");

interface CacheEntry {
  videoId: string;
  title: string;
  thumbnail: string;
  transcript: string;
  summary: string;
  markdown: string;
  createdAt: string;
}

function ensureCacheDir() {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function readCache(): Map<string, CacheEntry> {
  if (!existsSync(CACHE_FILE)) return new Map();
  try {
    const raw = readFileSync(CACHE_FILE, "utf-8");
    const entries: CacheEntry[] = JSON.parse(raw);
    return new Map(entries.map((e) => [e.videoId, e]));
  } catch {
    return new Map();
  }
}

function writeCache(cache: Map<string, CacheEntry>) {
  ensureCacheDir();
  const entries = Array.from(cache.values());
  writeFileSync(CACHE_FILE, JSON.stringify(entries, null, 2), "utf-8");
}

export function getCachedSummary(videoId: string): string | null {
  const cache = readCache();
  const entry = cache.get(videoId);
  if (!entry) return null;
  return entry.summary;
}

export function getCachedMarkdown(videoId: string): string | null {
  const cache = readCache();
  const entry = cache.get(videoId);
  if (!entry) return null;
  return entry.markdown;
}

export function setCachedSummary(
  videoId: string,
  title: string,
  thumbnail: string,
  transcript: string,
  summary: string,
  markdown: string
): void {
  const cache = readCache();
  cache.set(videoId, {
    videoId,
    title,
    thumbnail,
    transcript,
    summary,
    markdown,
    createdAt: new Date().toISOString(),
  });
  writeCache(cache);
}