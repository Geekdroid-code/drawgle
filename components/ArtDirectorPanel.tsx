"use client";

import { useState, useEffect } from "react";
import { Loader2, Palette, Type, Square, Sparkles, Check, ArrowRight } from "lucide-react";
import { ProjectData } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { updateProjectFields } from "@/lib/supabase/queries";

interface ArtDirectorPanelProps {
  project: ProjectData;
  onGenerationStart: (designTokens: any) => Promise<void>;
}

export function ArtDirectorPanel({ project, onGenerationStart }: ArtDirectorPanelProps) {
  // If we have an existing drafted token, use it. Otherwise null.
  const [tokens, setTokens] = useState<any>(project.designTokens || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [loadingText, setLoadingText] = useState("");

  useEffect(() => {
    setTokens(project.designTokens || null);
  }, [project.designTokens, project.id]);

  useEffect(() => {
    // Only auto-fetch if we have a prompt but NO tokens yet
    if (tokens || !project.prompt) return;

    const fetchDesign = async () => {
      const supabase = createClient();
      setIsLoading(true);
      setLoadingText("Analyzing vibe...");
      try {
        const res = await fetch("/api/design", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: project.prompt })
        });
        
        if (!res.ok) throw new Error("Failed to fetch design");
        const json = await res.json();
        setTokens(json);
        
        await updateProjectFields(supabase, project.id, {
          designTokens: json,
        });
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDesign();
  }, [project, tokens]);

  // Fallback defaults if no prompt was given to run the generator
  useEffect(() => {
    if (!tokens && !project.prompt && !isLoading) {
      setTokens({
        tokens: {
          color: {
            background: { primary: "#ffffff", surface_elevated: "#f9fafb" },
            text: { high_emphasis: "#111827", medium_emphasis: "#6b7280", low_emphasis: "#9ca3af", action_label: "#ffffff" },
            action: { primary_gradient_start: "#000000", primary_gradient_end: "#333333", on_surface_white_bg: "#ffffff", disabled: "#e5e7eb" },
            border: { divider: "#e5e7eb", focused: "#000000" }
          },
          typography: { font_family: "Inter" },
          radii: { none: "0px", standard: "12px", pill: "9999px" },
          mobile_layout: { screen_margin: "24px" }
        }
      });
    }
  }, [tokens, project.prompt, isLoading]);

  const handleUpdateToken = (path: string[], value: string) => {
    if (!tokens) return;
    const updated = JSON.parse(JSON.stringify(tokens));
    let current = updated.tokens;
    for (let i = 0; i < path.length - 1; i++) {
        if (!current[path[i]]) current[path[i]] = {};
        current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
    setTokens(updated);
  };

  const handleBuild = async () => {
    setIsStarting(true);
    setLoadingText("Provisioning agents...");
    
    try {
      if (tokens) {
        const supabase = createClient();
        // Change status to active instantly so the canvas unmounts the panel
        await updateProjectFields(supabase, project.id, {
          designTokens: tokens,
          status: "active",
        });
        
        // Spin off the generation asynchronously without blocking the UI
        onGenerationStart(tokens).catch(e => console.error("Generation failed:", e));
      }
    } catch (e) {
      console.error(e);
      setIsStarting(false);
    }
  };

  if (isLoading || isStarting) {
    return (
      <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 max-w-xs w-full text-center space-y-4">
          <Loader2 className="w-6 h-6 text-gray-900 animate-spin mx-auto" />
          <p className="text-sm font-medium text-gray-700">{loadingText}</p>
        </div>
      </div>
    );
  }

  if (!tokens?.tokens) return null;

  const t = tokens.tokens;
  const primaryBg = t.color?.background?.primary || "#ffffff";
  const primaryText = t.color?.text?.high_emphasis || "#111827";
  const actionPrimary = t.color?.action?.primary_gradient_start || t.color?.action?.primary || "#000000";
  const actionText = t.color?.text?.action_label || t.color?.action?.on_surface_white_bg || "#ffffff";

  return (
    <div className="absolute inset-0 bg-white md:bg-gray-50/80 md:backdrop-blur-sm z-50 flex items-center justify-center md:p-6 overflow-hidden">
      <div className="bg-white md:rounded-xl md:shadow-xl md:border border-gray-200 w-full h-full md:h-auto md:max-h-[85vh] md:max-w-4xl flex flex-col md:flex-row overflow-hidden absolute md:relative inset-0 md:inset-auto">
        
        {/* Left Side: Controls */}
        <div className="w-full md:w-[45%] flex flex-col h-full bg-white border-r border-gray-100 overflow-y-auto">
          <div className="p-5 md:p-6 pb-4 shrink-0">
            <h2 className="text-lg font-semibold tracking-tight text-gray-900 mb-1">Design System</h2>
            <p className="text-sm text-gray-500 font-normal">Configure the base styles before generating.</p>
          </div>

          <div className="space-y-6 px-5 md:px-6 pb-20 flex-1 overflow-y-auto">
            {/* Colors */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5" /> Colors
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <ColorPicker label="Accent" value={actionPrimary} onChange={(v) => handleUpdateToken(["color", "action", "primary_gradient_start"], v)} />
                <ColorPicker label="Background" value={primaryBg} onChange={(v) => handleUpdateToken(["color", "background", "primary"], v)} />
                <ColorPicker label="Cards" value={t.color?.background?.surface_elevated || t.color?.surface?.card || "#ffffff"} onChange={(v) => handleUpdateToken(["color", "background", "surface_elevated"], v)} />
                <ColorPicker label="Text" value={primaryText} onChange={(v) => handleUpdateToken(["color", "text", "high_emphasis"], v)} />
              </div>
            </div>

            {/* Typography */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5" /> Typography
              </h3>
              <select 
                value={t.typography?.font_family?.split(',')[0].replace(/['"]/g, '') || "Inter"}
                onChange={(e) => handleUpdateToken(["typography", "font_family"], e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 focus:ring-1 focus:ring-gray-900 outline-none transition-shadow"
              >
                <option value="Inter">Inter (Clean)</option>
                <option value="Playfair Display">Playfair (Serif)</option>
                <option value="Space Grotesk">Space Grotesk (Tech)</option>
                <option value="Geist">Geist (Modern)</option>
              </select>
            </div>

            {/* Corners */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <Square className="w-3.5 h-3.5" /> Corners
              </h3>
              <div className="flex bg-gray-50 rounded-md p-1 border border-gray-200">
                <RadiusOption label="Sharp" value="0px" current={t.radii?.standard || t.radii?.md || '0px'} onClick={(v) => updateAllRadii(v)} />
                <RadiusOption label="Round" value="8px" current={t.radii?.standard || t.radii?.md || '8px'} onClick={(v) => updateAllRadii(v)} />
                <RadiusOption label="Soft" value="16px" current={t.radii?.standard || t.radii?.md || '16px'} onClick={(v) => updateAllRadii(v)} />
              </div>
            </div>
          </div>

          <div className="p-4 md:p-6 border-t border-gray-100 bg-white mt-auto sticky bottom-0">
            <Button onClick={handleBuild} className="w-full h-10 text-sm font-medium">
              Save & Build <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </div>

        {/* Right Side: Preview */}
        <div className="hidden md:flex w-[55%] items-center justify-center bg-gray-50/50 p-8 relative shrink-0">
          {/* Minimal Mock App Container */}
          <div 
            className="w-[280px] h-[580px] bg-white shadow-sm ring-1 ring-gray-200 relative overflow-hidden flex flex-col transition-all duration-300"
            style={{ 
              backgroundColor: primaryBg, 
              color: primaryText,
              fontFamily: t.typography?.font_family || 'sans-serif',
              borderRadius: '24px'
            }}
          >
            <div className="flex-1 p-5 flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div className="w-7 h-7 rounded-full" style={{ backgroundColor: t.color?.background?.surface_elevated || t.color?.surface?.card || '#e5e7eb' }} />
                <div className="w-7 h-7 rounded-sm opacity-80" style={{ backgroundColor: actionPrimary, borderRadius: t.radii?.standard || t.radii?.sm || '4px' }} />
              </div>
              
              <h1 className="text-2xl font-bold tracking-tight mb-2" style={{ color: primaryText }}>Preview</h1>
              <p className="text-xs mb-8 opacity-60">This mock shows your active design tokens.</p>

              <div className="space-y-3 flex-1">
                <div className="p-3 shadow-sm ring-1 ring-black/5" style={{ backgroundColor: t.color?.background?.surface_elevated || t.color?.surface?.card || '#ffffff', borderRadius: t.radii?.standard || t.radii?.md || '8px' }}>
                  <div className="h-3 w-1/3 rounded mb-2 opacity-20" style={{ backgroundColor: primaryText }} />
                  <div className="space-y-1.5">
                    <div className="h-2 w-full rounded opacity-10" style={{ backgroundColor: primaryText }} />
                    <div className="h-2 w-5/6 rounded opacity-10" style={{ backgroundColor: primaryText }} />
                  </div>
                </div>
                
                <div className="p-3 shadow-sm ring-1 ring-black/5" style={{ backgroundColor: t.color?.background?.surface_elevated || t.color?.surface?.card || '#ffffff', borderRadius: t.radii?.standard || t.radii?.md || '8px' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full opacity-10" style={{ backgroundColor: primaryText }} />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-2 w-1/2 rounded opacity-20" style={{ backgroundColor: primaryText }} />
                      <div className="h-1.5 w-1/3 rounded opacity-10" style={{ backgroundColor: primaryText }} />
                    </div>
                  </div>
                </div>
              </div>

              <button 
                className="w-full py-2.5 text-sm font-medium transition-all active:scale-95 flex justify-center items-center gap-2"
                style={{ 
                  backgroundColor: actionPrimary, 
                  color: actionText,
                  borderRadius: t.radii?.standard || t.radii?.sm || '6px'
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  function updateAllRadii(baseStr: string) {
    const valObj = baseStr === '0px' ? { none: '0px', standard: '0px', pill: '0px' } 
                 : baseStr === '8px' ? { none: '0px', standard: '8px', pill: '9999px' }
                 : { none: '0px', standard: '16px', pill: '9999px' };
    
    const updated = JSON.parse(JSON.stringify(tokens));
    updated.tokens.radii = { ...updated.tokens.radii, ...valObj };
    setTokens(updated);
  }
}

function ColorPicker({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1 w-full relative group">
      <label className="text-[11px] font-medium text-gray-500">{label}</label>
      <div className="relative flex items-center bg-gray-50 border border-gray-200 rounded-md p-1 pr-2 transition-all hover:border-gray-300 focus-within:ring-1 focus-within:ring-gray-900 focus-within:bg-white overflow-hidden">
        <input 
          type="color" 
          value={value.length === 7 ? value : value.length === 4 ? `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}` : "#000000"} 
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 w-[200%] h-[200%] -top-2 -left-2 opacity-0 cursor-pointer"
        />
        <div className="w-5 h-5 rounded-[4px] border border-black/10 shrink-0 shadow-sm pointer-events-none" style={{ backgroundColor: value }} />
        <input 
          type="text" 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          className="w-full text-xs font-mono font-medium text-gray-900 outline-none uppercase bg-transparent ml-2"
        />
      </div>
    </div>
  );
}

function RadiusOption({ label, value, current, onClick }: { label: string, value: string, current: string, onClick: (v: string) => void }) {
  const active = current === value || (value === '24px' && parseInt(current) > 16) || (value === '16px' && parseInt(current) >= 16 && parseInt(current) < 24);
  return (
    <button 
      onClick={() => onClick(value)}
      className={`flex-1 py-1.5 text-xs font-medium rounded-[4px] transition-all ${active ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200' : 'text-gray-500 hover:text-gray-900'}`}
    >
      {label}
    </button>
  );
}
