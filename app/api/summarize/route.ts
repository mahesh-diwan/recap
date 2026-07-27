import { NextRequest, NextResponse } from "next/server";
import { getSummaryFromAI, SummaryJSON } from "@/lib/prompts";
import { summaryToMarkdown } from "@/lib/markdown";
import { getCachedSummary, getCachedMarkdown, setCachedSummary } from "@/lib/cache";

export async function POST(request: NextRequest) {
  try {
    const { videoId, title, thumbnail, transcript } = await request.json();

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

    const cached = getCachedSummary(videoId);

    if (cached) {
      return NextResponse.json({
        summary: JSON.parse(cached) as SummaryJSON,
        markdown: getCachedMarkdown(videoId) || "",
      });
    }

    const summary = await getSummaryFromAI(transcript, title || "Untitled Video");
    const markdown = summaryToMarkdown(summary, title || "Untitled Video", thumbnail || "", videoId);

    setCachedSummary(videoId, title || "Untitled Video", thumbnail || "", transcript, JSON.stringify(summary), markdown);

    return NextResponse.json({ summary, markdown });
  } catch (error: any) {
    console.error("Summarize error:", error);
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 }
    );
  }
}