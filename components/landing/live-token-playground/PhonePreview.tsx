import type { PlaygroundTokens } from "./tokens";
import { buildProject2SrcDoc } from "./screen-html/build-src-doc";

type PhonePreviewProps = {
  html: string;
  label: string;
  active?: boolean;
  tokens: PlaygroundTokens;
};

export function PhonePreview({ html, label, active = false, tokens }: PhonePreviewProps) {
  return (
    <div className="shrink-0">
      <div className="mb-3 flex items-center justify-between px-2">
        <span className="text-[13px] font-semibold text-slate-600">{label}</span>
        <span
          className="h-2.5 w-2.5 rounded-full shadow-[0_0_12px_currentColor]"
          style={{ color: active ? "var(--dg-color-action-primary)" : "rgba(100,116,139,0.35)", backgroundColor: "currentColor" }}
        />
      </div>

      <div className="relative h-[740px] w-[342px] rounded-[54px] bg-gradient-to-br from-[#4b4b4f] via-[#171719] to-[#343438] p-[10px] shadow-[0_32px_90px_-42px_rgba(15,23,42,0.85)]">
        <div className="absolute left-[-4px] top-[120px] h-7 w-1 rounded-l bg-[#2f3034]" />
        <div className="absolute left-[-4px] top-[164px] h-9 w-1 rounded-l bg-[#2f3034]" />
        <div className="absolute right-[-4px] top-[148px] h-16 w-1 rounded-r bg-[#2f3034]" />
        <div className="relative h-full overflow-hidden rounded-[45px] bg-black">
          <iframe
            title={`${label} app preview`}
            srcDoc={buildProject2SrcDoc(html, tokens)}
            sandbox="allow-scripts allow-same-origin"
            className="h-full w-full border-0"
          />
          <div className="pointer-events-none absolute left-1/2 top-3 z-30 h-6 w-28 -translate-x-1/2 rounded-full bg-black" />
          <div className="pointer-events-none absolute bottom-2 left-1/2 z-30 h-1.5 w-28 -translate-x-1/2 rounded-full bg-black/30" />
        </div>
      </div>
    </div>
  );
}

