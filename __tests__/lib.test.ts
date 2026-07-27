import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { unlinkSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

describe("extractVideoId", () => {
  const { extractVideoId } = {} as any;

  it("extracts from youtube.com/watch?v=", async () => {
    const mod = await import("@/app/api/transcript/route.ts");
    const id = mod.extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(id).toBe("dQw4w9WgXcQ");
  });

  it("extracts from youtu.be/", async () => {
    const mod = await import("@/app/api/transcript/route.ts");
    const id = mod.extractVideoId("https://youtu.be/dQw4w9WgXcQ");
    expect(id).toBe("dQw4w9WgXcQ");
  });

  it("extracts from youtube.com/embed/", async () => {
    const mod = await import("@/app/api/transcript/route.ts");
    const id = mod.extractVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ");
    expect(id).toBe("dQw4w9WgXcQ");
  });

  it("accepts bare video ID", async () => {
    const mod = await import("@/app/api/transcript/route.ts");
    const id = mod.extractVideoId("dQw4w9WgXcQ");
    expect(id).toBe("dQw4w9WgXcQ");
  });

  it("returns null for invalid URL", async () => {
    const mod = await import("@/app/api/transcript/route.ts");
    expect(mod.extractVideoId("not-a-url")).toBeNull();
  });

  it("returns null for empty string", async () => {
    const mod = await import("@/app/api/transcript/route.ts");
    expect(mod.extractVideoId("")).toBeNull();
  });
});

describe("chunkTranscript", () => {
  it("returns single chunk for short transcript", async () => {
    const { chunkTranscript } = await import("@/lib/prompts");
    const lines = Array.from({ length: 10 }, (_, i) => `Line ${i + 1}`);
    const result = chunkTranscript(lines.join("\n"));
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(lines.join("\n"));
  });

  it("splits long transcript into multiple chunks", async () => {
    const { chunkTranscript } = await import("@/lib/prompts");
    const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`);
    const result = chunkTranscript(lines.join("\n"));
    expect(result.length).toBeGreaterThan(1);
    expect(result[0].split("\n")).toHaveLength(40);
  });

  it("preserves all content across chunks", async () => {
    const { chunkTranscript } = await import("@/lib/prompts");
    const lines = Array.from({ length: 50 }, (_, i) => `Line ${i + 1}`);
    const result = chunkTranscript(lines.join("\n"));
    const allContent = result.join("\n");
    for (const line of lines) {
      expect(allContent).toContain(line);
    }
  });

  it("has 5-line overlap between chunks", async () => {
    const { chunkTranscript } = await import("@/lib/prompts");
    const lines = Array.from({ length: 80 }, (_, i) => `Line ${i + 1}`);
    const result = chunkTranscript(lines.join("\n"));

    const chunk1Lines = result[0].split("\n");
    const chunk2Lines = result[1].split("\n");

    const overlap = chunk2Lines.slice(0, 5);
    const expectedOverlap = chunk1Lines.slice(-5);
    expect(overlap).toEqual(expectedOverlap);
  });
});

describe("summaryToMarkdown", () => {
  it("includes title and TL;DR", async () => {
    const { summaryToMarkdown } = await import("@/lib/markdown");
    const summary = {
      tldr: "A test video summary.",
      chapters: [],
      keyPoints: [],
      highlights: [],
      facts: [],
      actionItems: [],
    };
    const md = summaryToMarkdown(summary, "Test Video", "thumb.jpg", "abc123");
    expect(md).toContain("# Test Video");
    expect(md).toContain("## TL;DR");
    expect(md).toContain("A test video summary.");
  });

  it("formats chapters, key points, highlights, facts, action items", async () => {
    const { summaryToMarkdown } = await import("@/lib/markdown");
    const summary = {
      tldr: "Summary",
      chapters: [{ title: "Intro", startTime: "00:00", startSeconds: 0, summary: "Opening" }],
      keyPoints: [{ point: "Key point", timestamp: "00:30" }],
      highlights: [{ quote: "Quote", timestamp: "00:45", context: "Context" }],
      facts: [{ fact: "Fact", timestamp: "01:00" }],
      actionItems: [{ action: "Action", timestamp: "02:00" }],
    };
    const md = summaryToMarkdown(summary, "Test", "t.jpg", "id");
    expect(md).toContain("## Chapters");
    expect(md).toContain("[00:00]");
    expect(md).toContain("Intro");
    expect(md).toContain("## Key Points");
    expect(md).toContain("## Highlights");
    expect(md).toContain("## Facts");
    expect(md).toContain("## Action Items");
    expect(md).toContain("Key point");
    expect(md).toContain("Quote");
    expect(md).toContain("Fact");
    expect(md).toContain("Action");
  });

  it("handles empty arrays gracefully", async () => {
    const { summaryToMarkdown } = await import("@/lib/markdown");
    const empty = { tldr: "Empty", chapters: [], keyPoints: [], highlights: [], facts: [], actionItems: [] };
    const md = summaryToMarkdown(empty, "Test", "t.jpg", "id");
    expect(md).toContain("## TL;DR");
    expect(md).not.toContain("## Chapters");
  });

  it("includes YouTube link with video ID", async () => {
    const { summaryToMarkdown } = await import("@/lib/markdown");
    const empty = { tldr: "", chapters: [], keyPoints: [], highlights: [], facts: [], actionItems: [] };
    const md = summaryToMarkdown(empty, "Test", "t.jpg", "abc123");
    expect(md).toContain("youtube.com/watch?v=abc123");
  });
});

describe("JSON Cache", () => {
  const testId = `test-${randomUUID().slice(0, 8)}`;
  const cacheFile = join(process.cwd(), "data", "cache.json");

  afterEach(() => {
    if (existsSync(cacheFile)) unlinkSync(cacheFile);
  });

  it("returns null for missing key", async () => {
    const { getCachedSummary, getCachedMarkdown } = await import("@/lib/cache");
    expect(getCachedSummary("nonexistent")).toBeNull();
    expect(getCachedMarkdown("nonexistent")).toBeNull();
  });

  it("stores and retrieves data", async () => {
    const { getCachedSummary, getCachedMarkdown, setCachedSummary } = await import("@/lib/cache");
    setCachedSummary(testId, "Test", "thumb.jpg", "transcript text", '{"tldr":"test"}', "# markdown");
    expect(getCachedSummary(testId)).toBe('{"tldr":"test"}');
    expect(getCachedMarkdown(testId)).toBe("# markdown");
  });

  it("overwrites existing entry", async () => {
    const { getCachedSummary, getCachedMarkdown, setCachedSummary } = await import("@/lib/cache");
    setCachedSummary(testId, "T", "", "t1", '{"tldr":"old"}', "# old");
    setCachedSummary(testId, "T", "", "t2", '{"tldr":"new"}', "# new");
    expect(getCachedSummary(testId)).toBe('{"tldr":"new"}');
    expect(getCachedMarkdown(testId)).toBe("# new");
  });
});