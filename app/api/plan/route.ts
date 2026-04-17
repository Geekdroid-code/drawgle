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
      model: "gemini-3.1-pro-preview",
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
