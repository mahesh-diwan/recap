"use client";

import { useState, useRef, useCallback } from "react";
import type { SummaryJSON } from "@/lib/prompts";

interface Chapter {
  title: string;
  startTime: string;
  startSeconds: number;
  summary: string;
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

  const jumpTo = useCallback(
    (timestamp: string) => {
      if (!playerRef.current) return;
      const seconds = parseTimestampToSeconds(timestamp);
      playerRef.current.src = `https://www.youtube.com/embed/${videoId}?start=${seconds}&autoplay=1`;
    },
    [videoId]
  );

  const handleSummarize = async () => {
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setSummary(null);
    setMarkdown("");

    try {
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

  const handleReset = () => {
    setUrl("");
    setVideoId(null);
    setTitle("");
    setSummary(null);
    setMarkdown("");
    setError(null);
  };

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#3b82f8] opacity-[0.04] blur-[150px] rounded-full"></div>
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[300px] bg-[#1e3a5f] opacity-[0.06] blur-[100px] rounded-full"></div>
      </div>

      {/* Header */}
      <div className="text-center mb-10 pb-6 border-b border-gray-800/60">
        <h1 className="text-4xl font-bold mb-3 tracking-tight bg-gradient-to-r from-[#3b82f8] via-[#60a5fa] to-[#3b82f8] bg-clip-text text-transparent">
          YouTube Summarizer
        </h1>
        <p className="text-gray-400 text-sm">
          Paste a YouTube URL and get AI-powered insights in seconds
        </p>
      </div>

      {/* URL Input */}
      <div className="flex gap-3 mb-10 max-w-3xl mx-auto">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste YouTube URL here..."
          className="flex-1 px-5 py-3 bg-[#0d0d0d] border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-[#3b82f8] focus:ring-1 focus:ring-[#3b82f8]/30 font-mono rounded-lg transition-colors"
          disabled={loading}
        />
        <button
          onClick={handleSummarize}
          disabled={loading || !url.trim()}
          className="px-8 py-3 bg-[#3b82f8] hover:bg-[#60a5fa] hover:text-black disabled:bg-gray-800 disabled:cursor-not-allowed text-black font-bold uppercase tracking-wider border border-[#3b82f8] hover:border-[#60a5fa] rounded-lg transition-all shadow-lg shadow-[#3b82f8]/10 hover:shadow-[#3b82f8]/20"
        >
          {loading ? "Processing..." : "Summarize"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-8 p-4 border border-red-900/60 bg-red-950/30 text-red-400 max-w-3xl mx-auto font-mono rounded-lg">
          ERROR: {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-16">
          <p className="text-[#3b82f8] font-bold text-lg font-mono tracking-wider">
            &gt;&gt;&gt; PROCESSING...
          </p>
          <p className="text-gray-500 mt-3 text-sm">
            Fetching transcript and generating summary
          </p>
        </div>
      )}

      {/* Side-by-side view */}
      {videoId && summary && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Video Player */}
          <div className="space-y-4">
            <div className="aspect-video bg-[#0a0a0a] overflow-hidden border border-gray-800 rounded-xl shadow-2xl shadow-black/40">
              <iframe
                ref={playerRef}
                src={`https://www.youtube.com/embed/${videoId}`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <h2 className="text-base font-bold text-gray-300 uppercase tracking-wider line-clamp-2">
              {title}
            </h2>
          </div>

          {/* Right: Summary Panel */}
          <div className="space-y-5 max-h-[calc(100vh-220px)] overflow-y-auto pr-1 scroll-smooth">
            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleDownload}
                className="flex-1 px-4 py-2.5 bg-[#1a1a2e] hover:bg-[#3b82f8] hover:text-black text-gray-300 font-bold uppercase tracking-wider border border-gray-700 hover:border-[#3b82f8] rounded-lg transition-all text-sm shadow-md shadow-black/20 hover:shadow-lg hover:shadow-[#3b82f8]/10"
              >
                Download Report
              </button>
              <button
                onClick={handleReset}
                className="flex-1 px-4 py-2.5 bg-[#1a1a2e] hover:bg-gray-800 text-gray-400 hover:text-white font-bold uppercase tracking-wider border border-gray-700 rounded-lg transition-all text-sm"
              >
                Reset
              </button>
            </div>

            {/* TL;DR */}
            <section className="border border-gray-800 bg-[#111111] rounded-xl p-5 shadow-lg shadow-black/20">
              <h3 className="text-lg font-bold mb-3 text-[#60a5fa] uppercase tracking-wider border-b border-gray-800 pb-3">
                TL;DR
              </h3>
              <p className="text-gray-300 leading-relaxed font-mono text-sm">
                {summary.tldr}
              </p>
            </section>

            {/* Chapters */}
            {summary.chapters.length > 0 && (
              <section className="border border-gray-800 bg-[#111111] rounded-xl p-5 shadow-lg shadow-black/20">
                <h3 className="text-lg font-bold mb-4 text-[#60a5fa] uppercase tracking-wider border-b border-gray-800 pb-3">
                  Chapters
                </h3>
                <div className="space-y-2">
                  {summary.chapters.map((ch, i) => (
                    <div
                      key={i}
                      className="p-3 bg-[#0a0a0a] hover:bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-lg cursor-pointer transition-colors"
                      onClick={() => jumpTo(ch.startTime)}
                    >
                      <div className="flex items-center gap-3 mb-1">
                        <span className="timestamp-link text-xs">{ch.startTime}</span>
                        <span className="font-bold text-gray-200 text-sm">{ch.title}</span>
                      </div>
                      <p className="text-xs text-gray-500 font-mono mt-1">
                        {ch.summary}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Key Points */}
            {summary.keyPoints.length > 0 && (
              <section className="border border-gray-800 bg-[#111111] rounded-xl p-5 shadow-lg shadow-black/20">
                <h3 className="text-lg font-bold mb-4 text-[#60a5fa] uppercase tracking-wider border-b border-gray-800 pb-3">
                  Key Points
                </h3>
                <ul className="space-y-3">
                  {summary.keyPoints.map((kp, i) => (
                    <li key={i} className="flex gap-3 text-gray-300 font-mono text-sm">
                      <span className="text-[#3b82f8] shrink-0 mt-0.5">&#9654;</span>
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
              <section className="border border-gray-800 bg-[#111111] rounded-xl p-5 shadow-lg shadow-black/20">
                <h3 className="text-lg font-bold mb-4 text-[#60a5fa] uppercase tracking-wider border-b border-gray-800 pb-3">
                  Highlights
                </h3>
                <div className="space-y-4">
                  {summary.highlights.map((h, i) => (
                    <blockquote
                      key={i}
                      className="pl-4 border-l-2 border-[#3b82f8] rounded-r-md"
                    >
                      <p className="text-gray-300 font-mono text-sm italic">
                        &ldquo;{h.quote}&rdquo;
                      </p>
                      <span
                        className="timestamp-link text-xs"
                        onClick={() => jumpTo(h.timestamp)}
                      >
                        [{h.timestamp}]
                      </span>
                      <p className="text-xs text-gray-600 mt-1 font-mono">
                        {h.context}
                      </p>
                    </blockquote>
                  ))}
                </div>
              </section>
            )}

            {/* Facts */}
            {summary.facts.length > 0 && (
              <section className="border border-gray-800 bg-[#111111] rounded-xl p-5 shadow-lg shadow-black/20">
                <h3 className="text-lg font-bold mb-4 text-[#60a5fa] uppercase tracking-wider border-b border-gray-800 pb-3">
                  Facts
                </h3>
                <ul className="space-y-3">
                  {summary.facts.map((f, i) => (
                    <li key={i} className="flex gap-3 text-gray-300 font-mono text-sm">
                      <span className="text-[#3b82f8] shrink-0 font-bold">{i + 1}.</span>
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
              <section className="border border-gray-800 bg-[#111111] rounded-xl p-5 shadow-lg shadow-black/20">
                <h3 className="text-lg font-bold mb-4 text-[#60a5fa] uppercase tracking-wider border-b border-gray-800 pb-3">
                  Action Items
                </h3>
                <ul className="space-y-3">
                  {summary.actionItems.map((a, i) => (
                    <li key={i} className="flex gap-3 text-gray-300 font-mono text-sm">
                      <span className="text-[#3b82f8] shrink-0 mt-0.5">&#9744;</span>
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