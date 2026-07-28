import { findOllamaModel, isOllamaAvailable } from "@/lib/ollama";

export interface SummaryJSON {
  tldr: string;
  chapters: { title: string; startTime: string; startSeconds: number; summary: string }[];
  keyPoints: { point: string; timestamp: string }[];
  highlights: { quote: string; timestamp: string; context: string }[];
  facts: { fact: string; timestamp: string }[];
  actionItems: { action: string; timestamp: string }[];
}

const CHUNK_SIZE = 40;
const CHUNK_OVERLAP = 5;

const SYSTEM_PROMPT = `You are a video summarization expert. Given a YouTube video transcript, produce a structured JSON summary.

Return ONLY valid JSON with this exact structure:
{"tldr":"one paragraph summary","chapters":[{"title":"Chapter Title","startTime":"MM:SS","startSeconds":123,"summary":"What this section covers"}],"keyPoints":[{"point":"Main takeaway","timestamp":"MM:SS"}],"highlights":[{"quote":"Notable quote","timestamp":"MM:SS","context":"Why this matters"}],"facts":[{"fact":"Factual claim","timestamp":"MM:SS"}],"actionItems":[{"action":"Recommendation","timestamp":"MM:SS"}]}

Rules: 3-8 chapters, 5-10 key points, 3-5 highlights, all facts, all action items. Timestamps from transcript in MM:SS format.`;

export function buildSummaryPrompt(transcript: string, title: string): string {
  return `Video title: "${title}"

Transcript:
${transcript}

Produce the structured JSON summary.`;
}

export function chunkTranscript(transcript: string): string[] {
  const lines = transcript.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length <= CHUNK_SIZE) return [transcript];

  const chunks: string[] = [];
  let start = 0;

  while (start < lines.length) {
    const end = Math.min(start + CHUNK_SIZE, lines.length);
    chunks.push(lines.slice(start, end).join("\n"));
    if (end >= lines.length) break;
    start = end - CHUNK_OVERLAP;
  }

  return chunks;
}

export async function getSummaryFromAI(
  transcript: string,
  title: string
): Promise<SummaryJSON> {
  const available = await isOllamaAvailable();
  if (!available) throw new Error("Ollama not running. Start with: ollama serve");

  const model =
    (process.env.OLLAMA_MODEL as string) ||
    (await findOllamaModel("qwen2.5:1.5b", ["phi3.5", "llama3.2:3b", "gemma2:2b"]));

  if (!model) throw new Error("No Ollama model found. Run: ollama pull qwen2.5:1.5b");

  // Truncate long transcripts based on model context window
  const lines = transcript.split("\n").filter((l) => l.trim().length > 0);
  const maxLines = model.includes("qwen2.5:1.5b") ? 200 : 800;
  const truncated = lines.length > maxLines ? lines.slice(0, maxLines).join("\n") : transcript;

  // Use Ollama native API for runtime param control
  const baseURL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const res = await fetch(`${baseURL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildSummaryPrompt(truncated, title) },
      ],
      stream: false,
      options: {
        temperature: 0.3,
        num_predict: 2048,
        num_threads: 6,
        num_batch: 1024,
      },
    }),
  });

  if (!res.ok) throw new Error(`Ollama API error: ${res.status}`);
  const data = await res.json();
  const content = data.message?.content;
  if (content) {
    const cleaned = content.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned) as SummaryJSON;
    parsed.chapters = parsed.chapters || [];
    parsed.keyPoints = parsed.keyPoints || [];
    parsed.highlights = parsed.highlights || [];
    parsed.facts = parsed.facts || [];
    parsed.actionItems = parsed.actionItems || [];
    return parsed;
  }
  throw new Error("No content in Ollama response");
}