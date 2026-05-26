"use client";

import { useState, type CSSProperties } from "react";

import { TokenCanvas } from "./TokenCanvas";
import { TokenController } from "./TokenController";
import { cloneTokens, DEFAULT_PLAYGROUND_TOKENS, tokenCssVariables, type PlaygroundTokens } from "./tokens";

export default function LiveTokenPlayground() {
  const [tokens, setTokens] = useState<PlaygroundTokens>(() => cloneTokens(DEFAULT_PLAYGROUND_TOKENS));

  return (
    <section
      className="relative min-h-screen overflow-hidden bg-[#f7f8fb] text-slate-950"
      style={tokenCssVariables(tokens) as CSSProperties}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle,#cbd5e1_1px,transparent_1px)] [background-size:20px_20px]" />
      <div className="absolute inset-x-0 top-0 h-px bg-slate-200" />

      <div className="relative grid min-h-screen lg:grid-cols-[440px_minmax(0,1fr)]">
        <TokenController tokens={tokens} onChange={setTokens} />

        <div className="min-w-0">
          <div className="border-b border-slate-200 bg-white/72 px-5 py-4 backdrop-blur">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#1b7fcc]">Live token canvas</p>
                <h2 className="mt-1 max-w-4xl text-3xl font-bold tracking-tight text-slate-950 md:text-5xl font-[var(--font-inter-tight)]">
                  Edit the design system. Watch every generated screen update.
                </h2>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <TokenStat label="Primary" value={tokens.colors.actionPrimary} />
                <TokenStat label="Radius" value={`${tokens.radii.app}px`} />
                <TokenStat label="LLM calls" value="0" />
              </div>
            </div>
          </div>

          <div className="min-h-[calc(100vh-132px)] py-8">
            <TokenCanvas tokens={tokens} />
          </div>
        </div>
      </div>
    </section>
  );
}

function TokenStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-28 rounded-[12px] border border-slate-200 bg-white/80 px-3 py-2 shadow-sm">
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 truncate font-mono text-sm font-bold text-slate-900">{value}</div>
    </div>
  );
}
