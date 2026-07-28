import { SummaryJSON } from "./prompts";

export function summaryToMarkdown(
  summary: SummaryJSON,
  title: string,
  thumbnail: string,
  videoId: string
): string {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const lines: string[] = [];

  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`![Thumbnail](${thumbnail})`);
  lines.push("");
  lines.push(`**Watch:** [YouTube](${videoUrl})`);
  lines.push("");

  lines.push("## TL;DR");
  lines.push("");
  lines.push(summary.tldr || "");
  lines.push("");

  if (summary.chapters.length > 0) {
    lines.push("## Chapters");
    lines.push("");
    for (const ch of summary.chapters) {
      lines.push(`### [${ch.startTime}] ${ch.title}`);
      lines.push("");
      lines.push(ch.summary);
      lines.push("");
    }
  }

  if (summary.keyPoints.length > 0) {
    lines.push("## Key Points");
    lines.push("");
    for (const kp of summary.keyPoints) {
      lines.push(`- **[${kp.timestamp}]** ${kp.point}`);
    }
    lines.push("");
  }

  if (summary.highlights.length > 0) {
    lines.push("## Highlights");
    lines.push("");
    for (const h of summary.highlights) {
      lines.push(`> **"${h.quote}"** [${h.timestamp}]`);
      lines.push(`> ${h.context}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}
