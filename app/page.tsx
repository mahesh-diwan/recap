"use client";

import { useState, useRef, useCallback } from "react";

interface Chapter {
  title: string;
  startTime: string;
  startSeconds: number;
  summary: string;
}

interface SummaryJSON {
  tldr: string;
  chapters: Chapter[];
  keyPoints: { point: string; timestamp: string }[];
  highlights: { quote: string; timestamp: string; context: string }[];
  facts: { fact: string; timestamp: string }[];
  actionItems: { action: string; timestamp: string }[];
}

function parseTimestampToSeconds(ts: string): number {
  const parts = ts.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return parts[0] * 60 + parts[1];
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState<SummaryJSON | null>(null);
  const [markdown, setMarkdown] = useState("");
  const playerRef = useRef<HTMLIFrameElement>(null);

  const jumpTo = useCallback((timestamp: string) => {
    if (!playerRef.current) return;
    const seconds = parseTimestampToSeconds(timestamp);
    playerRef.current.src = `https://www.youtube.com/embed/${videoId}?start=${seconds}&autoplay=1`;
  }, [videoId]);

  const handleSummarize = async () => {
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setSummary(null);
    setMarkdown("");

    try {
      // Step 1: Fetch transcript
      const transcriptRes = await fetch("/api/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!transcriptRes.ok) {
        const data = await transcriptRes.json();
        throw new Error(data.error || "Failed to fetch transcript");
      }

      const transcriptData = await transcriptRes.json();
      setVideoId(transcriptData.videoId);
      setTitle(transcriptData.title);

      // Step 2: Generate summary
      const summaryRes = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transcriptData),
      });

      if (!summaryRes.ok) {
        const data = await summaryRes.json();
        throw new Error(data.error || "Failed to generate summary");
      }

      const summaryData = await summaryRes.json();
      setSummary(summaryData.summary);
      setMarkdown(summaryData.markdown);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!markdown) return;
    const blob = new Blob([markdown], { type: "text/markdown" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${title.replace(/[^a-zA-Z0-9]/g, "_") || "summary"}.md`;
    a.click();
    URL.revokeObjectURL(href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSummarize();
  };

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">YouTube Summarizer</h1>
        <p className="text-gray-400">
          Paste a YouTube URL and get AI-powered insights
        </p>
      </div>

      {/* URL Input */}
      <div className="flex gap-3 mb-8 max-w-3xl mx-auto">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste YouTube URL here..."
          className="flex-1 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          disabled={loading}
        />
        <button
          onClick={handleSummarize}
          disabled={loading || !url.trim()}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
        >
          {loading ? "Summarizing..." : "Summarize"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-8 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200 max-w-3xl mx-auto">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-400">
            Fetching transcript and generating summary...
          </p>
        </div>
      )}

      {/* Side-by-side view */}
      {videoId && summary && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Video Player */}
          <div>
            <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
              <iframe
                ref={playerRef}
                src={`https://www.youtube.com/embed/${videoId}`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <h2 className="mt-3 text-lg font-semibold">{title}</h2>
          </div>

          {/* Right: Summary Panel */}
          <div className="space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
            {/* Download Button */}
            <button
              onClick={handleDownload}
              className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
            >
              Download Report (.md)
            </button>

            {/* TL;DR */}
            <section>
              <h3 className="text-xl font-bold mb-2 text-blue-400">TL;DR</h3>
              <p className="text-gray-300 leading-relaxed">{summary.tldr}</p>
            </section>

            {/* Chapters */}
            {summary.chapters.length > 0 && (
              <section>
                <h3 className="text-xl font-bold mb-2 text-blue-400">
                  Chapters
                </h3>
                <div className="space-y-2">
                  {summary.chapters.map((ch, i) => (
                    <div
                      key={i}
                      className="p-3 bg-gray-900 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors"
                      onClick={() => jumpTo(ch.startTime)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="timestamp-link">{ch.startTime}</span>
                        <span className="font-medium">{ch.title}</span>
                      </div>
                      <p className="text-sm text-gray-400">{ch.summary}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Key Points */}
            {summary.keyPoints.length > 0 && (
              <section>
                <h3 className="text-xl font-bold mb-2 text-blue-400">
                  Key Points
                </h3>
                <ul className="space-y-2">
                  {summary.keyPoints.map((kp, i) => (
                    <li key={i} className="flex gap-2 text-gray-300">
                      <span
                        className="timestamp-link shrink-0"
                        onClick={() => jumpTo(kp.timestamp)}
                      >
                        [{kp.timestamp}]
                      </span>
                      <span>{kp.point}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Highlights */}
            {summary.highlights.length > 0 && (
              <section>
                <h3 className="text-xl font-bold mb-2 text-blue-400">
                  Highlights
                </h3>
                <div className="space-y-3">
                  {summary.highlights.map((h, i) => (
                    <blockquote
                      key={i}
                      className="pl-4 border-l-2 border-blue-500"
                    >
                      <p className="text-gray-300 italic">
                        &ldquo;{h.quote}&rdquo;
                      </p>
                      <span
                        className="timestamp-link"
                        onClick={() => jumpTo(h.timestamp)}
                      >
                        [{h.timestamp}]
                      </span>
                      <p className="text-sm text-gray-400 mt-1">{h.context}</p>
                    </blockquote>
                  ))}
                </div>
              </section>
            )}

            {/* Facts */}
            {summary.facts.length > 0 && (
              <section>
                <h3 className="text-xl font-bold mb-2 text-blue-400">Facts</h3>
                <ul className="space-y-2">
                  {summary.facts.map((f, i) => (
                    <li key={i} className="flex gap-2 text-gray-300">
                      <span
                        className="timestamp-link shrink-0"
                        onClick={() => jumpTo(f.timestamp)}
                      >
                        [{f.timestamp}]
                      </span>
                      <span>{f.fact}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Action Items */}
            {summary.actionItems.length > 0 && (
              <section>
                <h3 className="text-xl font-bold mb-2 text-blue-400">
                  Action Items
                </h3>
                <ul className="space-y-2">
                  {summary.actionItems.map((a, i) => (
                    <li key={i} className="flex gap-2 text-gray-300">
                      <span className="text-green-400 shrink-0">☐</span>
                      <span
                        className="timestamp-link shrink-0"
                        onClick={() => jumpTo(a.timestamp)}
                      >
                        [{a.timestamp}]
                      </span>
                      <span>{a.action}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
