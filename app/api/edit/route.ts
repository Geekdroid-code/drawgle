import { detectTargetBlocks, indexScreenCode } from "@/lib/generation/block-index";
import { editScreenStream } from "@/lib/generation/service";
import { createClient } from "@/lib/supabase/server";

import { NextResponse } from "next/server";

import type { ScreenBlockIndex } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { screenId, messages, screenCode = "", blockIndex = null } = await req.json();

    if (!screenId) {
      return NextResponse.json({ error: "screenId is required." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: screen, error: screenError } = await supabase
      .from("screens")
      .select("id, owner_id, code, block_index")
      .eq("id", screenId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (screenError || !screen) {
      return NextResponse.json({ error: "Screen not found." }, { status: 404 });
    }

    const latestCode = typeof screen.code === "string" && screen.code.length > 0 ? screen.code : screenCode;
    const latestBlockIndex = ((screen.block_index as ScreenBlockIndex | null) ?? (blockIndex as ScreenBlockIndex | null))
      ?? indexScreenCode(latestCode);
    const latestUserPrompt = [...messages].reverse().find((message: { role?: string }) => message.role === "user")?.content ?? "";
    const resolution = detectTargetBlocks(latestUserPrompt, latestBlockIndex);
    const targetBlockIds = resolution.scope === "scoped" ? resolution.targetBlockIds : [];

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of editScreenStream({
            messages,
            screenCode: latestCode,
            blockIndex: latestBlockIndex,
            targetBlockIds,
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
      headers: { 'Content-Type': 'text/plain' }
    });
  } catch (error: any) {
    console.error("Edit API Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
