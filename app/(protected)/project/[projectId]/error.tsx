"use client";

import { useEffect } from "react";

export default function ProjectLoadError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Project workspace failed to load", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-950">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Workspace unavailable</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Your screens are still saved.</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Drawgle could not load the project data. Retry the workspace instead of showing an empty canvas.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 min-h-11 rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2"
        >
          Retry workspace
        </button>
      </section>
    </main>
  );
}
