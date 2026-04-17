import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { screenPlan, designTokens, prompt, image, isFirst, requiresBottomNav } = body;

    const apiKey = process.env.MY_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("MY_GEMINI_API_KEY is missing. Please ensure it is set in your AI Studio secrets.");
    }

    const ai = new GoogleGenAI({ apiKey });

    // Format Design Tokens dynamically to enforce styles strictly
    const designVariables = designTokens?.tokens ? JSON.stringify(designTokens.tokens, null, 2) : "Use standard Tailwind CSS classes.";

    // Instruction designed to guarantee single-file React/Tailwind/Lucide screen components
    const systemInstruction = `You are a world-class, elite Frontend Architect and UI/UX Designer.
Your task is to generate PRODUCTION-READY, pristine React/Tailwind code for a single mobile screen.

CRITICAL DESIGN SYSTEM MANDATE:
You MUST use these exact design tokens for all colors, typography, and spacing.
Do not use generic Tailwind default colors if a design token exists for that surface/element.
Apply them using Tailwind arbitrary values (e.g. \`bg-[#2E7D32]\`, \`text-[#1B2E1B]\`, \`rounded-[12px]\`) or via direct inline styles where arbitrary classes fail.
If a property is missing, fallback to neutral, premium aesthetics.

=== DESIGN TOKENS ===
${designVariables}
=====================

CORE ENGINEERING RULES:
1. TARGET PLATFORM: Mobile App Screen (~375px wide). The root element MUST be a full-height, full-width mobile container (e.g., \`w-full max-w-md mx-auto min-h-screen bg-[color] text-[color] relative pb-20\`).
2. OUTPUT FORMAT: ONLY output the raw HTML/JSX code wrapped inside a markdown code block (\`\`\`html ... \`\`\`). No preamble, no explanation, no markdown text outside the code block.
3. COMPONENT STRUCTURE: Output standard HTML structured with standard Tailwind classNames.
4. ICONS: You MUST use Lucide icons via standard \`<i>\` tags. Example: \`<i data-lucide="home" class="w-6 h-6"></i>\`. Only use standard known Lucide icon names.
5. INTERACTIVITY: Ensure buttons, active tabs, and clickable elements look visibly tappable (use hover/active states, drop shadows, or distinct token-provided action colors).
6. NAVIGATION: If \`requiresBottomNav\` is true, you MUST include a fixed bottom navigation bar anchored to the bottom of the screen. Keep its z-index high and pad the bottom of the main frame so content isn't obscured.

Screen Specifics:
- Screen Name: ${screenPlan?.name || "App Screen"}
- Screen Type (Role): ${screenPlan?.type || "detail"}
- Requirements: ${screenPlan?.description || "A clean, modern mobile app screen."}
- Bottom Navigation Required: ${requiresBottomNav ? "YES. Output a fixed bottom nav." : "NO. Do not include one."}
`;

    // Build the request parts based on if an image (visual reference) was included
    const parts: any[] = [];
    if (image?.data) {
      parts.push({ 
        inlineData: { 
          data: image.data, 
          mimeType: image.mimeType || "image/jpeg" 
        } 
      });
      parts.push({ text: `Please use this sketch/wireframe as layout inspiration while strictly adhering to the design tokens.` });
    }
    
    parts.push({ 
      text: `Build the UI for: ${screenPlan?.name || 'Screen'}. Original context prompt: "${prompt || 'No overarching prompt provided.'}"` 
    });

    // Stream generation using the most capable available model
    const responseStream = await ai.models.generateContentStream({
      model: "gemini-3.1-pro-preview", // Leveraging highest capability model for detailed UI
      contents: { parts },
      config: {
        systemInstruction,
        temperature: 0.2, // Low temperature for consistent UI scaffolding
      }
    });

    // Stream to chunk response live to the frontend builder agent
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of responseStream) {
            if (chunk.text) {
              controller.enqueue(new TextEncoder().encode(chunk.text));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      },
    });

  } catch (error: any) {
    console.error("Build API Route Error:", error);
    return NextResponse.json({ 
      error: error.message || "An unknown error occurred during code generation." 
    }, { status: 500 });
  }
}
