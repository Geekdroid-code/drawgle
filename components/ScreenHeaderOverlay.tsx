import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { PremiumDropdown } from "@/components/ui/premium-dropdown";
import { MoreHorizontal, Edit2, Play, Download, Trash2 } from "lucide-react";

export function ScreenHeaderOverlay({
  screen,
  screenRect,
  onEdit,
  onPreview,
  onExport,
  onDelete,
  onDeselect,
}: {
  screen: { id: string; name: string };
  screenRect: { left: number; top: number; width: number } | null;
  onEdit?: () => void;
  onPreview?: () => void;
  onExport?: () => void;
  onDelete?: () => void;
  onDeselect?: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Deselect on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        onDeselect?.();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onDeselect]);

  if (!screenRect) return null;

  return (
    <div
      ref={overlayRef}
      style={{
        position: "absolute",
        left: screenRect.left + screenRect.width / 2,
        top: screenRect.top - 48,
        transform: "translate(-50%, -100%)",
        zIndex: 100,
        pointerEvents: "auto",
      }}
      className="flex items-center gap-2 rounded-xl border border-[var(--dg-border)] bg-[var(--dg-surface)] px-4 py-2 text-[var(--dg-text)] shadow-lg"
    >
      <span className="max-w-[200px] truncate text-base font-semibold text-[var(--dg-text)]">{screen.name}</span>
      <PremiumDropdown
        align="end"
        trigger={
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-[var(--dg-text-muted)] hover:bg-[var(--dg-surface-muted)] hover:text-[var(--dg-text)]">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        }
        items={[
          ...(onEdit ? [{ id: "edit", label: "Edit Prompt", icon: Edit2, onClick: onEdit }] : []),
          ...(onPreview ? [{ id: "preview", label: "Preview", icon: Play, onClick: onPreview }] : []),
          ...(onExport ? [{ id: "export", label: "Export Code", icon: Download, onClick: onExport }] : []),
          ...(onDelete ? [{ id: "delete", label: "Delete", icon: Trash2, onClick: onDelete, variant: "destructive" as const }] : []),
        ]}
      />
    </div>
  );
}
