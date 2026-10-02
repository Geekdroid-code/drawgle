const positions = ["flex-start", "center", "flex-end"];
const names = ["start", "center", "end"];
export function AlignmentControl({ direction, justify, align, onChange }: {
  direction: string; justify: string; align: string;
  onChange: (values: { "justify-content": string; "align-items": string }) => void;
}) {
  const vertical = direction.startsWith("column");
  const reverse = direction.endsWith("reverse");
  const horizontalValue = vertical ? align : justify;
  const verticalValue = vertical ? justify : align;
  const normalized = (value: string) => value === "start" ? "flex-start" : value === "end" ? "flex-end" : value;
  return <div><div role="group" aria-label="Group alignment" className="grid grid-cols-3 gap-1 rounded-xl bg-[var(--dg-surface-muted)] p-1">
    {positions.flatMap((_, row) => positions.map((__, column) => {
      const mainIndex = vertical ? row : column;
      const main = positions[reverse ? 2 - mainIndex : mainIndex];
      const cross = positions[vertical ? column : row];
      const x = vertical ? cross : main, y = vertical ? main : cross;
      const selected = normalized(horizontalValue) === x && normalized(verticalValue) === y;
      return <button type="button" key={`${row}:${column}`} aria-label={`Align ${names[row]} ${names[column]}`} aria-pressed={selected}
        className="ve-segment !min-h-6 max-md:!min-h-11" onClick={() => onChange({ "justify-content": main, "align-items": cross })}>
        <span className={`h-1.5 w-1.5 rounded-full ${selected ? "bg-blue-500" : "bg-[var(--dg-text-muted)] opacity-35"}`} />
      </button>;
    }))}</div>{(!positions.includes(normalized(justify)) || !positions.includes(normalized(align))) &&
      <p className="mt-2 text-[11px] text-[var(--dg-text-muted)]">Current: {justify || "automatic"} · {align || "automatic"}</p>}
  </div>;
}
