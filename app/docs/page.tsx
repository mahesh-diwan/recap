"use client";

import { useEffect, useRef } from "react";

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
    <div
      ref={ref}
      className={`reveal ${delay ? `reveal-delay-${delay}` : ""} ${className}`}
    >
      {children}
    </div>
  );
}

const steps = [
  {
    num: "01",
    title: "Input",
    description:
      "Paste any YouTube URL. The app extracts the video ID and fetches metadata — title, thumbnail, and the full transcript.",
    detail: "Uses the youtube-transcript npm package. No API keys, no authentication, no rate limits.",
  },
  {
    num: "02",
    title: "Extract",
    description:
      "The transcript is pulled directly from YouTube's caption system. Timestamps are preserved so every summary point links back to the exact moment in the video.",
    detail: "Supports auto-generated and manual captions. Handles multi-language transcripts.",
  },
  {
    num: "03",
    title: "Process",
    description:
      "The transcript is processed by an open-source language model. A structured prompt instructs the model to produce chapters, key points, highlights, facts, and action items.",
    detail: "Supports Qwen (Alibaba), Llama (Meta), Gemma (Google), Mistral, and more via Ollama. No GPU required.",
  },
  {
    num: "04",
    title: "Output",
    description:
      "You get a structured summary with clickable timestamps. Jump to any point in the video directly from the summary. Export the full summary as Markdown.",
    detail: "JSON structure: tldr, chapters[], keyPoints[], highlights[], facts[], actionItems[]. All with timestamps.",
  },
];

