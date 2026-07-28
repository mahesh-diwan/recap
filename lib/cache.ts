import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

interface CacheEntry {
  videoId: string;
  title: string;
  thumbnail: string;
  transcript: string;
  summary: string;
  markdown: string;
  createdAt: string;
}

function getCachePath(cacheDir?: string) {
  const dir = cacheDir || join(process.cwd(), "data");
  return { dir, file: join(dir, "cache.json") };
}

function ensureCacheDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function readCache(cacheDir?: string): Map<string, CacheEntry> {
  const { file } = getCachePath(cacheDir);
  if (!existsSync(file)) return new Map();
  try {
    const raw = readFileSync(file, "utf-8");
    const entries: CacheEntry[] = JSON.parse(raw);
    return new Map(entries.map((e) => [e.videoId, e]));
  } catch {
    return new Map();
  }
}

function writeCache(cache: Map<string, CacheEntry>, cacheDir?: string) {
  const { dir, file } = getCachePath(cacheDir);
  ensureCacheDir(dir);
  const entries = Array.from(cache.values());
  writeFileSync(file, JSON.stringify(entries, null, 2), "utf-8");
}

export function getCachedSummary(videoId: string, cacheDir?: string): string | null {
  const cache = readCache(cacheDir);
  const entry = cache.get(videoId);
  if (!entry) return null;
  return entry.summary;
}

export function getCachedMarkdown(videoId: string, cacheDir?: string): string | null {
  const cache = readCache(cacheDir);
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
  markdown: string,
  cacheDir?: string
): void {
  const cache = readCache(cacheDir);
  cache.set(videoId, {
    videoId,
    title,
    thumbnail,
    transcript,
    summary,
    markdown,
    createdAt: new Date().toISOString(),
  });
  writeCache(cache, cacheDir);
}
