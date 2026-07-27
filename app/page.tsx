"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, useReducedMotion, stagger } from "motion/react";
import type { SummaryJSON } from "@/lib/prompts";

function parseTimestampToSeconds(ts: string): number {
  const parts = ts.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return parts[0] * 60 + parts[1];
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
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
  const reduceMotion = useReducedMotion();

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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
    },
  };

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-7xl mx-auto">
      {/* Ambient glow - subtle */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#3b82f6] opacity-[0.03] blur-[120px] rounded-full" />
        <div className="absolute bottom-0 left-1/4 w-[300px] h-[200px] bg-[#1e3a5f] opacity-[0.04] blur-[80px] rounded-full" />
      </div>

      {/* Header - Asymmetric layout (no center bias) */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="mb-12 lg:mb-16"
      >
        <div className="max-w-3xl">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-none mb-4 bg-gradient-to-r from-[#3b82f6] via-[#60a5fa] to-[#93c5fd] bg-clip-text text-transparent">
            YouTube Summarizer
          </h1>
          <p className="text-lg text-zinc-400 max-w-[50ch] leading-relaxed">
            Paste any YouTube URL. Get structured AI insights with timestamps — TL;DR, chapters, key points, highlights, facts, and action items.
          </p>
        </div>
      </motion.div>

      {/* URL Input - Split layout */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        className="mb-10 lg:mb-14"
      >
        <div className="flex gap-3 max-w-3xl">
          <label htmlFor="url-input" className="sr-only">
            YouTube URL
          </label>
          <input
            id="url-input"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://youtube.com/watch?v=..."
            className="flex-1 px-5 py-4 bg-zinc-950/80 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 font-mono text-base rounded-lg transition-all hover:border-zinc-700"
            disabled={loading}
            autoComplete="off"
            autoFocus
          />
          <motion.button
            onClick={handleSummarize}
            disabled={loading || !url.trim()}
            whileHover={reduceMotion ? undefined : { scale: 1.02 }}
            whileTap={reduceMotion ? undefined : { scale: 0.98 }}
            className="px-8 py-4 bg-accent hover:bg-accent-hover hover:text-black disabled:bg-zinc-800 disabled:cursor-not-allowed disabled:hover:bg-zinc-800 disabled:text-zinc-500 text-black font-bold uppercase tracking-wider border border-accent hover:border-accent-hover rounded-lg transition-all shadow-lg shadow-accent/10 hover:shadow-accent/20 min-w-[160px]"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full"
                />
                Processing...
              </span>
            ) : (
              "Summarize"
            )}
          </motion.button>
        </div>
      </motion.div>

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 max-w-3xl mx-auto p-4 border border-red-900/60 bg-red-950/30 text-red-400 font-mono text-sm rounded-lg"
          role="alert"
        >
          ERROR: {error}
        </motion.div>
      )}

      {/* Loading State - Skeletal */}
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4 max-w-3xl mx-auto"
        >
          <div className="skeleton h-48 rounded-xl" />
          <div className="skeleton h-32 rounded-xl" />
          <div className="skeleton h-32 rounded-xl" />
          <div className="skeleton h-32 rounded-xl" />
          <div className="skeleton h-32 rounded-xl" />
          <div className="skeleton h-32 rounded-xl" />
          <div className="skeleton h-32 rounded-xl" />
        </motion.div>
      )}

      {/* Side-by-side view */}
      {videoId && summary && (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-8"
        >
          {/* Left: Video Player - Media-focused layout */}
          <div className="space-y-4 lg:sticky lg:top-24">
            <div className="aspect-video bg-zinc-950 overflow-hidden border border-zinc-800 rounded-xl shadow-xl shadow-black/30 relative">
              <iframe
                ref={playerRef}
                src={`https://www.youtube.com/embed/${videoId}`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={title}
              />
            </div>
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider line-clamp-2 leading-snug">
              {title}
            </h2>
          </div>

          {/* Right: Summary Panel - Data-dense layout */}
          <div className="space-y-5 max-h-[calc(100vh-200px)] overflow-y-auto pr-2 scroll-smooth">
            {/* Action Bar - Toolbar layout */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="flex gap-3 sticky top-0 z-10 bg-gradient-to-b from-zinc-950/90 to-transparent pb-4 backdrop-blur-sm -mx-2 px-2"
            >
              <motion.button
                variants={itemVariants}
                onClick={handleDownload}
                whileHover={reduceMotion ? undefined : { y: -1 }}
                whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                className="flex-1 px-4 py-2.5 bg-zinc-900/80 hover:bg-accent hover:text-black text-zinc-300 font-semibold uppercase tracking-wider border border-zinc-800 hover:border-accent rounded-lg transition-all text-sm shadow-md shadow-black/20 hover:shadow-lg hover:shadow-accent/10 backdrop-blur-sm"
              >
                Download Report
              </motion.button>
              <motion.button
                variants={itemVariants}
                onClick={handleReset}
                whileHover={reduceMotion ? undefined : { y: -1 }}
                whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                className="flex-1 px-4 py-2.5 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-white font-semibold uppercase tracking-wider border border-zinc-800 rounded-lg transition-all text-sm backdrop-blur-sm"
              >
                New Video
              </motion.button>
            </motion.div>

            {/* TL;DR - Lead paragraph layout (no eyebrow) */}
            <motion.section
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="border border-zinc-800 bg-zinc-950/60 rounded-xl p-6 shadow-lg shadow-black/20 surface-glass"
            >
              <h3 className="text-base font-bold mb-3 text-accent-hover uppercase tracking-wider">
                TL;DR
              </h3>
              <p className="text-zinc-300 leading-relaxed font-mono text-sm">
                {summary.tldr}
              </p>
            </motion.section>

            {/* Chapters - Timeline layout */}
            {summary.chapters.length > 0 && (
              <motion.section
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="border border-zinc-800 bg-zinc-950/60 rounded-xl p-6 shadow-lg shadow-black/20 surface-glass"
              >
                <h3 className="text-base font-bold mb-4 text-accent-hover uppercase tracking-wider">
                  Chapters
                </h3>
                <div className="space-y-2">
                  {summary.chapters.map((ch, i) => (
                    <motion.div
                      key={i}
                      whileHover={reduceMotion ? undefined : { x: 4 }}
                      className="group p-4 bg-zinc-950/50 hover:bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 rounded-lg cursor-pointer transition-all"
                      onClick={() => jumpTo(ch.startTime)}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <span className="timestamp-link text-xs px-2 py-0.5 bg-accent-muted/30 rounded border border-accent-muted/50">
                          {ch.startTime}
                        </span>
                        <span className="font-semibold text-zinc-100 text-sm">{ch.title}</span>
                      </div>
                      <p className="text-xs text-zinc-500 font-mono pl-9">
                        {ch.summary}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            )}

            {/* Key Points - Bullet list layout */}
            {summary.keyPoints.length > 0 && (
              <motion.section
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="bg-zinc-950/60 rounded-xl p-6 shadow-lg shadow-black/20 surface-glass border border-zinc-800"
              >
                <h3 className="text-base font-bold mb-4 text-accent-hover uppercase tracking-wider">
                  Key Points
                </h3>
                <ul className="space-y-3">
                  {summary.keyPoints.map((kp, i) => (
                    <motion.li
                      key={i}
                      whileHover={reduceMotion ? undefined : { x: 4 }}
                      className="flex gap-3 text-zinc-300 font-mono text-sm cursor-pointer group"
                      onClick={() => jumpTo(kp.timestamp)}
                    >
                      <span className="text-accent shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                        ▸
                      </span>
                      <span
                        className="timestamp-link shrink-0 px-2 py-0.5 bg-accent-muted/30 rounded border border-accent-muted/50"
                      >
                        [{kp.timestamp}]
                      </span>
                      <span className="group-hover:text-white transition-colors">{kp.point}</span>
                    </motion.li>
                  ))}
                </ul>
              </motion.section>
            )}

            {/* Highlights - Quote card layout */}
            {summary.highlights.length > 0 && (
              <motion.section
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="bg-zinc-950/60 rounded-xl p-6 shadow-lg shadow-black/20 surface-glass border border-zinc-800"
              >
                <h3 className="text-base font-bold mb-4 text-accent-hover uppercase tracking-wider">
                  Highlights
                </h3>
                <div className="space-y-4">
                  {summary.highlights.map((h, i) => (
                    <motion.blockquote
                      key={i}
                      whileHover={reduceMotion ? undefined : { x: 4 }}
                      className="pl-4 border-l-2 border-accent/50 rounded-r-md bg-zinc-950/50 p-4 hover:border-accent transition-colors"
                    >
                      <p className="text-zinc-200 font-mono text-sm italic leading-relaxed">
                        &ldquo;{h.quote}&rdquo;
                      </p>
                      <div className="flex items-center gap-3 mt-3">
                        <span
                          className="timestamp-link text-xs px-2 py-0.5 bg-accent-muted/30 rounded border border-accent-muted/50"
                        >
                          [{h.timestamp}]
                        </span>
                        <p className="text-xs text-zinc-500 font-mono">
                          {h.context}
                        </p>
                      </div>
                    </motion.blockquote>
                  ))}
                </div>
              </motion.section>
            )}

            {/* Facts - Numbered data layout */}
            {summary.facts.length > 0 && (
              <motion.section
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="bg-zinc-950/60 rounded-xl p-6 shadow-lg shadow-black/20 surface-glass border border-zinc-800"
              >
                <h3 className="text-base font-bold mb-4 text-accent-hover uppercase tracking-wider">
                  Facts
                </h3>
                <ul className="space-y-3">
                  {summary.facts.map((f, i) => (
                    <motion.li
                      key={i}
                      whileHover={reduceMotion ? undefined : { x: 4 }}
                      className="flex gap-3 text-zinc-300 font-mono text-sm cursor-pointer group"
                      onClick={() => jumpTo(f.timestamp)}
                    >
                      <span className="text-accent shrink-0 font-bold w-6 text-right group-hover:scale-110 transition-transform">
                        {i + 1}.
                      </span>
                      <span
                        className="timestamp-link shrink-0 px-2 py-0.5 bg-accent-muted/30 rounded border border-accent-muted/50"
                      >
                        [{f.timestamp}]
                      </span>
                      <span className="group-hover:text-white transition-colors">{f.fact}</span>
                    </motion.li>
                  ))}
                </ul>
              </motion.section>
            )}

            {/* Action Items - Checkbox task layout */}
            {summary.actionItems.length > 0 && (
              <motion.section
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="bg-zinc-950/60 rounded-xl p-6 shadow-lg shadow-black/20 surface-glass border border-zinc-800"
              >
                <h3 className="text-base font-bold mb-4 text-accent-hover uppercase tracking-wider">
                  Action Items
                </h3>
                <ul className="space-y-3">
                  {summary.actionItems.map((a, i) => (
                    <motion.li
                      key={i}
                      whileHover={reduceMotion ? undefined : { x: 4 }}
                      className="flex gap-3 text-zinc-300 font-mono text-sm cursor-pointer group"
                      onClick={() => jumpTo(a.timestamp)}
                    >
                      <span className="text-accent shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                        ☐
                      </span>
                      <span
                        className="timestamp-link shrink-0 px-2 py-0.5 bg-accent-muted/30 rounded border border-accent-muted/50"
                      >
                        [{a.timestamp}]
                      </span>
                      <span className="group-hover:text-white transition-colors">{a.action}</span>
                    </motion.li>
                  ))}
                </ul>
              </motion.section>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}