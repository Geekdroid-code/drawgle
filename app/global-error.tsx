"use client";

import { useEffect } from "react";

// Replaces the root layout when the layout itself crashes, so it cannot lean on
// the app's stylesheet or fonts: everything it needs is inline.
const styles = {
  body: {
    margin: 0,
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    textAlign: "center",
    background: "#ffffff",
    color: "#141414",
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  },
  eyebrow: {
    margin: 0,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: "#a3a3a3",
  },
  title: {
    margin: "16px 0 0",
    fontSize: 36,
    fontWeight: 500,
    lineHeight: 1.1,
    letterSpacing: "-0.03em",
    color: "#1e1e1e",
  },
  accent: { fontWeight: 600, color: "#305dde" },
  description: { maxWidth: 380, margin: "12px 0 0", fontSize: 14, lineHeight: 1.6, color: "#454545" },
  actions: { display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap", justifyContent: "center" },
  primary: {
    height: 40,
    padding: "0 20px",
    border: 0,
    borderRadius: 999,
    background: "#305dde",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  secondary: {
    display: "inline-flex",
    alignItems: "center",
    height: 40,
    padding: "0 20px",
    borderRadius: 999,
    background: "rgba(0, 0, 0, 0.05)",
    color: "#141414",
    fontSize: 14,
    fontWeight: 600,
    textDecoration: "none",
  },
  reference: { margin: "32px 0 0", fontSize: 11, color: "#a3a3a3", fontFamily: "ui-monospace, Consolas, monospace" },
} satisfies Record<string, React.CSSProperties>;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled root error", error);
  }, [error]);

  return (
    <html lang="en">
      <head>
        <title>Something went wrong | Drawgle</title>
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body style={styles.body}>
        <p style={styles.eyebrow}>Error</p>
        <h1 style={styles.title}>
          Something went wrong
          <br />
          <span style={styles.accent}>on our side.</span>
        </h1>
        <p style={styles.description}>
          Drawgle hit an unexpected error. Try again, and if it keeps happening, email support@drawgle.com.
        </p>
        <div style={styles.actions}>
          <button type="button" style={styles.primary} onClick={reset}>
            Try again
          </button>
          {/* A plain anchor: the router may be what failed. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" style={styles.secondary}>
            Back to Drawgle
          </a>
        </div>
        {error.digest ? <p style={styles.reference}>Reference {error.digest}</p> : null}
      </body>
    </html>
  );
}
