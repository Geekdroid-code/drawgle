import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  const screenId = "ccc34fd3-4fe4-41f4-bc72-1e55bd100bd0";

  console.log("Fetching screen code...");
  const { data: screen, error } = await supabase
    .from("screens")
    .select("code")
    .eq("id", screenId)
    .single();

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("--- SCREEN CODE ---");
  console.log(screen.code);
}

main().catch(console.error);
