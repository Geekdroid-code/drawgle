import { editScreenStream } from "@/lib/generation/service";
import { createClient } from "@/lib/supabase/server";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { screenId, messages, screenCode } = await req.json();

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
      .select("id")
      .eq("id", screenId)
      .maybeSingle();

    if (screenError || !screen) {
      return NextResponse.json({ error: "Screen not found." }, { status: 404 });
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of editScreenStream({
            messages,
            screenCode,
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
