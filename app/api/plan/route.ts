import { planUiFlow } from "@/lib/generation/service";
import { NextResponse } from "next/server";

import type { DesignTokens } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { prompt = "", image = null, designTokens = null } = await req.json();
    const plan = await planUiFlow({ prompt, image, designTokens: designTokens as DesignTokens | null });
    return NextResponse.json(plan);
  } catch (error: any) {
    console.error("Planner API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
