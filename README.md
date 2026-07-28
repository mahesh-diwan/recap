# Recap

AI-powered YouTube video summaries using open-source models. Runs locally — no API keys, no cloud.

[**Live Demo**](https://mahesh-diwan.github.io/recap/) — see a pre-cached summary without installing anything.

## Features

- Structured summaries: TL;DR, chapters, key points, highlights
- Streaming output via SSE
- Supports any Ollama-compatible model (Qwen, Llama, Gemma, Mistral)
- Markdown export
- Demo mode with pre-cached summary (no Ollama needed)
- Clean cinematic dark UI

## Quick Start

```bash
# Clone
git clone https://github.com/mahesh-diwan/recap.git
cd recap

# Install
npm install

# Run (demo mode works without Ollama)
npm run dev
```

Open http://localhost:3000 and click "try a demo summary".

## With Ollama (full functionality)

1. Install Ollama: https://ollama.com
2. Pull a model: `ollama pull qwen2.5:1.5b`
3. Run the app: `npm run dev`
4. Paste any YouTube URL and summarize

## Configuration

| Variable          | Default                  | Description              |
| ----------------- | ------------------------ | ------------------------ |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL        |
| `OLLAMA_MODEL`    | auto-detected            | Override model selection |

## Tech Stack

- Next.js 15 (App Router)
- Tailwind CSS v4
- Ollama (local inference)
- youtube-transcript (transcript extraction)
- Motion v12 (animations)

## Project Structure

```
app/
  page.tsx          # Main UI
  docs/page.tsx     # How it works
  api/
    transcript/     # Fetch YouTube transcript
    summarize/      # Generate summary (SSE streaming)
    demo/           # Pre-cached demo summary
lib/
  inference.ts      # Ollama model resolution + inference
  prompts.ts        # SummaryJSON type + prompt building
  youtube.ts        # Video ID extraction
  markdown.ts       # Summary to markdown conversion
  cache.ts          # JSON file cache
```

## License

MIT
