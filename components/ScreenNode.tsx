"use client";

import { ScreenData } from "@/lib/types";
import { useState, useRef, useEffect, useMemo } from "react";
import { MoreHorizontal, Download, Play, Trash2, Edit2, GripHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { deleteScreen, updateScreenPosition } from "@/lib/supabase/queries";

export function ScreenNode({ 
  screen, 
  isSelected, 
  onClick,
  scale = 1
}: { 
  screen: ScreenData, 
  isSelected?: boolean, 
  onClick?: () => void,
  scale?: number
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const [position, setPosition] = useState({ x: screen.x, y: screen.y });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, nodeX: 0, nodeY: 0 });

  // Store initial code in state to avoid ref access during render
  const [initialCode] = useState(screen.code);

  useEffect(() => {
    if (!isDragging) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPosition({ x: screen.x, y: screen.y });
    }
  }, [screen.x, screen.y, isDragging]);

  useEffect(() => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'updateCode', code: screen.code }, '*');
    }
  }, [screen.code]);

  const handleDelete = async () => {
    try {
      const supabase = createClient();
      await deleteScreen(supabase, screen.id);
    } catch (error) {
      console.error("Failed to delete screen", error);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.stopPropagation();
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      nodeX: position.x,
      nodeY: position.y
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.stopPropagation();
    const dx = (e.clientX - dragStart.current.x) / scale;
    const dy = (e.clientY - dragStart.current.y) / scale;
    setPosition({
      x: dragStart.current.nodeX + dx,
      y: dragStart.current.nodeY + dy
    });
  };

  const handlePointerUp = async (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.stopPropagation();
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
    
    try {
      const supabase = createClient();
      await updateScreenPosition(supabase, screen.id, position.x, position.y);
    } catch (error) {
      console.error("Failed to save position", error);
    }
  };

  const srcDoc = useMemo(() => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://unpkg.com/lucide@latest"></script>
        <style>
          body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; overflow-x: hidden; }
          /* Hide scrollbar for Chrome, Safari and Opera */
          ::-webkit-scrollbar { display: none; width: 0; height: 0; }
          /* Hide scrollbar for IE, Edge and Firefox */
          * { -ms-overflow-style: none; scrollbar-width: none; }
        </style>
      </head>
      <body>
        <div id="root">${initialCode}</div>
        <script>
          lucide.createIcons();
          window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'updateCode') {
              document.getElementById('root').innerHTML = event.data.code;
              lucide.createIcons();
            }
          });
        </script>
      </body>
    </html>
  `, [initialCode]);

  return (
    <div 
      onClick={onClick}
      className={`absolute bg-white rounded-[40px] shadow-2xl border-[8px] overflow-hidden flex flex-col transition-shadow duration-200 ${isSelected ? 'border-blue-500 ring-4 ring-blue-500/50 cursor-default' : 'border-gray-900 cursor-pointer hover:border-gray-700'}`}
      style={{
        left: position.x,
        top: position.y,
        width: 390,
        height: 844,
        zIndex: isSelected || isDragging ? 50 : 10,
      }}
    >
      {/* Header bar */}
      <div 
        className="h-12 w-full shrink-0 bg-white flex items-center justify-between px-4 cursor-grab active:cursor-grabbing z-50 border-b border-gray-100 touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="flex items-center gap-2 pointer-events-none">
          <GripHorizontal className="w-4 h-4 text-gray-400" />
          <div className="text-xs font-semibold text-gray-900 bg-gray-100 px-3 py-1.5 rounded-full shadow-sm truncate max-w-[180px]">
            {screen.name}
          </div>
        </div>
        <div onPointerDown={(e) => e.stopPropagation()} className="cursor-default">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-gray-100" />}>
              <MoreHorizontal className="w-4 h-4 text-gray-900" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Edit2 className="w-4 h-4 mr-2" />
                Edit Prompt
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Play className="w-4 h-4 mr-2" />
                Preview
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Download className="w-4 h-4 mr-2" />
                Export Code
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-600" onClick={(e) => { e.stopPropagation(); handleDelete(); }}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 w-full relative bg-white overflow-hidden">
        {!isSelected && (
          <div className="absolute inset-0 z-10" />
        )}
        <iframe
          ref={iframeRef}
          title={screen.name}
          className="absolute inset-0 w-full h-full border-none"
          sandbox="allow-scripts allow-same-origin"
          srcDoc={srcDoc}
          style={{ pointerEvents: isDragging ? 'none' : 'auto' }}
        />
      </div>
    </div>
  );
}
