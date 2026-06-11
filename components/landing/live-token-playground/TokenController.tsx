"use client";

import { useState, type ReactNode } from "react";
import { Box, Layers, Palette, RotateCcw, Ruler, SlidersHorizontal, Type } from "lucide-react";

import {
  cloneTokens,
  COLOR_GROUPS,
  DARK_PROJECT2_TOKENS,
  DEFAULT_PLAYGROUND_TOKENS,
  LAYOUT_ITEMS,
  LIGHT_PLAYGROUND_TOKENS,
  SIZING_ITEMS,
  SPACING_ITEMS,
  TYPE_ITEMS,
  type ColorTokenKey,
  type PlaygroundTokens,
  type RadiusTokenKey,
  type ShadowTokenKey,
  type SizingTokenKey,
  type TypeTokenKey,
} from "./tokens";

type TokenTab = "colors" | "type" | "spacing" | "shape";

const TABS: Array<{ id: TokenTab; label: string; icon: typeof Palette }> = [
  { id: "colors", label: "Colors", icon: Palette },
  { id: "type", label: "Type", icon: Type },
  { id: "spacing", label: "Spaci...", icon: Ruler },
  { id: "shape", label: "Shape", icon: Box },
];

type TokenControllerProps = {
  tokens: PlaygroundTokens;
  onChange: (tokens: PlaygroundTokens) => void;
};

export function TokenController({ tokens, onChange }: TokenControllerProps) {
  const setTokens = (mutate: (draft: PlaygroundTokens) => void) => {
    const draft = cloneTokens(tokens);
    mutate(draft);
    onChange(draft);
  };

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-slate-200 bg-[#eef2f6]">
      <div className="border-b border-slate-200 bg-white/80 px-5 py-4 backdrop-blur">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
          <SlidersHorizontal className="h-4 w-4" />
          Live Design Tokens
        </div>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Token controller</h2>
      </div>

      <TokenTabs
        tokens={tokens}
        setTokens={setTokens}
        onLight={() => onChange(cloneTokens(LIGHT_PLAYGROUND_TOKENS))}
        onDark={() => onChange(cloneTokens(DARK_PROJECT2_TOKENS))}
        onReset={() => onChange(cloneTokens(DEFAULT_PLAYGROUND_TOKENS))}
      />
    </div>
  );
}

