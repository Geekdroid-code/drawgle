"use client";

import { TransformWrapper, TransformComponent, useControls, useTransformContext } from "react-zoom-pan-pinch";
import { useState, useEffect, useRef } from "react";
import { ScreenNode } from "./ScreenNode";
import { ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";

import { ScreenData } from "@/lib/types";

const CanvasControls = ({ 
  centerTarget,
  selectedScreen
}: { 
  centerTarget: {x: number, y: number, timestamp: number} | null;
  selectedScreen: ScreenData | null;
}) => {
  const { zoomIn, zoomOut, setTransform } = useControls();
  const transformContext = useTransformContext();
  const lastTargetTimestamp = useRef<number>(0);
  const lastSelectedScreenId = useRef<string | null>(null);

  useEffect(() => {
    if (centerTarget && centerTarget.timestamp !== lastTargetTimestamp.current) {
      lastTargetTimestamp.current = centerTarget.timestamp;
      
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      const scale = window.innerWidth < 768 ? 0.5 : 1;
      const posX = (viewportWidth / 2) - ((centerTarget.x + 195) * scale); // 195 is half of 390 (screen width)
      const posY = (viewportHeight / 2) - ((centerTarget.y + 422) * scale); // 422 is half of 844 (screen height)
      
      setTransform(posX, posY, scale, 500);
    }
  }, [centerTarget, setTransform]);

  useEffect(() => {
    if (selectedScreen && selectedScreen.id !== lastSelectedScreenId.current) {
      lastSelectedScreenId.current = selectedScreen.id;
      
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      const currentScale = (transformContext as any)?.transformState?.scale || (transformContext as any)?.state?.scale || (window.innerWidth < 768 ? 0.5 : 0.8);
      
      const isMobile = window.innerWidth < 768;
      // Editor panel offset: leaves space when the right sidebar opens on desktop
      const editorOffset = isMobile ? 0 : 400; 
      
      const posX = ((viewportWidth - editorOffset) / 2) - ((selectedScreen.x + 195) * currentScale); 
      const posY = (viewportHeight / 2) - ((selectedScreen.y + 422) * currentScale); 
      
      setTransform(posX, posY, currentScale, 400); 
    } else if (!selectedScreen) {
      lastSelectedScreenId.current = null;
    }
    // Intentionally omitting transformContext to stop jumpy camera issues
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedScreen, setTransform]);

  return (
    <div className="absolute top-4 right-4 z-50 hidden md:flex flex-col gap-2 bg-white/90 backdrop-blur-md p-1.5 rounded-xl shadow-sm border border-gray-200">
      <Button variant="ghost" size="icon" onClick={() => zoomIn()} className="h-8 w-8 rounded-lg hover:bg-gray-100">
        <ZoomIn className="w-4 h-4 text-gray-700" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => zoomOut()} className="h-8 w-8 rounded-lg hover:bg-gray-100">
        <ZoomOut className="w-4 h-4 text-gray-700" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => setTransform(window.innerWidth / 2 - 5000, window.innerHeight / 2 - 5000, 1, 500)} className="h-8 w-8 rounded-lg hover:bg-gray-100">
        <Maximize className="w-4 h-4 text-gray-700" />
      </Button>
    </div>
  );
};

const CanvasContent = ({ 
  screens, 
  selectedScreen, 
  onSelectScreen 
}: { 
  screens: ScreenData[], 
  selectedScreen?: ScreenData | null, 
  onSelectScreen?: (screen: ScreenData | null) => void 
}) => {
  const transformContext = useTransformContext();
  const scale = (transformContext as any)?.transformState?.scale || (transformContext as any)?.state?.scale || 1;

  return (
    <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
      <div 
        className="w-[10000px] h-[10000px] relative"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onSelectScreen?.(null);
          }
        }}
      >
        {screens.map((screen) => (
          <ScreenNode 
            key={screen.id} 
            screen={screen} 
            isSelected={selectedScreen?.id === screen.id}
            onClick={() => onSelectScreen?.(screen)}
            scale={scale}
          />
        ))}
      </div>
    </TransformComponent>
  );
};

export function CanvasArea({ 
  screens,
  centerTarget,
  selectedScreen,
  onSelectScreen
}: { 
  screens: ScreenData[],
  centerTarget?: {x: number, y: number, timestamp: number} | null,
  selectedScreen?: ScreenData | null,
  onSelectScreen?: (screen: ScreenData | null) => void
}) {
  const [initialScale, setInitialScale] = useState<number | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInitialScale(window.innerWidth < 768 ? 0.5 : 1);
  }, []);

  if (initialScale === null) return null;

  return (
    <div className="w-full h-full bg-[#f8f8f8] dot-pattern relative">
      <TransformWrapper
        initialScale={initialScale}
        minScale={0.1}
        maxScale={4}
        centerOnInit
        limitToBounds={false}
        doubleClick={{ disabled: true }}
        panning={{ allowMiddleClickPan: true, activationKeys: [" "] }}
        wheel={{ step: 0.1 }}
      >
        <>
          <CanvasControls 
            centerTarget={centerTarget || null} 
            selectedScreen={selectedScreen || null} 
          />
          <CanvasContent 
            screens={screens} 
            selectedScreen={selectedScreen} 
            onSelectScreen={onSelectScreen} 
          />
        </>
      </TransformWrapper>
    </div>
  );
}
