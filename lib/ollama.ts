import OpenAI from "openai";

let client: OpenAI | null = null;

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

export function getOllamaModel(): string {
  return process.env.OLLAMA_MODEL || "llama3.2:3b";
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