function TokenTabs({
  tokens,
  setTokens,
  onLight,
  onDark,
  onReset,
}: {
  tokens: PlaygroundTokens;
  setTokens: (mutate: (draft: PlaygroundTokens) => void) => void;
  onLight: () => void;
  onDark: () => void;
  onReset: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TOKEN_TAB>("colors");

  return (
    <>
      <div className="px-4 pt-4">
        <div className="grid grid-cols-4 gap-1 rounded-[14px] border border-slate-200 bg-[#f8fafc] p-1 shadow-sm">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                className={`flex h-11 items-center justify-center gap-1.5 rounded-[10px] text-sm font-semibold transition ${
                  active ? "bg-[#030712] text-white shadow-lg shadow-slate-950/15" : "text-slate-600 hover:bg-white"
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {activeTab === "colors" ? <ColorsPanel tokens={tokens} setTokens={setTokens} /> : null}
        {activeTab === "type" ? <TypePanel tokens={tokens} setTokens={setTokens} /> : null}
        {activeTab === "spacing" ? <SpacingPanel tokens={tokens} setTokens={setTokens} /> : null}
        {activeTab === "shape" ? <ShapePanel tokens={tokens} setTokens={setTokens} /> : null}
      </div>

      <div className="border-t border-slate-200 bg-white/90 p-3">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="rounded-[12px] bg-red-500 px-3 py-2 text-sm font-bold text-white" onClick={() => setTokens((draft) => {
            draft.colors.actionPrimary = "#EF4444";
            draft.colors.borderFocused = "#EF4444";
          })}>
            Make red
          </button>
          <button type="button" className="rounded-[12px] bg-slate-950 px-3 py-2 text-sm font-bold text-white" onClick={() => setTokens((draft) => {
            draft.radii.app = 0;
          })}>
            Sharp UI
          </button>
          <button type="button" className="rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700" onClick={onLight}>
            Light theme
          </button>
          <button type="button" className="rounded-[12px] border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700" onClick={onDark}>
            Dark ref
          </button>
        </div>
        <button
          type="button"
          className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-[12px] bg-slate-200 text-sm font-bold text-slate-700"
          onClick={onReset}
        >
          <RotateCcw className="h-4 w-4" />
          Reset section
        </button>
      </div>
    </>
  );
}

type TOKEN_TAB = TokenTab;

function ColorsPanel({ tokens, setTokens }: { tokens: PlaygroundTokens; setTokens: (mutate: (draft: PlaygroundTokens) => void) => void }) {
  return (
    <div className="grid gap-4">
      {COLOR_GROUPS.map((group) => (
        <TokenGroup key={group.title} title={group.title}>
          {group.items.map((item) => (
            <ColorRow
              key={item.key}
              label={item.label}
              hint={item.hint}
              value={tokens.colors[item.key]}
              onChange={(value) => setTokens((draft) => {
                draft.colors[item.key] = value;
                if (item.key === "actionPrimary") {
                  draft.colors.borderFocused = value;
                }
              })}
            />
          ))}
        </TokenGroup>
      ))}
    </div>
  );
}

function TypePanel({ tokens, setTokens }: { tokens: PlaygroundTokens; setTokens: (mutate: (draft: PlaygroundTokens) => void) => void }) {
  return (
    <div className="grid gap-4">
      <TokenGroup title="Font Stack">
        <div className="p-4">
          <label className="text-sm font-bold text-slate-900">Primary font</label>
          <p className="mt-1 text-xs text-slate-500">Accepts a font name or CSS font stack</p>
          <input
            value={tokens.fontFamily}
            onChange={(event) => setTokens((draft) => {
              draft.fontFamily = event.target.value;
            })}
            className="mt-3 h-10 w-full rounded-[10px] border border-slate-200 bg-white px-3 font-mono text-xs text-slate-900 outline-none"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {["Space Grotesk", "Inter", "SF Mono"].map((font) => (
              <button
                key={font}
                type="button"
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600"
                onClick={() => setTokens((draft) => {
                  draft.fontFamily = font === "SF Mono" ? "'SF Mono', 'JetBrains Mono', monospace" : `'${font}', sans-serif`;
                })}
              >
                {font}
              </button>
            ))}
          </div>
        </div>
      </TokenGroup>

      <TokenGroup title="Type Scale">
        {TYPE_ITEMS.map((item) => (
          <TypeRow
            key={item.key}
            label={item.label}
            tokenKey={item.key}
            tokens={tokens}
            setTokens={setTokens}
          />
        ))}
      </TokenGroup>
    </div>
  );
}

function SpacingPanel({ tokens, setTokens }: { tokens: PlaygroundTokens; setTokens: (mutate: (draft: PlaygroundTokens) => void) => void }) {
  return (
    <div className="grid gap-4">
      <TokenGroup title="Spacing Scale">
        {SPACING_ITEMS.map((item) => (
          <MetricSlider
            key={item.key}
            label={item.label}
            value={tokens.spacing[item.key]}
            max={item.max}
            onChange={(value) => setTokens((draft) => {
              draft.spacing[item.key] = value;
            })}
          />
        ))}
      </TokenGroup>
      <TokenGroup title="Layout Rhythm">
        {LAYOUT_ITEMS.map((item) => (
          <MetricSlider
            key={item.key}
            label={item.label}
            value={tokens.layout[item.key]}
            max={item.max}
            onChange={(value) => setTokens((draft) => {
              draft.layout[item.key] = value;
            })}
          />
        ))}
      </TokenGroup>
      <TokenGroup title="Sizing">
        {SIZING_ITEMS.map((item) => (
          <MetricSlider
            key={item.key}
            label={item.label}
            value={tokens.sizing[item.key]}
            max={item.max}
            onChange={(value) => setTokens((draft) => {
              draft.sizing[item.key] = value;
            })}
          />
        ))}
      </TokenGroup>
    </div>
  );
}

function ShapePanel({ tokens, setTokens }: { tokens: PlaygroundTokens; setTokens: (mutate: (draft: PlaygroundTokens) => void) => void }) {
  return (
    <div className="grid gap-4">
      <TokenGroup title="Corner Geometry">
        <ShapeRow label="App Radius" radiusKey="app" tokens={tokens} setTokens={setTokens} />
        <ShapeRow label="Pill Radius" radiusKey="pill" tokens={tokens} setTokens={setTokens} max={9999} />
      </TokenGroup>
      <TokenGroup title="Elevation">
        <ShadowRow label="Surface Shadow" shadowKey="surface" tokens={tokens} setTokens={setTokens} />
        <ShadowRow label="Overlay Shadow" shadowKey="overlay" tokens={tokens} setTokens={setTokens} />
        <ShadowRow label="Flat shadow" shadowKey="none" tokens={tokens} setTokens={setTokens} />
      </TokenGroup>
    </div>
  );
}

function TokenGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
        <Layers className="h-4 w-4" />
        {title}
      </div>
      <div>{children}</div>
    </section>
  );
}

function ColorRow({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid min-h-[58px] cursor-pointer grid-cols-[36px_minmax(0,1fr)_74px_16px] items-center gap-3 border-b border-slate-100 px-3 py-2 last:border-b-0">
      <span className="h-8 w-8 rounded-full border border-slate-200 shadow-inner" style={{ backgroundColor: value }} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-slate-900">{label}</span>
        <span className="block truncate text-xs text-slate-500">{hint}</span>
      </span>
      <span className="font-mono text-xs text-slate-500">{value}</span>
      <input type="color" value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} className="h-4 w-4 opacity-0" />
      <span className="pointer-events-none col-start-4 row-start-1 text-slate-300">›</span>
    </label>
  );
}

function TypeRow({
  label,
  tokenKey,
  tokens,
  setTokens,
}: {
  label: string;
  tokenKey: TypeTokenKey;
  tokens: PlaygroundTokens;
  setTokens: (mutate: (draft: PlaygroundTokens) => void) => void;
}) {
  const token = tokens.type[tokenKey];

  return (
    <div className="border-b border-slate-100 px-3 py-3 last:border-b-0">
      <div className="grid grid-cols-[minmax(0,1fr)_150px] items-center gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-slate-900">{label}</div>
          <div className="truncate text-xs text-slate-500">Size {token.size}px · Line {token.lineHeight}px · Weight {token.weight}</div>
        </div>
        <div className="truncate rounded-[10px] bg-slate-100 px-3 py-2 text-slate-950" style={{ fontSize: Math.min(token.size, 28), fontWeight: token.weight, lineHeight: 1.1 }}>
          {token.sample}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <SmallNumber label="Size" value={token.size} min={10} max={54} onChange={(value) => setTokens((draft) => {
          draft.type[tokenKey].size = value;
        })} />
        <SmallNumber label="Line" value={token.lineHeight} min={12} max={64} onChange={(value) => setTokens((draft) => {
          draft.type[tokenKey].lineHeight = value;
        })} />
        <SmallNumber label="Weight" value={token.weight} min={300} max={900} step={100} onChange={(value) => setTokens((draft) => {
          draft.type[tokenKey].weight = value;
        })} />
      </div>
    </div>
  );
}

function MetricSlider({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (value: number) => void }) {
  return (
    <div className="border-b border-slate-100 px-3 py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-slate-900">{label}</span>
        <span className="rounded-full bg-slate-100 px-3 py-1 font-mono text-xs text-slate-600">{value}px</span>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-slate-950"
      />
    </div>
  );
}

function ShapeRow({
  label,
  radiusKey,
  tokens,
  setTokens,
  max = 64,
}: {
  label: string;
  radiusKey: RadiusTokenKey;
  tokens: PlaygroundTokens;
  setTokens: (mutate: (draft: PlaygroundTokens) => void) => void;
  max?: number;
}) {
  const value = tokens.radii[radiusKey];
  const sliderMax = radiusKey === "pill" ? 100 : max;
  const sliderValue = radiusKey === "pill" ? Math.min(value, 100) : value;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_86px] items-center gap-3 border-b border-slate-100 px-3 py-3 last:border-b-0">
      <div>
        <div className="text-sm font-bold text-slate-900">{label}</div>
        <div className="font-mono text-xs text-slate-500">{value}px</div>
        <input
          type="range"
          min={0}
          max={sliderMax}
          value={sliderValue}
          onChange={(event) => setTokens((draft) => {
            draft.radii[radiusKey] = radiusKey === "pill" && Number(event.target.value) === 100 ? 9999 : Number(event.target.value);
          })}
          className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-slate-950"
        />
      </div>
      <div className="grid h-12 place-items-center rounded-[10px] border border-slate-200 bg-slate-50">
        <div className="h-7 w-14 border border-slate-200 bg-white" style={{ borderRadius: value }} />
      </div>
    </div>
  );
}

function ShadowRow({
  label,
  shadowKey,
  tokens,
  setTokens,
}: {
  label: string;
  shadowKey: ShadowTokenKey;
  tokens: PlaygroundTokens;
  setTokens: (mutate: (draft: PlaygroundTokens) => void) => void;
}) {
  const token = tokens.shadows[shadowKey];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_86px] items-center gap-3 border-b border-slate-100 px-3 py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="text-sm font-bold text-slate-900">{label}</div>
        <input
          value={token.value}
          onChange={(event) => setTokens((draft) => {
            draft.shadows[shadowKey].value = event.target.value;
            draft.shadows[shadowKey].preview = event.target.value;
          })}
          className="mt-1 w-full rounded-[8px] border border-transparent bg-transparent font-mono text-xs text-slate-500 outline-none focus:border-slate-200 focus:bg-slate-50"
        />
      </div>
      <div className="grid h-12 place-items-center rounded-[10px] bg-slate-100">
        <div className="h-7 w-12 rounded-[12px] bg-white" style={{ boxShadow: token.value }} />
      </div>
    </div>
  );
}

function SmallNumber({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1 rounded-[10px] bg-slate-50 p-2">
      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full bg-transparent font-mono text-xs text-slate-800 outline-none"
      />
    </label>
  );
}
