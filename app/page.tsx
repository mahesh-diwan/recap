"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { SummaryJSON } from "@/lib/prompts";

function parseTimestampToSeconds(ts: string): number {
  const parts = ts.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return parts[0] * 60 + parts[1];
}

function formatTranscript(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function tryParsePartialJson(raw: string): Partial<SummaryJSON> | null {
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    if (!cleaned) return null;
    const parsed = JSON.parse(cleaned);
    return {
      tldr: parsed.tldr || "",
      chapters: parsed.chapters || [],
      keyPoints: parsed.keyPoints || [],
      highlights: parsed.highlights || [],
    };
  } catch {
    return null;
  }
}

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("visible");
          observer.unobserve(el);
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function RevealSection({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useScrollReveal();
  return (
    <div ref={ref} className={`reveal ${delay ? `reveal-delay-${delay}` : ""} ${className}`}>
      {children}
    </div>
  );
}

function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card p-5 mb-4">
      <div className="skeleton skeleton-title" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton skeleton-line" style={{ width: i === lines - 1 ? "55%" : "100%" }} />
      ))}
    </div>
  );
}

function StageProgress({ stages }: { stages: { label: string; status: "pending" | "active" | "done" }[] }) {
  return (
    <div className="mb-6">
      {stages.map((s, i) => (
        <div key={i} className={`stage-step ${s.status}`}>
          <span className="stage-dot" />
          <span>{s.label}</span>
          {s.status === "done" && <span style={{ marginLeft: 4, opacity: 0.5 }}>✓</span>}
        </div>
      ))}
    </div>
  );
}

type Phase = "idle" | "loading-transcript" | "transcript-ready" | "loading-summary" | "done";

