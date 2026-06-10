import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { sanitizeScreenCodeForSharedNavigation } from "../lib/project-navigation";
import { deriveRequiresBottomNav } from "../lib/navigation";
import type { NavigationPlan, ScreenPlan, ProjectCharter, NavigationArchitecture } from "../lib/types";

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

  console.log("Fetching projects with shared navigation enabled...");
  const { data: navs, error: navError } = await supabase
    .from("project_navigation")
    .select("project_id, plan");

  if (navError) {
    console.error("Failed to fetch project navigation:", navError);
    return;
  }

  console.log(`Found ${navs.length} total project navigation entries.`);

  const activeNavs = navs.filter((nav) => {
    const plan = nav.plan as unknown as NavigationPlan | null;
    return plan && plan.enabled;
  });

  console.log(`Found ${activeNavs.length} projects with shared navigation enabled.`);

  for (const nav of activeNavs) {
    const projectId = nav.project_id;
    const projectNavigationPlan = nav.plan as unknown as NavigationPlan;
    console.log(`\nProcessing project: ${projectId}`);

    // Fetch the project charter to get the navigationArchitecture
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("project_charter")
      .eq("id", projectId)
      .maybeSingle();

    if (projectError || !project) {
      console.warn(`Failed to fetch project charter for ${projectId}`);
      continue;
    }

    const projectCharter = project.project_charter as unknown as ProjectCharter | null;
    const navigationArchitecture = (projectCharter?.navigationArchitecture ?? null) as NavigationArchitecture | null;
    const resolvedRequiresBottomNav = deriveRequiresBottomNav(navigationArchitecture);

    // Fetch all screens in this project
    const { data: screens, error: screensError } = await supabase
      .from("screens")
      .select("id, name, code, chrome_policy, navigation_item_id, prompt")
      .eq("project_id", projectId);

    if (screensError || !screens) {
      console.warn(`Failed to fetch screens for ${projectId}`);
      continue;
    }

    console.log(`Found ${screens.length} screens in project ${projectId}.`);

    for (const screen of screens) {
      const resolvedScreenChrome = projectNavigationPlan.screenChrome?.find(
        (entry) => entry.screenName.toLowerCase() === (screen.name || "").toLowerCase()
      );
      const resolvedNavigationItemId = screen.navigation_item_id ?? resolvedScreenChrome?.navigationItemId ?? null;
      const resolvedIsRoot = resolvedScreenChrome?.chrome === "bottom-tabs" ||
                             (screen.chrome_policy as ScreenPlan["chromePolicy"])?.chrome === "bottom-tabs" ||
                             Boolean(resolvedNavigationItemId) ||
                             (projectNavigationPlan?.items?.some(item => item.linkedScreenName.toLowerCase() === (screen.name || "").toLowerCase()) ?? false);

      const resolvedChromePolicy = (screen.chrome_policy as ScreenPlan["chromePolicy"]) || {
        chrome: resolvedScreenChrome?.chrome ?? (resolvedIsRoot ? (projectNavigationPlan.enabled ? "bottom-tabs" : "top-bar") : "top-bar-back"),
        showPrimaryNavigation: Boolean(resolvedScreenChrome?.navigationItemId),
        showsBackButton: !resolvedIsRoot && resolvedScreenChrome?.chrome !== "modal-sheet",
      };

      const screenPlan: ScreenPlan = {
        name: screen.name || "Screen",
        type: resolvedIsRoot ? "root" : "detail",
        description: screen.prompt || "",
        chromePolicy: resolvedChromePolicy,
        navigationItemId: resolvedNavigationItemId,
      };

      const originalCode = screen.code || "";
      const sanitizedCode = sanitizeScreenCodeForSharedNavigation(originalCode, screenPlan);

      const codeChanged = sanitizedCode !== originalCode;
      const policyChanged = !screen.chrome_policy || screen.navigation_item_id !== resolvedNavigationItemId;

      if (codeChanged || policyChanged) {
        console.log(`  Updating screen: ${screen.name} (${screen.id})`);
        if (codeChanged) {
          console.log(`    - Code sanitized (removed hardcoded local nav/footer).`);
        }
        if (policyChanged) {
          console.log(`    - Chrome policy / Navigation Item ID updated in DB.`);
        }

        const { error: updateError } = await supabase
          .from("screens")
          .update({
            code: sanitizedCode,
            chrome_policy: resolvedChromePolicy as any,
            navigation_item_id: resolvedNavigationItemId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", screen.id);

        if (updateError) {
          console.error(`    FAILED to update screen: ${updateError.message}`);
        } else {
          console.log(`    Successfully updated screen.`);
        }
      }
    }
  }

  console.log("\nCleanup completed successfully!");
}

run().catch(console.error);
