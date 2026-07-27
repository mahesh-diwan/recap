# YouTube Summarizer — Design Spec

## Overview

A Next.js web app that extracts YouTube video transcripts and generates structured AI summaries using GPT-4o-mini. Summaries appear side-by-side with the video player, with clickable timestamps that sync playback. Reports download as Markdown.

## Decisions

| Decision          | Choice                     | Rationale                                  |
| ----------------- | -------------------------- | ------------------------------------------ |
| Transcript source | youtube-transcript npm     | Free, no API key                           |
| AI provider       | OpenAI GPT-4o-mini         | Fast, cheap (~$0.001/video), great quality |
| Auth              | None                       | Personal tool, no login needed             |
| Report format     | Markdown                   | Universal, lightweight                     |
| Language          | English only               | Simpler prompt, faster                     |
| Layout            | Video left + summary right | User preference                            |
| Caching           | SQLite via Prisma          | Avoid repeat OpenAI calls                  |

## Architecture

```
URL → /api/transcript → youtube-transcript → raw transcript
   → check cache (Prisma) → hit? return cached
                           → miss? → /api/summarize → GPT-4o-mini → structured JSON
                                                      → save to cache
   → Display: [Video Player | Summary Panel]
   → Download: Markdown report
```

## File Structure

```
youtube_summarizer/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Main page (video + summary side-by-side)
│   ├── globals.css             # Tailwind styles
│   └── api/
│       ├── transcript/route.ts # Fetch transcript from YouTube
│       └── summarize/route.ts  # AI summary (with cache check)
├── lib/
│   ├── openai.ts               # OpenAI client setup
│   ├── prompts.ts              # Summary prompt template
│   └── markdown.ts             # Convert summary JSON → Markdown
├── prisma/
│   └── schema.prisma           # Summary cache model
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── next.config.js
└── .env.local                  # OPENAI_API_KEY
```

## Data Model

```prisma
model SummaryCache {
  id         String   @id @default(cuid())
  videoId    String   @unique
  title      String
  thumbnail  String
  transcript String
  summary    String   // JSON string of structured summary
  markdown   String   // Generated markdown report
  createdAt  DateTime @default(now())
}
```

## Summary Output Structure

GPT-4o-mini returns structured JSON:

```json
{
  "tldr": "One paragraph summary...",
  "chapters": [
    {
      "title": "Chapter Title",
      "startTime": "12:34",
      "startSeconds": 754,
      "summary": "..."
    }
  ],
  "keyPoints": [
    { "point": "Main argument or takeaway...", "timestamp": "5:23" }
  ],
  "highlights": [
    {
      "quote": "Notable quote from the video...",
      "timestamp": "15:42",
      "context": "Why this matters"
    }
  ],
  "facts": [{ "fact": "Extracted factual claim...", "timestamp": "8:11" }],
  "actionItems": [
    { "action": "Thing the speaker recommends doing...", "timestamp": "20:15" }
  ]
}
```

## UI Layout

```
┌─────────────────────────────────────────────────────────┐
│  YouTube Summarizer                                      │
├─────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────┐  │
│  │  Paste YouTube URL here...              [Summarize]│ │
│  └───────────────────────────────────────────────────┘  │
├──────────────────────────┬──────────────────────────────┤
│                          │                              │
│   ┌──────────────────┐   │   Summary                   │
│   │  YouTube Player  │   │   ───────                   │
│   │  (embedded)      │   │   [TL;DR paragraph]         │
│   └──────────────────┘   │                              │
│                          │   Chapters                   │
│   Title of the video     │   ├ 00:00 Intro - summary   │
│                          │   ├ 05:23 Topic A - summary  │
│                          │   └ 15:00 Topic B - summary  │
│                          │                              │
│                          │   Key Points                 │
│                          │   • Point 1 [5:23]           │
│                          │                              │
│                          │   Highlights                 │
│                          │   "Quote..." [15:42]         │
│                          │                              │
│                          │   Facts                      │
│                          │   • Fact 1 [8:11]            │
│                          │                              │
│                          │   Action Items               │
│                          │   ☐ Do this [20:15]          │
│                          │                              │
│                          │   [Download Report .md]      │
└──────────────────────────┴──────────────────────────────┘
```

- Clicking timestamps jumps the video player to that position
- Loading state while fetching transcript + generating summary
- Error states for invalid URLs, missing transcripts, API failures
- Responsive: stacks vertically on mobile

## API Routes

### POST /api/transcript

**Input:** `{ url: string }`
**Output:** `{ videoId: string, title: string, thumbnail: string, transcript: string }`
**Errors:** 400 (invalid URL), 404 (no transcript available), 500 (fetch failed)

### POST /api/summarize

**Input:** `{ videoId: string, title: string, thumbnail: string, transcript: string }`
**Output:** `{ summary: SummaryJSON, markdown: string }`
**Behavior:** Check cache by videoId first. On miss, call OpenAI, save to cache, return.
**Errors:** 400 (missing fields), 500 (OpenAI failure)

## Error Handling

| Error                   | User sees                                       |
| ----------------------- | ----------------------------------------------- |
| Invalid YouTube URL     | "Please enter a valid YouTube URL"              |
| No transcript available | "This video doesn't have captions available"    |
| OpenAI API failure      | "Failed to generate summary. Please try again." |
| Rate limit              | "Too many requests. Please wait a moment."      |

## Tech Dependencies

- next (App Router)
- react, react-dom
- tailwindcss
- prisma, @prisma/client
- youtube-transcript
- openai

## Environment Variables

```
OPENAI_API_KEY=sk-...
DATABASE_URL=file:./dev.db
```
