import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  const projectId = "c0b59497-ced2-4c01-8c82-61ef79519b12";

  console.log("Fetching project...");
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (projectError) {
    console.error("Project Error:", projectError);
    return;
  }

  console.log("Project Charter:", JSON.stringify(project.project_charter, null, 2));

  console.log("\nFetching screens...");
  const { data: screens, error: screensError } = await supabase
    .from("screens")
    .select("id, name, chrome_policy, navigation_item_id")
    .eq("project_id", projectId);

  if (screensError) {
    console.error("Screens Error:", screensError);
    return;
  }

  console.log("Screens:");
  console.log(JSON.stringify(screens, null, 2));

  console.log("\nFetching navigation...");
  const { data: navigation, error: navigationError } = await supabase
    .from("project_navigation")
    .select("id, plan")
    .eq("project_id", projectId)
    .maybeSingle();

  if (navigationError) {
    console.error("Navigation Error:", navigationError);
    return;
  }

  console.log("Navigation Plan:", JSON.stringify(navigation?.plan, null, 2));
}

main().catch(console.error);
