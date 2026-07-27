# YouTube Summarizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js web app that extracts YouTube transcripts and generates structured AI summaries with a side-by-side video player and summary panel.

**Architecture:** Next.js App Router with two API routes (transcript fetch, AI summarize with SQLite cache). GPT-4o-mini generates structured JSON summaries. YouTube player embed on left, summary panel on right with clickable timestamps.

**Tech Stack:** Next.js 14+, React, TypeScript, Tailwind CSS, Prisma (SQLite), youtube-transcript, OpenAI API

## Global Constraints

- Node.js 18+
- TypeScript strict mode
- English only output
- No authentication
- Environment variable: `OPENAI_API_KEY` in `.env.local`

---

## File Map

| File                          | Purpose                                   |
| ----------------------------- | ----------------------------------------- |
| `package.json`                | Dependencies and scripts                  |
| `tsconfig.json`               | TypeScript config                         |
| `next.config.js`              | Next.js config                            |
| `tailwind.config.ts`          | Tailwind config                           |
| `postcss.config.js`           | PostCSS config (Tailwind)                 |
| `app/globals.css`             | Tailwind directives + custom styles       |
| `app/layout.tsx`              | Root layout                               |
| `app/page.tsx`                | Main page (URL input + side-by-side view) |
| `app/api/transcript/route.ts` | POST — fetch YouTube transcript           |
| `app/api/summarize/route.ts`  | POST — AI summary with cache              |
| `lib/openai.ts`               | OpenAI client singleton                   |
| `lib/prompts.ts`              | Summary prompt template                   |
| `lib/markdown.ts`             | Summary JSON → Markdown converter         |
| `prisma/schema.prisma`        | SummaryCache model                        |
| `.env.local`                  | OPENAI_API_KEY                            |

---

### Task 1: Project Scaffolding

**Files:**

- Create: `package.json`, `tsconfig.json`, `next.config.js`, `tailwind.config.ts`, `postcss.config.js`
- Create: `app/layout.tsx`, `app/globals.css`

**Interfaces:**

- Produces: Working Next.js dev server with Tailwind

- [ ] **Step 1: Initialize Next.js project**

```bash
cd /home/mahesh-diwan/SPECTRE/Projects/Youtube_Summarizer
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm --no-turbopack
```

Select defaults: TypeScript, ESLint, Tailwind CSS, App Router, `@/*` import alias.

- [ ] **Step 2: Install additional dependencies**

```bash
npm install openai youtube-transcript @prisma/client
npm install -D prisma
```

- [ ] **Step 3: Verify dev server starts**

```bash
npm run dev &
sleep 5
curl -s http://localhost:3000 | head -20
kill %1
```

Expected: HTML response with Next.js content.

- [ ] **Step 4: Commit**

```bash
git init
git add .
git commit -m "chore: scaffold Next.js project with Tailwind and dependencies"
```

---

### Task 2: Prisma + Database

**Files:**

- Create: `prisma/schema.prisma`
- Create: `lib/db.ts`

**Interfaces:**

- Produces: `prisma` client instance for cache queries

- [ ] **Step 1: Write Prisma schema**

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model SummaryCache {
  id         String   @id @default(cuid())
  videoId    String   @unique
  title      String
  thumbnail  String
  transcript String
  summary    String
  markdown   String
  createdAt  DateTime @default(now())
}
```

- [ ] **Step 2: Create lib/db.ts**

```typescript
// lib/db.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 3: Create .env.local**

```
OPENAI_API_KEY=sk-placeholder-replace-me
DATABASE_URL=file:./dev.db
```

- [ ] **Step 4: Run Prisma generate + push**

```bash
npx prisma generate
npx prisma db push
```

Expected: Database created at `prisma/dev.db`.

- [ ] **Step 5: Commit**

```bash
git add prisma/ lib/db.ts .env.local
git commit -m "feat: add Prisma schema and SQLite cache model"
```

---

### Task 3: OpenAI Client + Prompt

**Files:**

- Create: `lib/openai.ts`
- Create: `lib/prompts.ts`

**Interfaces:**

- Produces: `getSummaryFromAI(transcript: string, title: string) → Promise<SummaryJSON>`

- [ ] **Step 1: Create lib/openai.ts**

```typescript
// lib/openai.ts
import OpenAI from "openai";

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}
```

- [ ] **Step 2: Create lib/prompts.ts**

