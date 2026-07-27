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
    <div className="min-h-screen scanline-overlay relative p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-[#0a1e3d] opacity-[0.03] blur-[200px] rounded-full"></div>
        <div className="absolute bottom-0 left-1/4 w-[600px] h-[400px] bg-[#ffb800] opacity-[0.01] blur-[150px] rounded-full"></div>
        <div className="absolute top-1/3 right-0 w-[400px] h-[400px] bg-[#00d4aa] opacity-[0.008] blur-[160px] rounded-full"></div>
        <div className="scan-line"></div>
      </div>

      <div className="relative z-10">
        <header className="mb-8 sm:mb-10 pb-4 sm:pb-6 border-b border-[#1a2a3a] flex items-center gap-3 sm:gap-4">
          <div className="relative">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded bg-gradient-to-br from-[#00d4aa] to-[#008866] flex items-center justify-center text-black font-bold text-lg sm:text-xl shadow-lg shadow-[#00d4aa]/20 bat-pulse">
              B
            </div>
            <div className="absolute -inset-1 rounded bg-[#00d4aa] opacity-[0.06] blur-md"></div>
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight font-['Outfit'] text-[#e8ecf0] truncate">
              YOUTUBE SUMMARIZER
            </h1>
            <p className="text-[10px] sm:text-xs text-[#4a6a7a] mt-0.5 font-mono tracking-[0.2em] truncate">
              VIDEO INTELLIGENCE INTERFACE v2.1
            </p>
          </div>
        </header>

        <div className="mb-6 sm:mb-8 max-w-3xl mx-auto">
          <div className="terminal-border p-1 flex gap-2 sm:gap-3">
            <span className="text-[#00d4aa] text-xs sm:text-sm font-mono px-2 sm:px-3 py-2 sm:py-3 border-r border-[#1a2a3a] shrink-0 flex items-center">
              &gt;_
            </span>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste YouTube URL and press ENTER"
              className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-transparent text-[#e8ecf0] placeholder-[#3a4a5a] focus:outline-none font-mono text-sm border-none min-w-0"
              disabled={loading}
            />
            <button
              onClick={handleSummarize}
              disabled={loading || !url.trim()}
              className="px-4 sm:px-6 py-2 sm:py-3 bg-[#00d4aa] hover:bg-[#00ffaa] hover:text-black disabled:bg-[#1a2a3a] disabled:text-[#3a4a5a] disabled:cursor-not-allowed text-black font-bold uppercase tracking-wider text-xs sm:text-sm font-mono transition-all rounded shadow-lg shadow-[#00d4aa]/10 shrink-0 whitespace-nowrap"
            >
              {loading ? "ANALYZING" : "EXECUTE"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 sm:mb-8 p-3 sm:p-4 border border-[#ff3355]/40 bg-[#ff3355]/5 text-[#ff6688] max-w-3xl mx-auto font-mono text-sm flex items-start gap-3 rounded glow-red">
            <span className="text-[#ffb800] text-base leading-none mt-0.5 shrink-0">&#9888;</span>
            <div>
              <div className="text-[#ffb800] text-[10px] sm:text-xs uppercase tracking-wider mb-1 font-bold">ALERT</div>
              <span className="text-[#ff8899] break-words">{error}</span>
            </div>
          </div>
        )}

        {loading && (
          <div className="text-center py-12 sm:py-20">
            <div className="inline-block">
              <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 sm:mb-6 border-2 border-[#1a2a3a] border-t-[#00d4aa] rounded-full animate-spin"></div>
              <p className="text-[#00d4aa] font-bold text-sm sm:text-lg font-mono tracking-widest phosphor">
                &gt; SCANNING FEED...
              </p>
              <p className="text-[#3a4a5a] mt-2 sm:mt-3 text-xs sm:text-sm font-mono">
                Extracting transcript &amp; generating intelligence
              </p>
              <div className="mt-4 sm:mt-6 w-48 sm:w-64 h-1 bg-[#1a2a3a] rounded-full overflow-hidden mx-auto">
                <div className="h-full rounded-full progress-animated" style={{ width: "60%" }}></div>
              </div>
            </div>
          </div>
        )}

        {videoId && summary && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-3 sm:space-y-4 min-w-0">
              <div className="aspect-video bg-[#060a10] overflow-hidden border border-[#1a2a3a] rounded-lg sm:rounded-xl shadow-2xl shadow-black/60 relative glow-cyan vhs-noise">
                <iframe
                  ref={playerRef}
                  src={`https://www.youtube.com/embed/${videoId}`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <div className="flex items-start gap-3 bg-[#0a0e14] border border-[#1a2a3a] rounded-lg p-3 sm:p-4">
                <div className="w-1 h-full min-h-[40px] sm:min-h-[48px] bg-[#00d4aa] rounded-full shrink-0 opacity-60"></div>
                <h2 className="text-sm sm:text-base font-bold text-[#e8ecf0] uppercase tracking-wide font-['Outfit'] line-clamp-3">
                  {title}
                </h2>
              </div>
            </div>

            <div className="space-y-3 sm:space-y-4 max-h-[calc(100vh-200px)] sm:max-h-[calc(100vh-220px)] overflow-y-auto pr-1 scroll-smooth">
              <div className="flex gap-2 sm:gap-3">
                <button
                  onClick={handleDownload}
                  className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-[#0f1520] hover:bg-[#111923] text-[#00d4aa] font-bold uppercase tracking-wider border border-[#1a2a3a] hover:border-[#00d4aa]/40 rounded-lg transition-all text-[10px] sm:text-xs font-mono shadow-md shadow-black/20 min-h-[36px] sm:min-h-[42px]"
                >
                  &#8615; EXPORT MD
                </button>
                <button
                  onClick={handleReset}
                  className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-[#0f1520] hover:bg-[#1a2a3a] text-[#4a6a7a] hover:text-[#c8cdd4] font-bold uppercase tracking-wider border border-[#1a2a3a] rounded-lg transition-all text-[10px] sm:text-xs font-mono min-h-[36px] sm:min-h-[42px]"
                >
                  RESET
                </button>
              </div>

              <section className="panel glow-cyan vhs-noise">
                <h3 className="section-label">TL;DR</h3>
                <p className="text-[#c8cdd4] leading-relaxed font-mono text-sm sm:text-base break-words">
                  {summary.tldr}
                </p>
              </section>

              {summary.chapters.length > 0 && (
                <section className="panel">
                  <h3 className="section-label">CHAPTERS</h3>
                  <div className="space-y-1">
                    {summary.chapters.map((ch, i) => (
                      <div
                        key={i}
                        className="p-2 sm:p-3 bg-[#060a10] hover:bg-[#0f1520] border border-[#1a2a3a] hover:border-[#00d4aa]/30 rounded-lg cursor-pointer transition-colors flex items-start gap-3 group min-h-[44px]"
                        onClick={() => jumpTo(ch.startTime)}
                      >
                        <span className="text-[#00d4aa] text-[10px] sm:text-xs font-mono mt-0.5 shrink-0 opacity-60 group-hover:opacity-100">
                          [{ch.startTime}]
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[#e8ecf0] text-xs sm:text-sm font-bold truncate">{ch.title}</div>
                          <p className="text-[#3a5a6a] text-[10px] sm:text-xs font-mono mt-0.5 line-clamp-2">{ch.summary}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {summary.keyPoints.length > 0 && (
                <section className="panel">
                  <h3 className="section-label">KEY POINTS</h3>
                  <ul className="space-y-2 sm:space-y-3">
                    {summary.keyPoints.map((kp, i) => (
                      <li key={i} className="flex gap-2 sm:gap-3 text-[#c8cdd4] font-mono text-xs sm:text-sm break-words min-h-[36px]">
                        <span className="text-[#00d4aa] shrink-0 mt-1 text-sm">&#9656;</span>
                        <span
                          className="timestamp-link shrink-0 text-[10px] sm:text-xs"
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

              {summary.highlights.length > 0 && (
                <section className="panel glow-amber">
                  <h3 className="section-label section-label-amber">HIGHLIGHTS</h3>
                  <div className="space-y-3 sm:space-y-4">
                    {summary.highlights.map((h, i) => (
                      <blockquote
                        key={i}
                        className="pl-3 sm:pl-4 border-l-2 border-[#ffb800] rounded-r-md"
                      >
                        <p className="text-[#c8cdd4] font-mono text-xs sm:text-sm italic break-words">
                          &ldquo;{h.quote}&rdquo;
                        </p>
                        <div className="flex items-center gap-2 sm:gap-3 mt-1.5 sm:mt-2 flex-wrap">
                          <span
                            className="timestamp-link text-[10px] sm:text-xs"
                            onClick={() => jumpTo(h.timestamp)}
                          >
                            [{h.timestamp}]
                          </span>
                          <span className="text-[#3a5a6a] text-[10px] sm:text-xs font-mono">{h.context}</span>
                        </div>
                      </blockquote>
                    ))}
                  </div>
                </section>
              )}

              {summary.facts.length > 0 && (
                <section className="panel">
                  <h3 className="section-label">FACTS</h3>
                  <ul className="space-y-2 sm:space-y-3">
                    {summary.facts.map((f, i) => (
                      <li key={i} className="flex gap-2 sm:gap-3 text-[#c8cdd4] font-mono text-xs sm:text-sm break-words min-h-[36px]">
                        <span className="text-[#ffb800] shrink-0 font-bold text-[10px] sm:text-xs mt-0.5">{i + 1}.</span>
                        <span
                          className="timestamp-link shrink-0 text-[10px] sm:text-xs"
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

              {summary.actionItems.length > 0 && (
                <section className="panel">
                  <h3 className="section-label">ACTION ITEMS</h3>
                  <ul className="space-y-2 sm:space-y-3">
                    {summary.actionItems.map((a, i) => (
                      <li key={i} className="flex gap-2 sm:gap-3 text-[#c8cdd4] font-mono text-xs sm:text-sm break-words min-h-[36px]">
                        <span className="text-[#ffb800] shrink-0 mt-0.5 text-sm">&#9744;</span>
                        <span
                          className="timestamp-link shrink-0 text-[10px] sm:text-xs"
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
    </div>
  );
}