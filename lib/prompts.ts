import { getOllama, getOllamaModel, isOllamaAvailable } from "@/lib/ollama";
import { getOpenAI } from "./openai";

export interface SummaryJSON {
  tldr: string;
  chapters: { title: string; startTime: string; startSeconds: number; summary: string }[];
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

export async function getSummaryFromAI(
  transcript: string,
  title: string
): Promise<SummaryJSON> {
  const ollamaAvailable = await isOllamaAvailable();

  if (ollamaAvailable) {
    const ollama = getOllama();
    const model = getOllamaModel();
    const response = await ollama.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildSummaryPrompt(transcript, title) },
      ],
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No content from Ollama");

    return JSON.parse(content) as SummaryJSON;
  }

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