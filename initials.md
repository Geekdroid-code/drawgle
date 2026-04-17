app/api/build/route.ts

import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { screenPlan, designTokens, prompt, image, isFirst, requiresBottomNav } = await req.json();

    const apiKey = process.env.MY_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("MY_GEMINI_API_KEY is missing. Please ensure it is set in your AI Studio secrets and restart the dev server.");
    }

    const ai = new GoogleGenAI({ apiKey });

    const coderInstruction = `You are an expert mobile UI designer and frontend developer.
You are building ONE specific screen for a larger app.
Screen Name: ${screenPlan.name}
Screen Type: ${screenPlan.type || (isFirst ? 'root' : 'detail')}
Screen Description: ${screenPlan.description}

CRITICAL INSTRUCTION 1: DESIGN TOKENS
You MUST use the provided Design Tokens for ALL colors, typography, spacing, sizing, radii, and shadows.
Map the token values directly to Tailwind's arbitrary value syntax.
Example: If tokens.color.background.primary is "#111827", use "bg-[#111827]".
Example: If tokens.spacing.md is "16px", use "p-[16px]" or "gap-[16px]".
Example: If tokens.typography.title_large.size is "32px" and weight is "700", use "text-[32px] font-[700]".

DESIGN TOKENS:
${JSON.stringify(designTokens, null, 2)}

CRITICAL INSTRUCTION 2: NAVIGATION ARCHITECTURE
${isFirst && requiresBottomNav
  ? "This is the FIRST/MAIN screen of the generated flow. You MUST include the primary app navigation here (e.g., a Bottom Navigation Bar with 3-4 standard tabs)." 
  : "This is a SECONDARY/DETAIL screen or an app that does not require bottom navigation. You are STRICTLY FORBIDDEN from including a Bottom Navigation Bar. Do not leave empty space at the bottom. If it's a detail screen, you MUST include a Top App Bar with a 'Back' button (e.g., a left-pointing arrow) to show it is a deeper page in the flow."}

RULES:
1. Outermost element MUST be: <div class="w-full min-h-screen bg-[${designTokens?.tokens?.color?.background?.primary || '#ffffff'}] flex flex-col relative overflow-hidden" style="font-family: ${designTokens?.tokens?.typography?.font_family || 'sans-serif'}">
2. Respect mobile safe areas: Add pt-[${designTokens?.tokens?.mobile_layout?.safe_area_top || '44px'}] to the top container and pb-[${designTokens?.tokens?.mobile_layout?.safe_area_bottom || '34px'}] to the bottom container (or bottom nav).
3. Use min-h-[${designTokens?.tokens?.sizing?.min_touch_target || '48px'}] for ALL clickable elements (buttons, links, icon buttons).
4. Use the specific text colors provided in the tokens (e.g., text-[${designTokens?.tokens?.color?.text?.high_emphasis || '#000000'}]).
5. Do NOT wrap the UI in a phone frame or add a status bar.
6. Return ONLY valid HTML code with Tailwind classes. Do NOT wrap in markdown blocks like \`\`\`html.
7. Do NOT include <html>, <head>, or <body> tags. Just the content.
8. Use Lucide icons via standard SVG or assume they are available.`;

    const coderParts: any[] = [];
    if (image) {
      coderParts.push({ inlineData: { data: image.data, mimeType: image.mimeType } });
    }
    coderParts.push({ text: `Build the UI for this screen based on the description: ${screenPlan.description}` });

    const responseStream = await ai.models.generateContentStream({
      model: "gemini-3-flash-preview",
      contents: { parts: coderParts },
      config: {
        systemInstruction: coderInstruction,
        temperature: 0.1,
      }
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of responseStream) {
            if (chunk.text) {
              controller.enqueue(encoder.encode(chunk.text));
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
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });

  } catch (error: any) {
    console.error("Builder API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}



2. app/api/design/route.ts


import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { prompt, image } = await req.json();
    
    const apiKey = process.env.MY_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("MY_GEMINI_API_KEY is missing. Please ensure it is set in your AI Studio secrets and restart the dev server.");
    }
    
    const ai = new GoogleGenAI({ apiKey });

    const designInstruction = `You are an elite Art Director and UI/UX Designer.
Your job is to establish a comprehensive, production-grade Design Token System for a new mobile application based on the user's prompt.
Analyze the requested app's vibe, target audience, and purpose, then output a strict JSON object matching the schema below.
Use precise hex codes, appropriate typography, and standard mobile spacing.

REQUIRED JSON SCHEMA:
{
  "system_schema": "mobile_universal_core",
  "tokens": {
    "color": {
      "background": { "primary": "HEX", "secondary": "HEX" },
      "surface": { "card": "HEX", "bottom_sheet": "HEX", "modal": "HEX" },
      "text": { "high_emphasis": "HEX", "medium_emphasis": "HEX", "low_emphasis": "HEX" },
      "action": { "primary": "HEX", "secondary": "HEX", "disabled": "HEX", "on_primary_text": "HEX" },
      "border": { "divider": "HEX", "focused": "HEX" }
    },
    "typography": {
      "font_family": "CSS font family string",
      "title_large": { "size": "px", "weight": "number", "line_height": "px" },
      "title_main": { "size": "px", "weight": "number", "line_height": "px" },
      "body_primary": { "size": "px", "weight": "number", "line_height": "px" },
      "body_secondary": { "size": "px", "weight": "number", "line_height": "px" },
      "caption": { "size": "px", "weight": "number", "line_height": "px" },
      "button_label": { "size": "px", "weight": "number", "line_height": "px" }
    },
    "spacing": { "none": "0px", "xxs": "4px", "xs": "8px", "sm": "12px", "md": "16px", "lg": "24px", "xl": "32px", "xxl": "48px" },
    "mobile_layout": { "screen_margin": "16px", "safe_area_top": "44px", "safe_area_bottom": "34px", "section_gap": "24px", "element_gap": "16px" },
    "sizing": { "min_touch_target": "48px", "standard_button_height": "48px", "standard_input_height": "48px", "icon_small": "20px", "icon_standard": "24px", "bottom_nav_height": "80px" },
    "radii": { "sharp": "0px", "sm": "4px", "md": "8px", "lg": "12px", "xl": "16px", "pill": "9999px" },
    "border_widths": { "none": "0px", "hairline": "1px", "thin": "2px", "thick": "4px" },
    "shadows": { "none": "none", "sm": "string", "md": "string", "lg": "string", "upward": "string" },
    "opacities": { "transparent": "0", "disabled": "0.38", "scrim_overlay": "0.50", "pressed": "0.12", "opaque": "1" },
    "z_index": { "base": "0", "sticky_header": "10", "bottom_nav": "20", "bottom_sheet": "30", "modal_dialog": "40", "toast_snackbar": "50" }
  }
}

Output ONLY valid JSON.`;

    const parts: any[] = [];
    if (image) {
      parts.push({ inlineData: { data: image.data, mimeType: image.mimeType } });
    }
    if (prompt.trim()) {
      parts.push({ text: `User Prompt: "${prompt}"` });
    } else {
      parts.push({ text: "Create a modern, clean design system for a premium mobile app." });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        systemInstruction: designInstruction,
        responseMimeType: "application/json",
        temperature: 0.3,
      }
    });

    const tokensText = response.text || "{}";
    const tokens = JSON.parse(tokensText);
    return NextResponse.json(tokens);
  } catch (error: any) {
    console.error("Design API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}



3. app/api/edit/route.ts

import { GoogleGenAI } from "@google/genai";

export async function POST(req: Request) {
  try {
    const { messages, screenCode } = await req.json();
    
    const apiKey = process.env.MY_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("MY_GEMINI_API_KEY is missing. Please ensure it is set in your AI Studio secrets and restart the dev server.");
    }
    
    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `You are an expert frontend developer modifying an existing HTML/Tailwind UI.
You MUST output ONLY the exact changes using the following XML format:

<edit>
<search>
[EXACT code to be replaced, including indentation]
</search>
<replace>
[New code to insert]
</replace>
</edit>

Rules:
1. You can output multiple <edit> blocks if needed.
2. The <search> block MUST perfectly match the existing code.
3. To add code, include surrounding lines in <search> and <replace>.
4. To delete code, include it in <search> and leave <replace> empty.
5. DO NOT output the entire file. ONLY output the <edit> blocks.
6. If the user asks a general question, you can answer in plain text outside the <edit> blocks.
7. IMPORTANT: Do NOT wrap the UI in a phone frame, device mockup, or add a notch/status bar. The rendering environment already provides a mobile device frame. Your code should just be the app content.`;

    const history = messages.map((m: any) => ({
      role: m.role,
      parts: [{ text: m.content }]
    }));

    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      history,
      config: {
        systemInstruction,
        temperature: 0.7,
      }
    });

    const responseStream = await chat.sendMessageStream({
      parts: [{ text: `Here is the current code:\n\n\`\`\`html\n${screenCode}\n\`\`\`` }]
    });

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
      headers: { 'Content-Type': 'text/plain' }
    });
  } catch (error: any) {
    console.error("Edit API Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}



4. app/api/plan/route.ts

import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { prompt, image } = await req.json();
    
    const apiKey = process.env.MY_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("MY_GEMINI_API_KEY is missing. Please ensure it is set in your AI Studio secrets and restart the dev server.");
    }
    
    const ai = new GoogleGenAI({ apiKey });

    const plannerInstruction = `You are an expert UX Architect. The user will describe an app, a flow, or a single screen.
Your job is to determine the required screens to fulfill the request.

If the user asks for a specific screen (e.g., "a profile screen") or uploads a single sketch, return 1 screen.
If they ask for a flow or full app (e.g., "onboarding flow", "food delivery app"), return multiple screens (usually 2-4).

Analyze the app concept. If it's a multi-section consumer app (like Instagram or Uber), set requires_bottom_nav to true. If it's a single-purpose utility, an onboarding flow, or a simple dashboard, set requires_bottom_nav to false.

Return strictly valid JSON in this format:
{
  "requires_bottom_nav": true,
  "screens": [
    { 
      "name": "Short Name", 
      "type": "root", // The first screen should ALWAYS be "root". Subsequent screens should be "detail".
      "description": "Detailed instructions for the UI coder on what to build for this specific screen. Include layout, elements, and purpose." 
    }
  ]
}`;

    const plannerParts: any[] = [];
    if (image) {
      plannerParts.push({ inlineData: { data: image.data, mimeType: image.mimeType } });
    }
    if (prompt.trim()) {
      plannerParts.push({ text: `User Prompt: "${prompt}"` });
    } else {
      plannerParts.push({ text: "Convert this sketch into a high-fidelity mobile UI." });
    }

    const plannerResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: plannerParts },
      config: {
        systemInstruction: plannerInstruction,
        responseMimeType: "application/json",
        temperature: 0.2,
      }
    });

    const planText = plannerResponse.text || "{}";
    const plan = JSON.parse(planText);
    return NextResponse.json(plan);
  } catch (error: any) {
    console.error("Planner API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
