import { generateDesignTokens } from "@/lib/generation/service";
import { getDesignStylePack, isDesignStyleId } from "@/lib/generation/design-styles";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { prompt = "", image = null, designStyleId = null } = await req.json();
    const designStyle = !image && isDesignStyleId(designStyleId) ? getDesignStylePack(designStyleId) : null;
    const tokens = await generateDesignTokens({ prompt, image, designStyle });
    return NextResponse.json(tokens);
  } catch (error: any) {
    console.error("Design API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
