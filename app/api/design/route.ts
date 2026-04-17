import { generateDesignTokens } from "@/lib/generation/service";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { prompt = "", image = null } = await req.json();
    const tokens = await generateDesignTokens({ prompt, image });
    return NextResponse.json(tokens);
  } catch (error: any) {
    console.error("Design API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
