"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function TemplateStarter({ slug, title }: { slug: string; title: string }) {
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const storageKey = `drawgle:template-start:${slug}`;
    const idempotencyKey = sessionStorage.getItem(storageKey) ?? crypto.randomUUID();
    sessionStorage.setItem(storageKey, idempotencyKey);

    void fetch(`/api/templates/${encodeURIComponent(slug)}/instantiate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idempotencyKey }),
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.projectId) throw new Error(payload.error || "Unable to start from this design.");
        router.replace(`/project/${payload.projectId}`);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to start from this design."));
  }, [router, slug]);

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-6">
      <div className="max-w-sm text-center">
        {error ? (
          <>
            <h1 className="text-xl font-semibold">Could not create the project</h1>
            <p className="mt-2 text-sm text-black/50">{error}</p>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-[#1b7fcc]" />
            <h1 className="mt-4 text-xl font-semibold">Preparing {title}</h1>
            <p className="mt-2 text-sm text-black/50">Creating your editable copy. No generation credits are used.</p>
          </>
        )}
      </div>
    </main>
  );
}
