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
Your job is to establish a comprehensive, production-grade Design Token System for a new mobile application based on the user's prompt and/or uploaded images.
Analyze the requested app's vibe, target audience, and purpose, then output a strict JSON object matching the robust schema below.
If the user wants a specific style, extract those exact hex codes and attributes.

REQUIRED JSON SCHEMA:
{
  "system_schema": "mobile_premium_flow",
  "tokens": {
    "color": {
      "background": {
        "primary": "HEX",
        "surface_elevated": "HEX"
      },
      "text": {
        "high_emphasis": "HEX",
        "medium_emphasis": "HEX",
        "low_emphasis": "HEX",
        "action_label": "HEX"
      },
      "action": {
        "primary_gradient_start": "HEX",
        "primary_gradient_end": "HEX",
        "on_surface_white_bg": "HEX",
        "disabled": "HEX"
      },
      "border": {
        "divider": "HEX",
        "focused": "HEX"
      }
    },
    "typography": {
      "font_family": "CSS font family string (e.g. Inter, Space Grotesk)",
      "title_main": { "size": "px", "weight": "number", "line_height": "px" },
      "body_primary": { "size": "px", "weight": "number", "line_height": "px" }
    },
    "spacing": {
      "xxs": "4px",
      "xs": "8px",
      "sm": "12px",
      "md": "16px",
      "lg": "24px",
      "xl": "32px"
    },
    "mobile_layout": {
      "screen_margin": "24px",
      "safe_area_top": "44px",
      "safe_area_bottom": "34px",
      "section_gap": "32px",
      "element_gap": "16px"
    },
    "sizing": {
      "min_touch_target": "48px",
      "button_height_md": "48px",
      "bottom_nav_height": "80px",
      "barcode_height": "56px"
    },
    "radii": {
      "none": "0px",
      "standard": "12px",
      "pill": "9999px"
    },
    "border_widths": {
      "none": "0px",
      "thin": "1px",
      "focused_ring": "2px"
    },
    "elevation": {
      "level_0": "none",
      "level_1": "0 2px 4px 0 rgba(0, 0, 0, 0.2)",
      "level_2": "0 4px 8px 0 rgba(0, 0, 0, 0.3)"
    }
  }
}

Output ONLY valid JSON.`;

    const parts: any[] = [];
    if (image) {
      parts.push({ inlineData: { data: image.data, mimeType: image.mimeType } });
    }
    if (prompt.trim()) {
      parts.push({ text: `User Prompt & Design Constraints: "${prompt}"` });
    } else {
      parts.push({ text: "Create a modern, clean design system for a premium mobile app." });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
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