export default function Home() {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState<Partial<SummaryJSON> | null>(null);
  const [markdown, setMarkdown] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);
  const [rawJson, setRawJson] = useState("");
  const [stages, setStages] = useState<{ label: string; status: "pending" | "active" | "done" }[]>([
    { label: "Extracting transcript", status: "pending" },
    { label: "Running AI analysis", status: "pending" },
    { label: "Structuring insights", status: "pending" },
  ]);
  const playerRef = useRef<HTMLIFrameElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const jumpTo = useCallback(
    (timestamp: string) => {
      if (!playerRef.current) return;
      const seconds = parseTimestampToSeconds(timestamp);
      playerRef.current.src = `https://www.youtube.com/embed/${videoId}?start=${seconds}&autoplay=1`;
    },
    [videoId]
  );

  const updateStage = (index: number, status: "pending" | "active" | "done") => {
    setStages((prev) => prev.map((s, i) => (i === index ? { ...s, status } : s)));
  };

  const handleSummarize = async () => {
    if (!url.trim()) return;

    // Reset
    setError(null);
    setSummary(null);
    setMarkdown("");
    setRawJson("");
    setShowTranscript(false);
    setPhase("loading-transcript");
    setStages([
      { label: "Extracting transcript", status: "active" },
      { label: "Running AI analysis", status: "pending" },
      { label: "Structuring insights", status: "pending" },
    ]);

    abortRef.current = new AbortController();

    try {
      // Phase 1: Get transcript (fast ~1-2s)
      const transcriptRes = await fetch("/api/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal: abortRef.current.signal,
      });

      if (!transcriptRes.ok) {
        const data = await transcriptRes.json();
        throw new Error(data.error || "Failed to fetch transcript");
      }

      const transcriptData = await transcriptRes.json();
      setVideoId(transcriptData.videoId);
      setTitle(transcriptData.title);
      setTranscript(transcriptData.transcript || "");
      setShowTranscript(true);
      updateStage(0, "done");
      updateStage(1, "active");
      setPhase("transcript-ready");

      // Phase 2: Stream summary
      setPhase("loading-summary");
      const summaryRes = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...transcriptData, stream: true }),
        signal: abortRef.current.signal,
      });

      if (!summaryRes.ok) {
        const data = await summaryRes.json();
        throw new Error(data.error || "Failed to generate summary");
      }

      const reader = summaryRes.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === "token") {
              accumulated += event.content;
              setRawJson(accumulated);

              // Try to parse partial JSON and render completed sections
              const partial = tryParsePartialJson(accumulated);
              if (partial) {
                setSummary(partial);
              }
            } else if (event.type === "done") {
              setSummary(event.summary);
              setMarkdown(event.markdown);
              updateStage(1, "done");
              updateStage(2, "done");
              setPhase("done");
            } else if (event.type === "error") {
              throw new Error(event.error);
            }
          } catch (e: any) {
            if (e.message === "The user aborted a request.") return;
            if (e.message?.includes("abort")) return;
            throw e;
          }
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError" || err.message?.includes("abort")) {
        setPhase("idle");
        return;
      }
      setError(err.message || "Something went wrong");
      setPhase("idle");
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    setPhase("idle");
    setStages((prev) => prev.map((s) => ({ ...s, status: "pending" as const })));
  };

  const handleDemo = async () => {
    setError(null);
    setSummary(null);
    setMarkdown("");
    setRawJson("");
    setPhase("loading-summary");
    setStages([
      { label: "Loading demo", status: "active" },
      { label: "Structuring insights", status: "pending" },
    ]);

    try {
      const res = await fetch("/api/demo");
      if (!res.ok) throw new Error("Failed to load demo");
      const data = await res.json();

      setVideoId(data.videoId);
      setTitle(data.title);
      setSummary(data.summary);
      setMarkdown(data.markdown);
      setShowTranscript(false);
      setStages((prev) => prev.map((s) => ({ ...s, status: "done" as const })));
      setPhase("done");
    } catch (err: any) {
      setError(err.message || "Failed to load demo");
      setPhase("idle");
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
    abortRef.current?.abort();
    setUrl("");
    setVideoId(null);
    setTitle("");
    setTranscript("");
    setSummary(null);
    setMarkdown("");
    setRawJson("");
    setError(null);
    setShowTranscript(false);
    setPhase("idle");
    setStages([
      { label: "Extracting transcript", status: "pending" },
      { label: "Running AI analysis", status: "pending" },
      { label: "Structuring insights", status: "pending" },
    ]);
  };

  const isIdle = phase === "idle";
  const isLoadingTranscript = phase === "loading-transcript";
  const hasTranscript = phase === "transcript-ready" || phase === "loading-summary" || phase === "done";
  const isLoadingSummary = phase === "loading-summary";
  const isDone = phase === "done";

  const transcriptLines = formatTranscript(transcript);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      {/* Skip to content */}
      <a
        href="#main-content"
        className="fixed -left-[9999px] top-0 z-[100] px-4 py-2 font-mono text-sm opacity-0 focus:left-0 focus:opacity-100"
        style={{ color: "#000", background: "var(--accent)" }}
      >
        Skip to content
      </a>

      {/* Floating pill nav */}
      <header className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-full" style={{ maxWidth: 480, padding: "0 20px" }}>
        <nav
          className="flex items-center gap-3 px-4 py-2 font-mono text-xs"
          style={{
            background: "rgba(12, 12, 16, 0.85)",
            backdropFilter: "blur(16px) saturate(1.2)",
            WebkitBackdropFilter: "blur(16px) saturate(1.2)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 999,
          }}
          role="navigation"
          aria-label="Primary"
        >
          <a href="/" className="font-bold no-underline" style={{ color: "var(--accent)", fontFamily: "var(--font-display)" }} aria-label="Recap home">
            rc
          </a>
          <div className="w-px h-3" style={{ background: "var(--border)" }} aria-hidden="true" />
          <span style={{ color: "var(--text)", padding: "3px 10px", background: "rgba(255,255,255,0.04)", borderRadius: 999 }}>Home</span>
          <a href="/docs" className="no-underline" style={{ color: "var(--muted)", padding: "3px 10px", borderRadius: 999 }}>How it works</a>
          <span className="ml-auto" style={{ color: "var(--muted)", fontSize: 10 }}>v2.1</span>
        </nav>
      </header>

      {/* Ambient glow */}
      <div
        className="fixed pointer-events-none"
        style={{ top: -200, left: "50%", transform: "translateX(-50%)", width: 600, height: 400, background: "radial-gradient(ellipse, rgba(255,183,0,0.04) 0%, transparent 70%)", filter: "blur(60px)", zIndex: 0 }}
        aria-hidden="true"
      />

      {/* Main */}
      <main id="main-content" className="flex-1 w-full mx-auto relative z-10" style={{ maxWidth: 720, padding: "0 20px" }}>
        {/* Hero — always visible */}
        <section style={{ paddingTop: 140, paddingBottom: isIdle ? 56 : 32 }}>
          <RevealSection>
            <div style={{ marginBottom: 8 }}>
              <span
                className="inline-block"
                style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--accent)", padding: "3px 10px", background: "rgba(255,183,0,0.06)", border: "1px solid rgba(255,183,0,0.12)", borderRadius: 999 }}
              >
                Open Source · No API Keys
              </span>
            </div>
          </RevealSection>

          <RevealSection delay={1}>
            <h1
              className="m-0 mb-4"
              style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2.75rem, 7vw, 4.5rem)", fontWeight: 700, lineHeight: 1.02, letterSpacing: "-0.04em", textWrap: "balance" }}
            >
              Recap
            </h1>
          </RevealSection>

          <RevealSection delay={2}>
            <p className="m-0 mb-8" style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--muted)", maxWidth: 460, lineHeight: 1.65 }}>
              Paste a URL. Get structured intelligence — chapters, key points, and highlights. Powered by open-source AI models.
            </p>
          </RevealSection>

          <RevealSection delay={3}>
            <form onSubmit={(e) => { e.preventDefault(); handleSummarize(); }} className="flex gap-3">

              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                aria-label="YouTube URL"
                className="flex-1 px-5 py-3.5"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 14, transition: "border-color 0.2s var(--ease-out-quart)" }}
                onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                disabled={!isIdle}
              />
              {isIdle ? (
                <button
                  type="submit"
                  disabled={!url.trim()}
                  className="px-7 py-3.5 font-mono text-sm font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ background: "var(--accent)", border: "1px solid var(--accent)", color: "#000", transition: "all 0.2s var(--ease-out-quart)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(0.97)"; e.currentTarget.style.background = "#ffd060"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.background = "var(--accent)"; }}
                >
                  Summarize
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-6 py-3 font-mono text-xs font-semibold cursor-pointer"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--fail)", color: "var(--fail)", transition: "all 0.2s var(--ease-out-quart)" }}
                >
                  Cancel
                </button>
              )}
            </form>
          </RevealSection>

          <RevealSection delay={4}>
            <div className="text-center">
              <button
                onClick={handleDemo}
                disabled={!isIdle}
                className="font-mono text-xs cursor-pointer disabled:opacity-30"
                style={{ background: "none", border: "none", color: "var(--muted)", padding: "8px 0", textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3 }}
              >
                or try a demo summary
              </button>
            </div>
          </RevealSection>

          {/* Stage progress — visible during loading */}
          {(isLoadingTranscript || isLoadingSummary) && (
            <RevealSection>
              <div className="mt-6">
                <StageProgress stages={stages} />
              </div>
            </RevealSection>
          )}
        </section>

        {/* Error */}
        {error && (
          <div className="mb-8 p-4 flex items-start gap-3" style={{ border: "1px solid var(--fail)", background: "rgba(255,59,59,0.04)" }}>
            <span style={{ color: "var(--accent)", lineHeight: 1, marginTop: 2 }}>&#9888;</span>
            <div>
              <div className="mb-1 font-semibold" style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", letterSpacing: "0.08em" }}>ERROR</div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fail)" }}>{error}</span>
            </div>
          </div>
        )}

        {/* Video embed + summary — appears as soon as transcript is ready */}
        {hasTranscript && videoId && (
          <section style={{ paddingBottom: 32 }}>
            <RevealSection>
              {/* Video — full width */}
              <div className="mb-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border-subtle)", padding: 3, maxWidth: 640 }}>
                <div className="aspect-video" style={{ background: "var(--canvas)" }}>
                  <iframe
                    ref={playerRef}
                    src={`https://www.youtube.com/embed/${videoId}`}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>

              {/* Title + actions — full width */}
              <div className="flex items-start justify-between gap-4 mb-6">
                <h2 className="m-0" style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, lineHeight: 1.4, letterSpacing: "-0.01em" }}>
                  {title}
                </h2>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={handleDownload}
                    disabled={!isDone}
                    className="px-4 py-2 font-mono text-xs font-semibold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--accent)", transition: "all 0.2s var(--ease-out-quart)" }}
                  >
                    &#8595; Export .md
                  </button>
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 font-mono text-xs font-semibold cursor-pointer"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--muted)", transition: "all 0.2s var(--ease-out-quart)" }}
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Summary — full width below */}
              <div>
                {/* Skeleton cards while summary loads */}
                {isLoadingSummary && !summary && (
                  <>
                    <SkeletonCard lines={2} />
                    <SkeletonCard lines={4} />
                    <SkeletonCard lines={3} />
                  </>
                )}

                {/* Progressive summary — renders as JSON is parsed */}
                {summary && (
                  <>
                      {/* TL;DR — hero treatment */}
                      {summary.tldr && (
                        <RevealSection>
                          <div className="mb-5" style={{ borderLeft: "3px solid var(--accent)", background: "rgba(255,183,0,0.04)", padding: "20px 24px" }}>
                            <div className="mb-2.5" style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>TL;DR</div>
                            <p className={`m-0 ${isLoadingSummary ? "streaming-cursor" : ""}`} style={{ fontFamily: "var(--font-body)", fontSize: 16, lineHeight: 1.7, color: "var(--text)" }}>
                              {summary.tldr}
                            </p>
                          </div>
                        </RevealSection>
                      )}

                      {/* Chapters — timeline */}
                      {(summary.chapters?.length ?? 0) > 0 && (
                        <RevealSection delay={1}>
                          <div className="card p-5 mb-4">
                            <h3 className="section-label m-0 mb-3">Chapters</h3>
                            <div style={{ position: "relative", paddingLeft: 16 }}>
                              <div style={{ position: "absolute", left: 3, top: 6, bottom: 6, width: 1, background: "var(--border)" }} />
                              {summary.chapters?.map((ch, i) => (
                                <button
                                  key={i}
                                  className="w-full text-left py-2.5 px-0 cursor-pointer relative"
                                  style={{ background: "transparent", border: "none", color: "var(--text)", display: "block" }}
                                  onClick={() => jumpTo(ch.startTime)}
                                >
                                  <div style={{ position: "absolute", left: -16, top: "50%", transform: "translateY(-50%)", width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", opacity: 0.75, transition: "opacity 0.15s, transform 0.15s" }} />
                                  <div className="flex items-baseline gap-2.5">
                                    <span className="shrink-0 timestamp-link">{ch.startTime}</span>
                                    <span style={{ fontSize: 14, fontWeight: 600 }}>{ch.title}</span>
                                  </div>
                                  <p className="m-0 mt-0.5" style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", marginLeft: 52, lineHeight: 1.5 }}>{ch.summary}</p>
                                </button>
                              ))}
                            </div>
                          </div>
                        </RevealSection>
                      )}

                      {/* Key Points */}
                      {(summary.keyPoints?.length ?? 0) > 0 && (
                        <RevealSection delay={2}>
                          <div className="card p-5 mb-4">
                            <h3 className="section-label m-0 mb-3">Key Points</h3>
                            <ul className="m-0 p-0" style={{ listStyle: "none" }}>
                              {summary.keyPoints?.map((kp, i) => (
                                <li key={i} className="flex gap-3 py-2" style={{ fontSize: 13, lineHeight: 1.55, borderBottom: i < (summary.keyPoints?.length ?? 0) - 1 ? "1px solid var(--border-subtle)" : "none" }}>
                                  <span className="shrink-0 mt-1.5" style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", opacity: 0.5 }} />
                                  <button className="timestamp-link shrink-0">{kp.timestamp}</button>
                                  <span style={{ opacity: 0.9 }}>{kp.point}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </RevealSection>
                      )}

                      {/* Highlights — quotes */}
                      {(summary.highlights?.length ?? 0) > 0 && (
                        <RevealSection delay={3}>
                          <div className="card p-5 mb-4">
                            <h3 className="section-label m-0 mb-3">Highlights</h3>
                            <div className="space-y-5">
                              {summary.highlights?.map((h, i) => (
                                <blockquote key={i} className="m-0" style={{ borderLeft: "3px solid var(--accent)", paddingLeft: 18 }}>
                                  <p className="m-0" style={{ fontSize: 15, fontStyle: "italic", lineHeight: 1.6, color: "var(--text)" }}>&ldquo;{h.quote}&rdquo;</p>
                                  <div className="flex items-center gap-2.5 mt-2.5 flex-wrap">
                                    <button className="timestamp-link" onClick={() => jumpTo(h.timestamp)}>{h.timestamp}</button>
                                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>{h.context}</span>
                                  </div>
                                </blockquote>
                              ))}
                            </div>
                          </div>
                        </RevealSection>
                      )}
                    </>
                  )}

                  {/* Skeletons while streaming (shown if no partial parse yet) */}
                  {isLoadingSummary && summary === null && (
                    <>
                      <SkeletonCard lines={4} />
                      <SkeletonCard lines={3} />
                    </>
                  )}
              </div>
            </RevealSection>
          </section>
        )}

        {/* Transcript — full width below grid */}
        {transcript && (
          <RevealSection>
            <div className="mb-8">
              <button
                onClick={() => setShowTranscript(!showTranscript)}
                className="flex items-center gap-2 cursor-pointer"
                style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", background: "none", border: "none", padding: "4px 0", letterSpacing: "0.06em", textTransform: "uppercase" }}
              >
                <span className="inline-block" style={{ transition: "transform 0.2s var(--ease-out-quart)", transform: showTranscript ? "rotate(90deg)" : "rotate(0deg)" }}>&#9656;</span>
                Raw Transcript ({transcriptLines.length} lines)
              </button>
              {showTranscript && (
                <div className="mt-3 p-4 overflow-y-auto" style={{ maxHeight: 300, background: "var(--surface-1)", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.9 }}>
                    {transcriptLines.map((line, i) => {
                      const match = line.match(/^(\[(\d{2}:\d{2})\])\s*(.*)/);
                      if (match) {
                        return (
                          <div key={i} className="flex gap-3">
                            <span className="shrink-0" style={{ color: "var(--accent)", opacity: 0.4 }}>{match[1]}</span>
                            <span style={{ opacity: 0.85 }}>{match[3]}</span>
                          </div>
                        );
                      }
                      return <div key={i} style={{ color: "var(--muted)" }}>{line}</div>;
                    })}
                  </div>
                </div>
              )}
            </div>
          </RevealSection>
        )}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid var(--border-subtle)", padding: "24px 0", marginTop: "auto" }}>
        <div className="flex justify-between items-center flex-wrap gap-3" style={{ maxWidth: 720, margin: "0 auto", padding: "0 20px" }}>
          <div className="flex items-center gap-3">
            <span style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "var(--accent)", fontWeight: 700 }}>rc</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>Recap · AI video summaries</span>
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>v2.1</div>
        </div>
      </footer>
    </div>
  );
}
