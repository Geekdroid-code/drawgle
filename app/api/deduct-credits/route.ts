import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { creditService } from "@/lib/credits"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const credits = Number(body.credits) || 0
    const description = typeof body.description === "string" ? body.description : "Credits deducted"

    if (credits <= 0) {
      return NextResponse.json({ error: "Invalid credit amount" }, { status: 400 })
    }

    const result = await creditService.deductCredits(user.id, credits, description)

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to deduct credits" }, { status: 400 })
    }

    return NextResponse.json({ success: true, newBalance: result.newBalance })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}