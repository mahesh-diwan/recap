import type { SummaryJSON } from "./prompts";

const SYSTEM_PROMPT = `You are a video summarization expert. Given a YouTube video transcript, produce a structured JSON summary.

Return ONLY valid JSON with this exact structure:
{"tldr":"one paragraph summary","chapters":[{"title":"Chapter Title","startTime":"MM:SS","startSeconds":123,"summary":"What this section covers"}],"keyPoints":[{"point":"Main takeaway","timestamp":"MM:SS"}],"highlights":[{"quote":"Notable quote","timestamp":"MM:SS","context":"Why this matters"}]}

Rules: 3-8 chapters, 5-10 key points, 3-5 highlights. Timestamps from transcript in MM:SS format.`;

const PREFERRED_MODEL = "qwen2.5:1.5b";
const FALLBACK_MODELS = ["phi3.5", "llama3.2:3b", "gemma2:2b"];

async function getAvailableModels(): Promise<string[]> {
  const baseURL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  try {
    const res = await fetch(`${baseURL}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models || []).map((m: any) => m.name);
  } catch {
    return [];
  }
}

async function resolveModel(): Promise<string> {
  const envModel = process.env.OLLAMA_MODEL as string;
  if (envModel) return envModel;

  const models = await getAvailableModels();
  if (models.includes(PREFERRED_MODEL)) return PREFERRED_MODEL;
  for (const f of FALLBACK_MODELS) {
    if (models.includes(f)) return f;
  }
  return models[0] || "";
}

export async function isOllamaAvailable(): Promise<boolean> {
  const baseURL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  try {
    const res = await fetch(`${baseURL}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function truncateTranscript(transcript: string, model: string): string {
  const lines = transcript.split("\n").filter((l) => l.trim().length > 0);
  const maxLines = model.includes("qwen2.5:1.5b") ? 200 : 800;
  return lines.length > maxLines ? lines.slice(0, maxLines).join("\n") : transcript;
}

function ollamaFetch(model: string, transcript: string, title: string, stream: boolean) {
  const baseURL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const truncated = truncateTranscript(transcript, model);
  return fetch(`${baseURL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Video title: "${title}"\n\nTranscript:\n${truncated}\n\nProduce the structured JSON summary.` },
      ],
      stream,
      options: { temperature: 0.3, num_predict: 2048, num_threads: 6, num_batch: 1024 },
    }),
  });
}

function parseSummaryJson(raw: string): SummaryJSON {
  const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned) as SummaryJSON;
  parsed.chapters = parsed.chapters || [];
  parsed.keyPoints = parsed.keyPoints || [];
  parsed.highlights = parsed.highlights || [];
  return parsed;
}

export async function summarize(
  transcript: string,
  title: string
): Promise<SummaryJSON> {
  const model = await resolveModel();
  if (!model) throw new Error("No Ollama model found. Run: ollama pull qwen2.5:1.5b");

  const res = await ollamaFetch(model, transcript, title, false);
  if (!res.ok) throw new Error(`Ollama API error: ${res.status}`);

  const data = await res.json();
  const content = data.message?.content;
  if (!content) throw new Error("No content in Ollama response");
  return parseSummaryJson(content);
}

export async function* summarizeStream(
  transcript: string,
  title: string
): AsyncGenerator<string, void, unknown> {
  const model = await resolveModel();
  if (!model) throw new Error("No Ollama model found. Run: ollama pull qwen2.5:1.5b");

  const res = await ollamaFetch(model, transcript, title, true);
  if (!res.ok) throw new Error(`Ollama API error: ${res.status}`);

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        if (obj.message?.content) {
          yield obj.message.content;
        }
      } catch {
        // partial JSON line, skip
      }
    }
  }
}

export { parseSummaryJson, SYSTEM_PROMPT };