export default function DocsPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      {/* Skip to content */}
      <a
        href="#docs-content"
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
          <a
            href="/"
            className="font-bold no-underline"
            style={{ color: "var(--accent)", fontFamily: "var(--font-display)" }}
            aria-label="Recap home"
          >
            rc
          </a>
          <div className="w-px h-3" style={{ background: "var(--border)" }} aria-hidden="true" />
          <a
            href="/"
            className="no-underline"
            style={{ color: "var(--muted)", padding: "3px 10px", borderRadius: 999 }}
          >
            Home
          </a>
          <span
            style={{
              color: "var(--text)",
              padding: "3px 10px",
              background: "rgba(255,255,255,0.04)",
              borderRadius: 999,
            }}
          >
            How it works
          </span>
          <span className="ml-auto" style={{ color: "var(--muted)", fontSize: 10 }}>
            v2.1
          </span>
        </nav>
      </header>

      {/* Ambient glow */}
      <div
        className="fixed pointer-events-none"
        style={{
          top: -200,
          left: "50%",
          transform: "translateX(-50%)",
          width: 600,
          height: 400,
          background: "radial-gradient(ellipse, rgba(255,183,0,0.04) 0%, transparent 70%)",
          filter: "blur(60px)",
          zIndex: 0,
        }}
        aria-hidden="true"
      />

      {/* Main */}
      <main id="docs-content" className="flex-1 w-full mx-auto relative z-10" style={{ maxWidth: 720, padding: "0 20px" }}>
        {/* Hero */}
        <section style={{ paddingTop: 140, paddingBottom: 48 }}>
          <RevealSection>
            <p
              className="m-0 mb-3"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: "var(--accent)",
              }}
            >
              Documentation
            </p>
          </RevealSection>

          <RevealSection delay={1}>
            <h1
              className="m-0 mb-3"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(2rem, 5vw, 3.25rem)",
                fontWeight: 700,
                lineHeight: 1.1,
                letterSpacing: "-0.03em",
                textWrap: "balance",
              }}
            >
              How Recap Works
            </h1>
          </RevealSection>

          <RevealSection delay={2}>
            <p
              className="m-0"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                color: "var(--muted)",
                maxWidth: 480,
                lineHeight: 1.6,
              }}
            >
              Four steps from URL to structured intelligence. Powered by open-source AI models — no API keys required.
            </p>
          </RevealSection>
        </section>

        {/* Pipeline */}
        <section style={{ paddingBottom: 56 }}>
          <div className="space-y-4">
            {steps.map((step, i) => (
              <RevealSection key={step.num} delay={i + 1}>
                <div className="card p-6">
                  <div className="flex gap-5">
                    {/* Step number */}
                    <div className="shrink-0">
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 28,
                          fontWeight: 700,
                          color: "var(--accent)",
                          opacity: 0.2,
                          lineHeight: 1,
                        }}
                      >
                        {step.num}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="min-w-0">
                      <h2
                        className="m-0 mb-2"
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: 18,
                          fontWeight: 700,
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {step.title}
                      </h2>
                      <p
                        className="m-0 mb-3"
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: 14,
                          lineHeight: 1.6,
                          color: "var(--text)",
                          opacity: 0.85,
                        }}
                      >
                        {step.description}
                      </p>
                      <p
                        className="m-0"
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                          lineHeight: 1.5,
                          color: "var(--muted)",
                        }}
                      >
                        {step.detail}
                      </p>
                    </div>
                  </div>

                  {/* Connector line (not on last step) */}
                  {i < steps.length - 1 && (
                    <div className="mt-5 ml-7">
                      <div
                        style={{
                          width: 1,
                          height: 16,
                          background: "var(--border)",
                        }}
                      />
                      <div
                        style={{
                          width: 0,
                          height: 0,
                          borderLeft: "4px solid transparent",
                          borderRight: "4px solid transparent",
                          borderTop: "5px solid var(--border)",
                          marginLeft: -3,
                        }}
                      />
                    </div>
                  )}
                </div>
              </RevealSection>
            ))}
          </div>
        </section>

        {/* Privacy callout */}
        <RevealSection>
          <section className="mb-16">
            <div
              className="p-6"
              style={{
                background: "var(--surface-1)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div className="flex items-start gap-4">
                <span
                  className="shrink-0 mt-0.5"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 18,
                    color: "var(--accent)",
                  }}
                >
                  &#9889;
                </span>
                <div>
                  <h3
                    className="m-0 mb-2"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 16,
                      fontWeight: 700,
                    }}
                  >
                    Built on open-source models
                  </h3>
                  <p
                    className="m-0"
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: 13,
                      lineHeight: 1.6,
                      color: "var(--muted)",
                    }}
                  >
                    Recap leverages open-source language models like Qwen, Llama, Gemma, and Mistral.
                    No vendor lock-in, no API costs. Community-driven, transparent, and free.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </RevealSection>

        {/* Tech stack */}
        <RevealSection>
          <section className="mb-24">
            <h2
              className="m-0 mb-4"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: "-0.01em",
              }}
            >
              Built with
            </h2>
            <div
              className="grid grid-cols-2 gap-3"
              style={{ maxWidth: 480 }}
            >
              {[
                { name: "Next.js", role: "Framework" },
                { name: "Ollama", role: "Open-source model runtime" },
                { name: "youtube-transcript", role: "Transcript extraction" },
                { name: "TypeScript", role: "Type safety" },
              ].map((tech) => (
                <div
                  key={tech.name}
                  className="p-3"
                  style={{
                    background: "var(--surface-1)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <p
                    className="m-0"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--text)",
                    }}
                  >
                    {tech.name}
                  </p>
                  <p
                    className="m-0"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      color: "var(--muted)",
                      marginTop: 2,
                    }}
                  >
                    {tech.role}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </RevealSection>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid var(--border-subtle)", padding: "24px 0", marginTop: "auto" }}>
        <div
          className="flex justify-between items-center flex-wrap gap-3"
          style={{ maxWidth: 720, margin: "0 auto", padding: "0 20px" }}
        >
          <div className="flex items-center gap-3">
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 14,
                color: "var(--accent)",
                fontWeight: 700,
              }}
            >
              rc
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
              Recap · AI video summaries
            </span>
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>
            v2.1
          </div>
        </div>
      </footer>
    </div>
  );
}
