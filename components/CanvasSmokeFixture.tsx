"use client";

import { useState } from "react";

import type { CanvasTool } from "@/lib/canvas-interactions";
import type { ScreenData } from "@/lib/types";
import { CanvasStage } from "./CanvasArea";

const fixtureCode = (title: string, color: string) => `
  <main style="min-height:100vh;background:${color};padding:72px 28px;font-family:system-ui;color:#111827">
    <p style="font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase">Canvas smoke fixture</p>
    <h1 style="font-size:42px;line-height:1;margin:18px 0">${title}</h1>
    <div style="height:240px;border-radius:32px;background:rgba(255,255,255,.72);box-shadow:0 20px 60px rgba(15,23,42,.12)"></div>
  </main>
`;

const fixtureScreens: ScreenData[] = [
  {
    id: "canvas-smoke-one",
    projectId: "canvas-smoke",
    userId: "canvas-smoke",
    name: "Overview",
    code: fixtureCode("Overview", "#dbeafe"),
    prompt: "",
    x: 120,
    y: 100,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  },
  {
    id: "canvas-smoke-two",
    projectId: "canvas-smoke",
    userId: "canvas-smoke",
    name: "Details",
    code: fixtureCode("Details", "#fef3c7"),
    prompt: "",
    x: 650,
    y: 100,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  },
];

export function CanvasSmokeFixture() {
  const [tool, setTool] = useState<CanvasTool>("pointer");
  const [selectedScreen, setSelectedScreen] = useState<ScreenData | null>(fixtureScreens[0]);

  return (
    <main className="h-dvh w-dvw bg-[var(--dg-bg)]">
      <CanvasStage
        screens={fixtureScreens}
        selectedScreen={selectedScreen}
        tool={tool}
        onToolChange={setTool}
        onSelectScreen={setSelectedScreen}
        onCanvasClick={() => setSelectedScreen(null)}
        hasSelectedElement={false}
        selectedElementCanEditText={false}
        selectedElementCanEditDesign={false}
      />
    </main>
  );
}
