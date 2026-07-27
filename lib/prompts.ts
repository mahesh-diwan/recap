import {
  getOllama,
  getOllamaModels,
  findOllamaModel,
  isOllamaAvailable,
} from "@/lib/ollama";
import { getOpenAI } from "./openai";

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

const CHUNK_SYSTEM_PROMPT = `You are a summarizer. Summarize the following transcript chunk into a structured JSON object. Return ONLY valid JSON, no markdown fences, no explanation.

{
  "chunkSummary": "One paragraph summarizing this chunk's content",
  "chunkKeyPoints": ["Main takeaway 1", "Main takeaway 2"],
  "chunkHighlights": ["Notable quote or moment", "Another standout"],
  "chunkFacts": ["Factual claim from this chunk"],
  "chunkActionItems": ["Recommendation or action mentioned"]
}`;

const CHUNK_USER_PROMPT = (chunk: string, index: number, total: number) =>
  `Transcript chunk ${index + 1} of ${total} (time range will be extracted automatically):

${chunk}

Summarize this chunk.`;

const REDUCE_SYSTEM_PROMPT = `You are a video summarization expert. Combine multiple chunked summaries into a single structured JSON summary for a YouTube video.

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
- Chapters: 3-8 natural sections based on topic shifts across chunks.
- Key points: 5-10 most important takeaways, deduplicated across chunks.
- Highlights: 3-5 memorable quotes or moments from across all chunks.
- Facts: All notable factual claims, data, statistics from across chunks.
- Action items: Any recommendations or things to do mentioned across chunks.
- Timestamps should be taken from where the content appears in the original transcript.`;

const REDUCE_USER_PROMPT = (
  title: string,
  chunks: string[],
  chunkSummaries: string[]
) =>
  `Video title: "${title}"

Here are the summaries from each transcript chunk:

${chunkSummaries
  .map((s, i) => `--- Chunk ${i + 1} ---\n${s}`)
  .join("\n\n")}

Combine all chunk summaries into one comprehensive structured JSON summary.`;

function buildChunkPrompt(chunk: string, index: number, total: number): string {
  return CHUNK_USER_PROMPT(chunk, index, total);
}

async function summarizeChunk(
  ollama: ReturnType<typeof getOllama>,
  model: string,
  chunk: string,
  index: number,
  total: number
): Promise<string> {
  const response = await ollama.chat.completions.create({
    model,
    messages: [
      { role: "system", content: CHUNK_SYSTEM_PROMPT },
      { role: "user", content: buildChunkPrompt(chunk, index, total) },
    ],
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error(`No content in chunk ${index + 1}`);

  return content;
}

async function reduceSummaries(
  ollama: ReturnType<typeof getOllama>,
  model: string,
  title: string,
  chunks: string[],
  chunkSummaries: string[]
): Promise<SummaryJSON> {
  const response = await ollama.chat.completions.create({
    model,
    messages: [
      { role: "system", content: REDUCE_SYSTEM_PROMPT },
      {
        role: "user",
        content: REDUCE_USER_PROMPT(title, chunks, chunkSummaries),
      },
    ],
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No content in reduce phase");

  return JSON.parse(content) as SummaryJSON;
}

export async function getSummaryFromAI(
  transcript: string,
  title: string
): Promise<SummaryJSON> {
  const ollamaAvailable = await isOllamaAvailable();

  if (ollamaAvailable) {
    const model =
      (process.env.OLLAMA_MODEL as string) ||
      (await findOllamaModel("llama3.2:3b", ["qwen2.5:7b", "gemma2:2b"]));

    if (model) {
      const ollama = getOllama();
      try {
        const chunks = chunkTranscript(transcript);

        if (chunks.length <= 1) {
          const response = await ollama.chat.completions.create({
            model,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              {
                role: "user",
                content: buildSummaryPrompt(transcript, title),
              },
            ],
            temperature: 0.3,
          });

          const content = response.choices[0]?.message?.content;
          if (content) return JSON.parse(content) as SummaryJSON;
        } else {
          const chunkSummaries: string[] = [];
          for (let i = 0; i < chunks.length; i++) {
            const summary = await summarizeChunk(
              ollama,
              model,
              chunks[i],
              i,
              chunks.length
            );
            chunkSummaries.push(summary);
          }

          return await reduceSummaries(
            ollama,
            model,
            title,
            chunks,
            chunkSummaries
          );
        }
      } catch {
        // Model failed, fall through to OpenAI or next attempt
      }
    }
  }

  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: buildSummaryPrompt(transcript, title),
      },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("No content in OpenAI response");

  return JSON.parse(content) as SummaryJSON;
}