import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
      className="flex items-center gap-2 px-4 py-2 rounded-xl shadow-lg bg-white border border-gray-200"
    >
      <span className="font-semibold text-gray-900 text-base truncate max-w-[200px]">{screen.name}</span>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-gray-100" />}>
          <MoreHorizontal className="w-4 h-4 text-gray-900" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>
            <Edit2 className="w-4 h-4 mr-2" />
            Edit Prompt
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onPreview}>
            <Play className="w-4 h-4 mr-2" />
            Preview
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExport}>
            <Download className="w-4 h-4 mr-2" />
            Export Code
          </DropdownMenuItem>
          <DropdownMenuItem className="text-red-600" onClick={onDelete}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