```typescript
// lib/prompts.ts
export interface SummaryJSON {
  tldr: string;
  chapters: {
    title: string;
    startTime: string;
    startSeconds: number;
    summary: string;
  }[];
  keyPoints: { point: string; timestamp: string }[];
  highlights: { quote: string; timestamp: string; context: string }[];
  facts: { fact: string; timestamp: string }[];
  actionItems: { action: string; timestamp: string }[];
}

const SYSTEM_PROMPT = `You are a video summarization expert. Given a YouTube video transcript, produce a structured JSON summary.

Return ONLY valid JSON (no markdown fences, no explanation) with this exact structure:
{
  "tldr": "One paragraph summary of the video's core message",
  "chapters": [
    { "title": "Chapter Title", "startTime": "MM:SS", "startSeconds": 123, "summary": "What this section covers" }
  ],
  "keyPoints": [
    { "point": "Main argument or takeaway", "timestamp": "MM:SS" }
  ],
  "highlights": [
    { "quote": "Notable quote or standout moment", "timestamp": "MM:SS", "context": "Why this matters" }
  ],
  "facts": [
    { "fact": "Extracted factual claim or data point", "timestamp": "MM:SS" }
  ],
  "actionItems": [
    { "action": "Thing the speaker recommends doing", "timestamp": "MM:SS" }
  ]
}

Rules:
- Chapters: 3-8 natural sections based on topic shifts. Use timestamps from the transcript.
- Key points: 5-10 most important takeaways.
- Highlights: 3-5 memorable quotes or moments.
- Facts: All notable factual claims, data, statistics.
- Action items: Any recommendations or things to do mentioned.
- Timestamps must match positions in the transcript.
- All timestamps in MM:SS format.`;

export function buildSummaryPrompt(transcript: string, title: string): string {
  return `Video title: "${title}"

Transcript:
${transcript}

Produce the structured JSON summary.`;
}

export { SYSTEM_PROMPT };
```

- [ ] **Step 3: Add getSummaryFromAI to lib/prompts.ts**

Append to the file:

```typescript
import { getOpenAI } from "./openai";

export async function getSummaryFromAI(
  transcript: string,
  title: string,
): Promise<SummaryJSON> {
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildSummaryPrompt(transcript, title) },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No content in OpenAI response");

  return JSON.parse(content) as SummaryJSON;
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/openai.ts lib/prompts.ts
git commit -m "feat: add OpenAI client and structured summary prompt"
```

---

### Task 4: Markdown Converter

**Files:**

- Create: `lib/markdown.ts`

**Interfaces:**

- Consumes: `SummaryJSON` from `lib/prompts.ts`
- Produces: `summaryToMarkdown(summary, title, thumbnail, videoId) → string`

- [ ] **Step 1: Create lib/markdown.ts**

