import { NextRequest, NextResponse } from "next/server";
import { SummaryJSON } from "@/lib/prompts";
import { summarize, summarizeStream, parseSummaryJson } from "@/lib/inference";
import { summaryToMarkdown } from "@/lib/markdown";
import { getCachedSummary, getCachedMarkdown, setCachedSummary } from "@/lib/cache";

export async function POST(request: NextRequest) {
  try {
    const { videoId, title, thumbnail, transcript, stream } = await request.json();

    if (!videoId || !transcript) {
      return NextResponse.json(
        { error: "videoId and transcript are required" },
        { status: 400 }
      );
    }

    if (transcript.length > 100000) {
      return NextResponse.json(
        { error: "Transcript too long. Please use a shorter video." },
        { status: 400 }
      );
    }

    // Check cache first (works for both stream and non-stream)
    const cached = getCachedSummary(videoId);
    if (cached) {
      const summary = JSON.parse(cached) as SummaryJSON;
      const markdown = getCachedMarkdown(videoId) || "";
      if (stream) {
        // Send cached result as SSE
        const encoder = new TextEncoder();
        const streamResponse = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "token", content: JSON.stringify(summary) })}\n\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", summary, markdown })}\n\n`));
            controller.close();
          },
        });
        return new Response(streamResponse, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }
      return NextResponse.json({ summary, markdown });
    }

    // Non-streaming: existing behavior
    if (!stream) {
      const summary = await summarize(transcript, title || "Untitled Video");
      const markdown = summaryToMarkdown(summary, title || "Untitled Video", thumbnail || "", videoId);
      setCachedSummary(videoId, title || "Untitled Video", thumbnail || "", transcript, JSON.stringify(summary), markdown);
      return NextResponse.json({ summary, markdown });
    }

    // Streaming: SSE response
    const encoder = new TextEncoder();
    let accumulated = "";

    const streamResponse = new ReadableStream({
      async start(controller) {
        try {
          for await (const token of summarizeStream(transcript, title || "Untitled Video")) {
            accumulated += token;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "token", content: token })}\n\n`)
            );
          }

          // Parse final JSON
          const summary = parseSummaryJson(accumulated);
          const markdown = summaryToMarkdown(summary, title || "Untitled Video", thumbnail || "", videoId);
          setCachedSummary(videoId, title || "Untitled Video", thumbnail || "", transcript, JSON.stringify(summary), markdown);

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done", summary, markdown })}\n\n`)
          );
          controller.close();
        } catch (err: any) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", error: err.message })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(streamResponse, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("Summarize error:", error);
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 }
    );
  }
}
