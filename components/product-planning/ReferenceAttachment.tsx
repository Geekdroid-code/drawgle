"use client";
import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import type { ImageReferenceMode, PromptImagePayload } from "@/lib/types";

export function ReferenceAttachment({ image, mode, disabled, screenScoped = false, onChange, onModeChange }: {
  image: PromptImagePayload | null; mode: ImageReferenceMode; disabled?: boolean; screenScoped?: boolean;
  onChange: (image: PromptImagePayload | null) => void; onModeChange: (mode: ImageReferenceMode) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  return <div className="px-2 pt-1">
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => input.current?.click()} disabled={disabled} aria-label="Attach reference image" className="rounded-full p-2 text-[var(--dg-text-muted)] hover:bg-[var(--dg-surface-muted)]"><ImagePlus className="h-4 w-4" /></button>
      <input ref={input} type="file" className="hidden" accept="image/png,image/jpeg,image/webp,image/gif" disabled={disabled} onChange={async (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        if (file.size > 15_000_000) { setError("Choose an image under 15 MB."); return; }
        setError(null);
        const reader = new FileReader();
        reader.onerror = () => setError("Could not read that image.");
        reader.onload = () => onChange({ data: String(reader.result).split(",")[1], mimeType: file.type });
        reader.readAsDataURL(file);
      }} />
      {image && <>
        <span className="text-xs text-[var(--dg-text-muted)]">{screenScoped ? "For this request · keeps project design" : "Reference attached"}</span>
        {!screenScoped && <select aria-label="Reference use" value={mode} disabled={disabled} onChange={(event) => onModeChange(event.target.value as ImageReferenceMode)} className="min-w-0 bg-transparent text-xs">
          <option value="style">Style reference</option><option value="recreate">Recreate screens</option>
        </select>}
        <button type="button" aria-label="Remove reference" disabled={disabled} onClick={() => onChange(null)}><X className="h-3.5 w-3.5" /></button>
      </>}
    </div>
    {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
  </div>;
}
