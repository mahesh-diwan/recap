import OpenAI from "openai";

let client: OpenAI | null = null;
let availableModels: string[] = [];

export function getOllama(): OpenAI {
  if (!client) {
    const baseURL = process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1";
    client = new OpenAI({
      apiKey: "ollama",
      baseURL,
    });
  }
  return client;
}

export async function getOllamaModels(): Promise<string[]> {
  if (availableModels) return availableModels;
  try {
    const res = await fetch("http://localhost:11434/api/tags", {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    availableModels = (data.models || []).map((m: any) => m.name);
    return availableModels;
  } catch {
    return [];
  }
}

export async function findOllamaModel(
  preferred: string,
  fallback: string[]
): Promise<string | null> {
  const models = await getOllamaModels();
  if (models.includes(preferred)) return preferred;
  for (const f of fallback) {
    if (models.includes(f)) return f;
  }
  return models[0] || null;
}

export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch("http://localhost:11434/api/tags", {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}