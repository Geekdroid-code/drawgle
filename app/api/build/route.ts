import { buildScreenStream } from "@/lib/generation/service";
import { getDesignStylePack, isDesignStyleId } from "@/lib/generation/design-styles";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { screenPlan, designTokens, prompt, image, requiresBottomNav, navigationArchitecture, designStyleId } = body;
    const designStyle = !image && isDesignStyleId(designStyleId) ? getDesignStylePack(designStyleId) : null;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of buildScreenStream({
            screenPlan,
            designTokens,
            designStyle,
            prompt,
            image,
            requiresBottomNav,
            navigationArchitecture,
          })) {
            controller.enqueue(new TextEncoder().encode(chunk));
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
