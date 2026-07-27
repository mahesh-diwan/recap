import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSummaryFromAI, SummaryJSON } from "@/lib/prompts";
import { summaryToMarkdown } from "@/lib/markdown";

export async function POST(request: NextRequest) {
  try {
    const { videoId, title, thumbnail, transcript } = await request.json();

    if (!videoId || !transcript) {
      return NextResponse.json(
        { error: "videoId and transcript are required" },
        { status: 400 }
      );
    }

    const cached = await prisma.summaryCache.findUnique({
      where: { videoId },
    });

    if (cached) {
      return NextResponse.json({
        summary: JSON.parse(cached.summary) as SummaryJSON,
        markdown: cached.markdown,
      });
    }

    const summary = await getSummaryFromAI(transcript, title || "Untitled Video");
    const markdown = summaryToMarkdown(summary, title || "Untitled Video", thumbnail || "", videoId);

    await prisma.summaryCache.create({
      data: {
        videoId,
        title: title || "Untitled Video",
        thumbnail: thumbnail || "",
        transcript,
        summary: JSON.stringify(summary),
        markdown,
      },
    });

    return NextResponse.json({ summary, markdown });
  } catch (error: any) {
    console.error("Summarize error:", error);
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 }
    );
  }
}
