import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

async function run() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error(".env.local not found");
    return;
  }
  const envContent = fs.readFileSync(envPath, "utf8");
  const env: Record<string, string> = {};
  envContent.split("\n").forEach((line) => {
    const parts = line.split("=");
    if (parts.length >= 2) {
      env[parts[0].trim()] = parts.slice(1).join("=").trim().replace(/^['"]|['"]$/g, "");
    }
  });

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing supabase config in .env.local");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Path to output.txt of step 811 (which contains the original screen codes)
  const backupPath = "C:\\Users\\harva\\.gemini\\antigravity\\brain\\f504cd60-8dff-49f7-9427-5009bfb26d25\\.system_generated\\steps\\811\\output.txt";
  if (!fs.existsSync(backupPath)) {
    console.error("Backup file not found at " + backupPath);
    return;
  }

  const backupContent = fs.readFileSync(backupPath, "utf8");
  
  let resultText = backupContent;
  try {
    const parsed = JSON.parse(backupContent);
    if (parsed && typeof parsed.result === "string") {
      resultText = parsed.result;
    }
  } catch (e) {
    // If it's not a JSON file, we'll try matching directly on raw content
  }
  
  // Extract JSON between <untrusted-data-...> and </untrusted-data-...>
  const match = resultText.match(/<untrusted-data-[a-f0-9-]+>\s*(\[[\s\S]*?\])\s*<\/untrusted-data-[a-f0-9-]+>/i);
  if (!match) {
    console.error("Could not find untrusted data boundaries in backup file.");
    return;
  }

  const jsonStr = match[1].trim();
  const screens = JSON.parse(jsonStr) as Array<{ name: string; code: string }>;

  console.log(`Parsed ${screens.length} screens from backup.`);

  for (const screen of screens) {
    console.log(`Restoring screen code for: ${screen.name} (${screen.code.length} chars)`);
    
    const { error } = await supabase
      .from("screens")
      .update({
        code: screen.code,
        updated_at: new Date().toISOString(),
      })
      .eq("project_id", "8a2fee66-a46a-4957-aeac-33cfeea9e790")
      .eq("name", screen.name);

    if (error) {
      console.error(`Failed to restore screen ${screen.name}: ${error.message}`);
    } else {
      console.log(`Successfully restored screen ${screen.name}.`);
    }
  }

  console.log("Restoration completed successfully!");
}

run().catch(console.error);
