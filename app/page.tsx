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
      {/* Glow background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#3b82f8] opacity-[0.03] blur-[120px] rounded-full"></div>
      </div>

      {/* Header */}
       <div className="text-center mb-8 pb-6 border-b-3 border-gray-800 rounded-b-xl">
         <h1 className="text-3xl font-bold mb-2 uppercase tracking-wider bg-gradient-to-r from-[#3b82f8] to-[#60a5fa] bg-clip-text text-transparent">
           YouTube Summarizer
         </h1>
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
          className="flex-1 px-4 py-3 bg-transparent border-3 border-white text-white placeholder-gray-600 focus:outline-none focus:border-[#3b82f8] font-mono rounded-lg"
          style={{ borderWidth: "3px" }}
          disabled={loading}
        />
        <button
          onClick={handleSummarize}
          disabled={loading || !url.trim()}
          className="px-6 py-3 bg-[#3b82f8] hover:bg-[#60a5fa] hover:text-black disabled:bg-gray-700 disabled:cursor-not-allowed text-black font-bold uppercase tracking-wider border-3 border-white rounded-lg"
          style={{ borderWidth: "3px" }}
        >
          {loading ? "[...]" : "Summarize"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          className="mb-8 p-4 border-3 border-red-600 text-red-400 max-w-3xl mx-auto font-mono rounded-lg"
          style={{ borderWidth: "3px" }}
        >
          ERROR: {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div           className="text-center py-12">
          <p className="text-[#3b82f8] font-bold text-lg font-mono">
            &gt;&gt;&gt; PROCESSING...
          </p>
          <p className="text-gray-500 mt-2 text-sm">
            Fetching transcript and generating summary
          </p>
        </div>
      )}

      {/* Side-by-side view */}
      {videoId && summary && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Video Player */}
          <div>
            <div
               className="aspect-video bg-black overflow-hidden border-3 border-white rounded-xl"
               style={{ borderWidth: "3px" }}
             >
               <iframe
                 ref={playerRef}
                 src={`https://www.youtube.com/embed/${videoId}`}
                 className="w-full h-full rounded-xl"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <h2 className="mt-3 text-lg font-bold uppercase tracking-wider">
              {title}
            </h2>
          </div>

          {/* Right: Summary Panel */}
          <div className="space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
            {/* Download Button */}
             <button
               onClick={handleDownload}
               className="w-full px-4 py-2 bg-transparent hover:bg-[#3b82f8] hover:text-black text-white font-bold uppercase tracking-wider border-3 border-white rounded-lg"
              style={{ borderWidth: "3px" }}
            >
              Download Report (.md)
            </button>

            {/* Reset Button */}
             <button
               onClick={handleReset}
               className="w-full px-4 py-2 bg-transparent hover:bg-[#3b82f8] hover:text-black text-white font-bold uppercase tracking-wider border-3 border-gray-600 rounded-lg"
              style={{ borderWidth: "3px" }}
            >
              Summarize Another Video
            </button>

             {/* TL;DR */}
             <section
               className="border-3 border-white p-4 bg-[#111] rounded-xl"
               style={{ borderWidth: "3px" }}
             >
               <h3 className="text-xl font-bold mb-2 text-[#3b82f8] uppercase tracking-wider border-b-3 border-white pb-2" style={{ borderWidth: "3px" }}>
                TL;DR
              </h3>
              <p className="text-gray-300 leading-relaxed font-mono">
                {summary.tldr}
              </p>
            </section>

            {/* Chapters */}
            {summary.chapters.length > 0 && (
              <section>
               <h3 className="text-xl font-bold mb-2 text-[#3b82f8] uppercase tracking-wider border-b-3 border-white pb-2" style={{ borderWidth: "3px" }}>
                 Chapters
               </h3>
               <div className="space-y-2">
                 {summary.chapters.map((ch, i) => (
                   <div
                     key={i}
                     className="p-3 bg-black cursor-pointer hover:bg-gray-900 border-3 border-gray-700 rounded-lg"
                     style={{ borderWidth: "3px" }}
                      onClick={() => jumpTo(ch.startTime)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="timestamp-link">{ch.startTime}</span>
                        <span className="font-bold">{ch.title}</span>
                      </div>
                      <p className="text-sm text-gray-400 font-mono">
                        {ch.summary}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

               {/* Key Points */}
             {summary.keyPoints.length > 0 && (
               <section className="border-3 border-white p-4 bg-[#111] rounded-xl" style={{ borderWidth: "3px" }}>
                 <h3 className="text-xl font-bold mb-2 text-[#3b82f8] uppercase tracking-wider border-b-3 border-white pb-2" style={{ borderWidth: "3px" }}>
                   Key Points
                 </h3>
                 <ul className="space-y-2">
                   {summary.keyPoints.map((kp, i) => (
                     <li key={i} className="flex gap-2 text-gray-300 font-mono">
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
               <section className="border-3 border-white p-4 bg-[#111] rounded-xl" style={{ borderWidth: "3px" }}>
                 <h3 className="text-xl font-bold mb-2 text-[#3b82f8] uppercase tracking-wider border-b-3 border-white pb-2" style={{ borderWidth: "3px" }}>
                   Highlights
                 </h3>
                 <div className="space-y-3">
                   {summary.highlights.map((h, i) => (
                     <blockquote
                       key={i}
                       className="pl-4 border-l-3 border-[#3b82f8] rounded-r-lg"
                       style={{ borderLeftWidth: "3px" }}
                     >
                      <p className="text-gray-300 font-mono">
                        &ldquo;{h.quote}&rdquo;
                      </p>
                      <span
                        className="timestamp-link"
                        onClick={() => jumpTo(h.timestamp)}
                      >
                        [{h.timestamp}]
                      </span>
                      <p className="text-sm text-gray-500 mt-1 font-mono">
                        {h.context}
                      </p>
                    </blockquote>
                  ))}
                </div>
              </section>
            )}

               {/* Facts */}
             {summary.facts.length > 0 && (
               <section className="border-3 border-white p-4 bg-[#111] rounded-xl" style={{ borderWidth: "3px" }}>
                 <h3 className="text-xl font-bold mb-2 text-[#3b82f8] uppercase tracking-wider border-b-3 border-white pb-2" style={{ borderWidth: "3px" }}>
                   Facts
                 </h3>
                 <ul className="space-y-2">
                   {summary.facts.map((f, i) => (
                     <li key={i} className="flex gap-2 text-gray-300 font-mono">
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
               <section className="border-3 border-white p-4 bg-[#111] rounded-xl" style={{ borderWidth: "3px" }}>
                 <h3 className="text-xl font-bold mb-2 text-[#3b82f8] uppercase tracking-wider border-b-3 border-white pb-2" style={{ borderWidth: "3px" }}>
                   Action Items
                 </h3>
                 <ul className="space-y-2">
                   {summary.actionItems.map((a, i) => (
                     <li key={i} className="flex gap-2 text-gray-300 font-mono">
                       <span className="text-[#3b82f8] shrink-0">☐</span>
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
