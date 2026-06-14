"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Download, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildPublicDesignMdDocument } from "@/lib/design-md";
import type { DesignTokens, ProjectData, ProjectNavigationData } from "@/lib/types";

const highlightMarkdownLine = (line: string) => {
  if (line === "---") {
    return <span className="text-slate-500">{line}</span>;
  }

  if (line.startsWith("## ")) {
    return <span className="text-[13px] font-semibold text-amber-200">{line}</span>;
  }

  if (line.startsWith("- ")) {
    return <span><span className="text-emerald-300">-</span><span className="text-slate-200">{line.slice(1)}</span></span>;
  }

  const yamlMatch = line.match(/^(\s*)([A-Za-z0-9_-]+):(\s*)(.*)$/);
  if (yamlMatch) {
    const [, indent, key, gap, value] = yamlMatch;
    return (
      <>
        {indent}
        <span className="text-sky-300">{key}</span>
        <span className="text-slate-500">:</span>
        {gap}
        <span className={value.startsWith("'#") ? "text-rose-200" : "text-emerald-200"}>{value}</span>
      </>
    );
  }

  const inlineParts = line.split(/(`[^`]+`)/g);
  if (inlineParts.length > 1) {
    return (
      <>
        {inlineParts.map((part, index) => part.startsWith("`") && part.endsWith("`")
          ? <span key={`${part}-${index}`} className="rounded bg-white/[0.08] px-1 text-cyan-200">{part}</span>
          : <span key={`${part}-${index}`}>{part}</span>)}
      </>
    );
  }

  return line;
};

function DesignMdCodeView({ value }: { value: string }) {
  const lines = useMemo(() => value.split("\n"), [value]);

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[#05070a] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <pre className="min-h-full w-full py-4 font-mono text-[11px] leading-5 text-slate-200">
        <code>
          {lines.map((line, index) => (
            <div key={`${index}-${line}`} className="grid grid-cols-[42px_minmax(0,1fr)] px-3">
              <span className="select-none pr-3 text-right text-[10px] text-slate-600">{index + 1}</span>
              <span className="min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{highlightMarkdownLine(line)}</span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}

export function DesignMdTab({
  project,
  projectNavigation,
  tokenDraft,
  tokenDirty,
}: {
  project: ProjectData;
  projectNavigation?: ProjectNavigationData | null;
  tokenDraft?: DesignTokens | null;
  tokenDirty?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const designMd = useMemo(
    () => buildPublicDesignMdDocument({ project, projectNavigation, tokenDraft }),
    [project, projectNavigation, tokenDraft],
  );

  const handleCopy = async () => {
    await navigator.clipboard?.writeText(designMd).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const handleDownload = () => {
    const blob = new Blob([designMd], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "design.md";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f0f2f3]">
      <div className="relative shrink-0 overflow-hidden border-b border-black/15 bg-[#111316] text-white">
        <div className="h-1 bg-[linear-gradient(90deg,#f8fafc_0%,#38bdf8_32%,#facc15_67%,#34d399_100%)]" />
        <div className="relative px-4 py-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
             
              <div className="mt-2 flex items-center gap-2">
                <FileText className="h-5 w-5 text-sky-200" />
                <h2 className="truncate text-[20px] font-semibold tracking-tight text-white">Design.md</h2>
              </div>
             
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-[10px] border border-white/10 bg-white/[0.08] text-slate-200 hover:bg-white/15 hover:text-white"
                title="Copy Design.md"
                onClick={() => void handleCopy()}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-[10px] border border-white/10 bg-white/[0.08] text-slate-200 hover:bg-white/15 hover:text-white"
                title="Download design.md"
                onClick={handleDownload}
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
      <DesignMdCodeView value={designMd} />
    </div>
  );
}
