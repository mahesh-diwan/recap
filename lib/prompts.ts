export interface SummaryJSON {
  tldr: string;
  chapters: { title: string; startTime: string; startSeconds: number; summary: string }[];
  keyPoints: { point: string; timestamp: string }[];
  highlights: { quote: string; timestamp: string; context: string }[];
}

const CHUNK_SIZE = 40;
const CHUNK_OVERLAP = 5;

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

// Re-export inference functions for backward compatibility
export { summarize as getSummaryFromAI, summarizeStream as getSummaryStream } from "./inference";
export { isOllamaAvailable } from "./inference";