```typescript
// lib/markdown.ts
import { SummaryJSON } from "./prompts";

export function summaryToMarkdown(
  summary: SummaryJSON,
  title: string,
  thumbnail: string,
  videoId: string,
): string {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const lines: string[] = [];

  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`![Thumbnail](${thumbnail})`);
  lines.push("");
  lines.push(`**Watch:** [YouTube](${videoUrl})`);
  lines.push("");

  // TL;DR
  lines.push("## TL;DR");
  lines.push("");
  lines.push(summary.tldr);
  lines.push("");

  // Chapters
  if (summary.chapters.length > 0) {
    lines.push("## Chapters");
    lines.push("");
    for (const ch of summary.chapters) {
      lines.push(`### [${ch.startTime}] ${ch.title}`);
      lines.push("");
      lines.push(ch.summary);
      lines.push("");
    }
  }

  // Key Points
  if (summary.keyPoints.length > 0) {
    lines.push("## Key Points");
    lines.push("");
    for (const kp of summary.keyPoints) {
      lines.push(`- **[${kp.timestamp}]** ${kp.point}`);
    }
    lines.push("");
  }

  // Highlights
  if (summary.highlights.length > 0) {
    lines.push("## Highlights");
    lines.push("");
    for (const h of summary.highlights) {
      lines.push(`> **"${h.quote}"** [${h.timestamp}]`);
      lines.push(`> ${h.context}`);
      lines.push("");
    }
  }

  // Facts
  if (summary.facts.length > 0) {
    lines.push("## Facts");
    lines.push("");
    for (const f of summary.facts) {
      lines.push(`- **[${f.timestamp}]** ${f.fact}`);
    }
    lines.push("");
  }

  // Action Items
  if (summary.actionItems.length > 0) {
    lines.push("## Action Items");
    lines.push("");
    for (const a of summary.actionItems) {
      lines.push(`- [ ] **[${a.timestamp}]** ${a.action}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/markdown.ts
git commit -m "feat: add Markdown report generator from summary JSON"
```

---

### Task 5: Transcript API Route

**Files:**

- Create: `app/api/transcript/route.ts`

**Interfaces:**

- Consumes: `youtube-transcript` npm package
- Produces: `POST /api/transcript` → `{ videoId, title, thumbnail, transcript }`

- [ ] **Step 1: Create app/api/transcript/route.ts**

```typescript
// app/api/transcript/route.ts
import { NextRequest, NextResponse } from "next/server";
import { YoutubeTranscript } from "youtube-transcript";

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function extractTitle(url: string): string {
  // Title will be fetched from oembed
  return "";
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json(
        { error: "Invalid YouTube URL" },
        { status: 400 },
      );
    }

    // Fetch video metadata from YouTube oembed
    let title = "Untitled Video";
    let thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

    try {
      const oembedRes = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      );
      if (oembedRes.ok) {
        const oembed = await oembedRes.json();
        title = oembed.title || title;
      }
    } catch {
      // oembed failed, use defaults
    }

    // Fetch transcript
    const transcriptEntries = await YoutubeTranscript.fetchTranscript(videoId);

    if (!transcriptEntries || transcriptEntries.length === 0) {
      return NextResponse.json(
        { error: "No transcript available for this video" },
        { status: 404 },
      );
    }

    // Format transcript with timestamps
    const transcript = transcriptEntries
      .map((entry) => {
        const minutes = Math.floor(entry.offset / 60000);
        const seconds = Math.floor((entry.offset % 60000) / 1000);
        const timestamp = `${minutes.toString().padStart(2, "0")}:${seconds
          .toString()
          .padStart(2, "0")}`;
        return `[${timestamp}] ${entry.text}`;
      })
      .join("\n");

    return NextResponse.json({ videoId, title, thumbnail, transcript });
  } catch (error: any) {
    console.error("Transcript error:", error);

    if (error?.message?.includes("Could not get the transcript")) {
      return NextResponse.json(
        { error: "No transcript available for this video" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch transcript" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/transcript/route.ts
git commit -m "feat: add transcript API route with YouTube oembed metadata"
```

---

### Task 6: Summarize API Route (with Cache)

**Files:**

- Create: `app/api/summarize/route.ts`

**Interfaces:**

- Consumes: `prisma` from `lib/db.ts`, `getSummaryFromAI` from `lib/prompts.ts`, `summaryToMarkdown` from `lib/markdown.ts`
- Produces: `POST /api/summarize` → `{ summary: SummaryJSON, markdown: string }`

- [ ] **Step 1: Create app/api/summarize/route.ts**

```typescript
// app/api/summarize/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSummaryFromAI, SummaryJSON } from "@/lib/prompts";
import { summaryToMarkdown } from "@/lib/markdown";

export async function POST(request: NextRequest) {
  try {
    const { videoId, title, thumbnail, transcript } = await request.json();

    if (!videoId || !transcript) {
      return NextResponse.json(
        { error: "videoId and transcript are required" },
        { status: 400 },
      );
    }

    // Check cache
    const cached = await prisma.summaryCache.findUnique({
      where: { videoId },
    });

    if (cached) {
      return NextResponse.json({
        summary: JSON.parse(cached.summary) as SummaryJSON,
        markdown: cached.markdown,
      });
    }

    // Generate summary
    const summary = await getSummaryFromAI(
      transcript,
      title || "Untitled Video",
    );
    const markdown = summaryToMarkdown(
      summary,
      title || "Untitled Video",
      thumbnail || "",
      videoId,
    );

    // Save to cache
    await prisma.summaryCache.create({
      data: {
        videoId,
        title: title || "Untitled Video",
        thumbnail: thumbnail || "",
        transcript,
        summary: JSON.stringify(summary),
        markdown,
      },
    });

    return NextResponse.json({ summary, markdown });
  } catch (error: any) {
    console.error("Summarize error:", error);
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/summarize/route.ts
git commit -m "feat: add summarize API route with SQLite cache"
```

---

### Task 7: Root Layout + Styles

**Files:**

- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

**Interfaces:**

- Produces: Clean layout shell with Inter font and dark theme

- [ ] **Step 1: Update app/globals.css**

Replace contents with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #0a0a0a;
  --foreground: #ededed;
}

body {
  color: var(--foreground);
  background: var(--background);
  font-family: "Inter", system-ui, sans-serif;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 3px;
}

/* Timestamp link styling */
.timestamp-link {
  @apply text-blue-400 hover:text-blue-300 cursor-pointer text-sm font-mono;
}
```

- [ ] **Step 2: Update app/layout.tsx**

```typescript
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "YouTube Summarizer",
  description: "AI-powered YouTube video summaries with structured insights",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx app/globals.css
git commit -m "feat: set up root layout with dark theme and Inter font"
```

---

### Task 8: Main Page (Full UI)

**Files:**

- Modify: `app/page.tsx`

**Interfaces:**

- Consumes: `POST /api/transcript`, `POST /api/summarize`
- Produces: Complete side-by-side UI with video player, summary panel, clickable timestamps, download button

- [ ] **Step 1: Create app/page.tsx**

```typescript
"use client";

import { useState, useRef, useCallback } from "react";

interface Chapter {
  title: string;
  startTime: string;
  startSeconds: number;
  summary: string;
}

interface SummaryJSON {
  tldr: string;
  chapters: Chapter[];
  keyPoints: { point: string; timestamp: string }[];
  highlights: { quote: string; timestamp: string; context: string }[];
  facts: { fact: string; timestamp: string }[];
  actionItems: { action: string; timestamp: string }[];
}

function parseTimestampToSeconds(ts: string): number {
  const parts = ts.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return parts[0] * 60 + parts[1];
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState<SummaryJSON | null>(null);
  const [markdown, setMarkdown] = useState("");
  const playerRef = useRef<HTMLIFrameElement>(null);

  const jumpTo = useCallback((timestamp: string) => {
    if (!playerRef.current) return;
    const seconds = parseTimestampToSeconds(timestamp);
    playerRef.current.src = `https://www.youtube.com/embed/${videoId}?start=${seconds}&autoplay=1`;
  }, [videoId]);

  const handleSummarize = async () => {
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setSummary(null);
    setMarkdown("");

    try {
      // Step 1: Fetch transcript
      const transcriptRes = await fetch("/api/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!transcriptRes.ok) {
        const data = await transcriptRes.json();
        throw new Error(data.error || "Failed to fetch transcript");
      }

      const transcriptData = await transcriptRes.json();
      setVideoId(transcriptData.videoId);
      setTitle(transcriptData.title);

      // Step 2: Generate summary
      const summaryRes = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transcriptData),
      });

      if (!summaryRes.ok) {
        const data = await summaryRes.json();
        throw new Error(data.error || "Failed to generate summary");
      }

      const summaryData = await summaryRes.json();
      setSummary(summaryData.summary);
      setMarkdown(summaryData.markdown);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!markdown) return;
    const blob = new Blob([markdown], { type: "text/markdown" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${title.replace(/[^a-zA-Z0-9]/g, "_") || "summary"}.md`;
    a.click();
    URL.revokeObjectURL(href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSummarize();
  };

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">YouTube Summarizer</h1>
        <p className="text-gray-400">
          Paste a YouTube URL and get AI-powered insights
        </p>
      </div>

      {/* URL Input */}
      <div className="flex gap-3 mb-8 max-w-3xl mx-auto">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste YouTube URL here..."
          className="flex-1 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          disabled={loading}
        />
        <button
          onClick={handleSummarize}
          disabled={loading || !url.trim()}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
        >
          {loading ? "Summarizing..." : "Summarize"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-8 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200 max-w-3xl mx-auto">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-400">
            Fetching transcript and generating summary...
          </p>
        </div>
      )}

      {/* Side-by-side view */}
      {videoId && summary && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Video Player */}
          <div>
            <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
              <iframe
                ref={playerRef}
                src={`https://www.youtube.com/embed/${videoId}`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <h2 className="mt-3 text-lg font-semibold">{title}</h2>
          </div>

          {/* Right: Summary Panel */}
          <div className="space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
            {/* Download Button */}
            <button
              onClick={handleDownload}
              className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
            >
              Download Report (.md)
            </button>

            {/* TL;DR */}
            <section>
              <h3 className="text-xl font-bold mb-2 text-blue-400">TL;DR</h3>
              <p className="text-gray-300 leading-relaxed">{summary.tldr}</p>
            </section>

            {/* Chapters */}
            {summary.chapters.length > 0 && (
              <section>
                <h3 className="text-xl font-bold mb-2 text-blue-400">
                  Chapters
                </h3>
                <div className="space-y-2">
                  {summary.chapters.map((ch, i) => (
                    <div
                      key={i}
                      className="p-3 bg-gray-900 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors"
                      onClick={() => jumpTo(ch.startTime)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="timestamp-link">{ch.startTime}</span>
                        <span className="font-medium">{ch.title}</span>
                      </div>
                      <p className="text-sm text-gray-400">{ch.summary}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Key Points */}
            {summary.keyPoints.length > 0 && (
              <section>
                <h3 className="text-xl font-bold mb-2 text-blue-400">
                  Key Points
                </h3>
                <ul className="space-y-2">
                  {summary.keyPoints.map((kp, i) => (
                    <li key={i} className="flex gap-2 text-gray-300">
                      <span
                        className="timestamp-link shrink-0"
                        onClick={() => jumpTo(kp.timestamp)}
                      >
                        [{kp.timestamp}]
                      </span>
                      <span>{kp.point}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Highlights */}
            {summary.highlights.length > 0 && (
              <section>
                <h3 className="text-xl font-bold mb-2 text-blue-400">
                  Highlights
                </h3>
                <div className="space-y-3">
                  {summary.highlights.map((h, i) => (
                    <blockquote
                      key={i}
                      className="pl-4 border-l-2 border-blue-500"
                    >
                      <p className="text-gray-300 italic">
                        &ldquo;{h.quote}&rdquo;
                      </p>
                      <span
                        className="timestamp-link"
                        onClick={() => jumpTo(h.timestamp)}
                      >
                        [{h.timestamp}]
                      </span>
                      <p className="text-sm text-gray-400 mt-1">{h.context}</p>
                    </blockquote>
                  ))}
                </div>
              </section>
            )}

            {/* Facts */}
            {summary.facts.length > 0 && (
              <section>
                <h3 className="text-xl font-bold mb-2 text-blue-400">Facts</h3>
                <ul className="space-y-2">
                  {summary.facts.map((f, i) => (
                    <li key={i} className="flex gap-2 text-gray-300">
                      <span
                        className="timestamp-link shrink-0"
                        onClick={() => jumpTo(f.timestamp)}
                      >
                        [{f.timestamp}]
                      </span>
                      <span>{f.fact}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Action Items */}
            {summary.actionItems.length > 0 && (
              <section>
                <h3 className="text-xl font-bold mb-2 text-blue-400">
                  Action Items
                </h3>
                <ul className="space-y-2">
                  {summary.actionItems.map((a, i) => (
                    <li key={i} className="flex gap-2 text-gray-300">
                      <span className="text-green-400 shrink-0">☐</span>
                      <span
                        className="timestamp-link shrink-0"
                        onClick={() => jumpTo(a.timestamp)}
                      >
                        [{a.timestamp}]
                      </span>
                      <span>{a.action}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add main page with side-by-side video and summary view"
```

---

### Task 9: Final Verification

**Files:**

- Modify: `.gitignore` (add `.env.local`, `prisma/dev.db`)

**Interfaces:**

- Produces: Working end-to-end flow

- [ ] **Step 1: Update .gitignore**

Add to `.gitignore`:

```
.env.local
prisma/dev.db
prisma/dev.db-journal
```

- [ ] **Step 2: Start dev server and verify**

```bash
npm run dev &
sleep 5
curl -s http://localhost:3000 | grep -o "YouTube Summarizer"
kill %1
```

Expected: "YouTube Summarizer" in HTML.

- [ ] **Step 3: Final commit**

```bash
git add .gitignore
git commit -m "chore: update gitignore for env and database files"
```

---

## Execution Notes

- Tasks 1-2 are setup. Tasks 3-4 are pure library code. Tasks 5-6 are API routes. Task 7-8 are the UI. Task 9 is polish.
- Each task is independently deployable — a reviewer can verify each one in isolation.
- The plan has no auth, no Docker, no multi-language — scoped to spec.
