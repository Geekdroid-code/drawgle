import { db } from "@/lib/firebase";
import { doc, setDoc, query, collection, where, getDocs } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";

export const extractCode = (text: string) => {
  const match = text.match(/```(?:html)?\n([\s\S]*?)\n```/);
  if (match) return match[1].trim();
  return text.replace(/^```html\n/, "").replace(/\n```$/, "").trim();
};

export async function runGenerationPipeline({
  prompt,
  projectId,
  userId,
  image,
  designTokens,
  startX = 4800,
  startY = 4600,
  onStatusUpdate
}: {
  prompt: string;
  projectId: string;
  userId: string;
  image?: { data: string; mimeType: string } | null;
  designTokens: any;
  startX?: number;
  startY?: number;
  onStatusUpdate?: (status: string) => void;
}) {
  if (onStatusUpdate) onStatusUpdate("Architect planning layouts...");

  const planRes = await fetch('/api/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, image })
  });
  
  if (!planRes.ok) throw new Error("Failed to generate plan");
  
  const plan = await planRes.json();
  const screens = plan.screens || [{ name: "New Screen", description: prompt || "Convert sketch to UI", type: "root" }];
  const requiresBottomNav = plan.requires_bottom_nav ?? false;

  if (onStatusUpdate) onStatusUpdate("Parallel Coders building screens...");

  const screenPromises = screens.map(async (screenPlan: any, index: number) => {
    const screenId = uuidv4();
    const x = startX + (index * 450); 
    const y = startY;

    try {
      const bgColor = designTokens?.tokens?.color?.background?.primary || "#F3F4F6";
      const textColor = designTokens?.tokens?.color?.text?.high_emphasis || "#111827";
      
      await setDoc(doc(db, "screens", screenId), {
        id: screenId,
        projectId,
        userId: userId,
        name: screenPlan.name || "Generating...",
        code: `<div class="min-h-screen w-full flex flex-col items-center justify-center animate-pulse" style="background-color: ${bgColor}; color: ${textColor};">
          <div class="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mb-4"></div>
          <div class="text-sm font-medium">Building ${screenPlan.name}...</div>
        </div>`,
        prompt: screenPlan.description,
        x,
        y,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Initial setDoc error for screen", index, error);
      return;
    }

    try {
      const buildRes = await fetch('/api/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenPlan,
          designTokens,
          prompt,
          image: index === 0 ? image : null,
          isFirst: index === 0,
          requiresBottomNav
        })
      });

      if (!buildRes.ok) throw new Error("Failed to build screen");
      if (!buildRes.body) throw new Error("No response body");

      const reader = buildRes.body.getReader();
      const decoder = new TextDecoder();
      let fullCode = "";
      let lastUpdateTime = Date.now();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        fullCode += decoder.decode(value, { stream: true });
        
        if (Date.now() - lastUpdateTime > 500) {
          let cleanedCode = extractCode(fullCode);
          try {
            await setDoc(doc(db, "screens", screenId), {
              code: cleanedCode,
              updatedAt: new Date().toISOString(),
            }, { merge: true });
          } catch (e) {
            console.error("Error updating stream:", e);
          }
          lastUpdateTime = Date.now();
        }
      }

      let cleanedCode = extractCode(fullCode);
      await setDoc(doc(db, "screens", screenId), {
        code: cleanedCode,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

    } catch (error: any) {
      console.error(`Generation error for screen ${screenPlan.name}:`, error);
      try {
        await setDoc(doc(db, "screens", screenId), {
          code: `<div class="flex flex-col items-center justify-center h-full text-red-500 p-6 text-center bg-red-50">
            <svg class="w-12 h-12 mb-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            <h3 class="text-lg font-semibold mb-2">Failed to generate UI</h3>
            <p class="text-sm text-red-400 break-words w-full">${error?.message || String(error)}</p>
          </div>`,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      } catch (e) {
        console.error("Error updating error state:", e);
      }
    }
  });

  await Promise.all(screenPromises);
}
