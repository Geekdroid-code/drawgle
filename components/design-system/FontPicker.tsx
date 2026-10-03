"use client";
import { useId, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { fontName, fontStack } from "./model";
const LIBRARY = ["Inter", "Public Sans", "Manrope", "DM Sans", "Plus Jakarta Sans", "Sora", "Geist", "Newsreader", "Instrument Serif", "IBM Plex Sans", "system-ui"];

export function FontPicker({ label, value, recommendations, onChange }: {
  label: string; value: string; recommendations: string[]; onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false), [search, setSearch] = useState(""), [active, setActive] = useState(0), [custom, setCustom] = useState(value);
  const id = useId(), name = fontName(value);
  const all = [...new Set([name, ...recommendations, ...LIBRARY])].filter(font => font !== "Choose font");
  const options = all.filter(font => font.toLowerCase().includes(search.toLowerCase()));
  const selected = Math.min(active, options.length - 1);
  const choose = (font: string) => { onChange(fontStack(font)); setOpen(false); };
  return <Popover open={open} onOpenChange={next => { setOpen(next); if (next) { setSearch(""); setActive(0); setCustom(value); } }}>
    <PopoverTrigger aria-label={`${label} font`} className="ip-input ip-select"><span style={{ fontFamily: value }}>{name}</span><ChevronDown size={13} /></PopoverTrigger>
    <PopoverContent positionerClassName="!z-[115]" className="ip-popup dt-font-popup !ring-0" align="end" sideOffset={7}>
      <PopoverTitle className="text-xs font-semibold">{label} font</PopoverTitle>
      <div className="ip-input flex items-center gap-2"><Search size={13} className="shrink-0 text-[var(--dg-text-muted)]" />
        <input role="combobox" aria-label="Search fonts" aria-expanded aria-controls={`${id}-list`} aria-activedescendant={selected >= 0 ? `${id}-${selected}` : undefined}
          className="min-w-0 flex-1 bg-transparent outline-none" placeholder="Find a font…" value={search}
          onChange={event => { setSearch(event.target.value); setActive(0); }} onKeyDown={event => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); const next = Math.max(0, Math.min(options.length - 1, selected + (event.key === "ArrowDown" ? 1 : -1))); setActive(next); document.getElementById(`${id}-${next}`)?.scrollIntoView?.({ block: "nearest" }); }
            if (event.key === "Enter" && options[selected]) { event.preventDefault(); choose(options[selected]); }
          }} />
      </div>
      <div role="listbox" aria-label="Font families" id={`${id}-list`} className="dt-font-list">
        {options.map((font, index) => <button key={font} id={`${id}-${index}`} role="option" aria-selected={name.toLowerCase() === font.toLowerCase()}
          className={`ip-option w-full text-left ${index === selected ? "bg-[var(--dg-surface-muted)]" : ""}`} onPointerEnter={() => setActive(index)}
          onClick={() => choose(font)} style={{ fontFamily: fontStack(font) }}><span>{font}</span>{name.toLowerCase() === font.toLowerCase() && <Check size={13} className="text-[#3563ee]" />}</button>)}
        {!options.length && <p className="p-3 text-xs text-[var(--dg-text-muted)]">No match. Add a custom font below.</p>}
      </div>
      <details className="dt-font-custom"><summary>Custom font or stack</summary><input className="ip-input mt-2" aria-label={`${label} custom font`} value={custom} onChange={event => setCustom(event.target.value)} />
        <p className="my-2 text-[11px] leading-4 text-[var(--dg-text-muted)]">Use an available font name or your own fallback stack.</p>
        <button type="button" className="dt-small-action" disabled={!custom.trim()} onClick={() => choose(custom)}>Use custom font</button></details>
    </PopoverContent>
  </Popover>;
}
