import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  normalizeNavigationPlan,
  renderDeterministicNavigationShell,
  applyNavigationPlanToScreens,
  sanitizeScreenCodeForSharedNavigation,
} from "../lib/project-navigation";
import type { NavigationPlan, ScreenPlan, ProjectCharter, NavigationArchitecture } from "../lib/types";

const TARGET_PROJECT_IDS = [
  "8a2fee66-a46a-4957-aeac-33cfeea9e790",
  "d361b6bc-eefe-4bab-8858-94108070db1a",
];

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

  for (const projectId of TARGET_PROJECT_IDS) {
    console.log(`\n==================================================`);
    console.log(`Processing project: ${projectId}`);
    console.log(`==================================================`);

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
    let navigationArchitecture = (projectCharter?.navigationArchitecture ?? null) as NavigationArchitecture | null;

    if (!navigationArchitecture) {
      console.log("No navigation architecture found. Creating a default bottom-tabs-app architecture.");
      navigationArchitecture = {
        kind: "bottom-tabs-app",
        primaryNavigation: "bottom-tabs",
        rootChrome: "bottom-tabs",
        detailChrome: "top-bar-back",
        consistencyRules: [
          "Keep navigation surfaces in one family: shared spacing, icon sizing, label treatment, radius language, and border or elevation treatment.",
          "Only root screens should own the primary navigation shell unless a brief explicitly defines a shell variant.",
          "Detail screens must clearly expose a back or dismiss affordance.",
        ],
        rationale: "The product spans multiple peer sections, so the primary shell should stay anchored in bottom tabs on root screens.",
      };
    } else {
      // Force architecture kind to bottom-tabs-app and primaryNavigation to bottom-tabs
      navigationArchitecture = {
        ...navigationArchitecture,
        kind: "bottom-tabs-app",
        primaryNavigation: "bottom-tabs",
        rootChrome: "bottom-tabs",
      };
    }

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

    // Fetch existing project navigation entry if any
    const { data: existingNav } = await supabase
      .from("project_navigation")
      .select("id, plan")
      .eq("project_id", projectId)
      .maybeSingle();

    // Map screen rows to ScreenPlan objects, forcing them to be type 'root' since we want bottom tabs on all of them
    const initialScreenPlans: ScreenPlan[] = screens.map((screen) => {
      const existingPolicy = (screen.chrome_policy as ScreenPlan["chromePolicy"]) ?? null;
      return {
        name: screen.name || "Screen",
        type: "root" as const,
        description: screen.prompt || "",
        chromePolicy: existingPolicy ? { ...existingPolicy, chrome: "bottom-tabs" as const } : { chrome: "bottom-tabs" as const, showPrimaryNavigation: true, showsBackButton: false },
        navigationItemId: screen.navigation_item_id || null,
      };
    });

    // Reconstruct the navigation plan
    const newNavigationPlan = normalizeNavigationPlan({
      navigationPlan: existingNav?.plan as unknown as NavigationPlan | null,
      screens: initialScreenPlans,
      navigationArchitecture,
      requiresBottomNav: true,
      strictScreenLinks: false, // Don't restrict links too strictly during recovery
    });

    // Render the deterministic navigation shell
    const shellCode = renderDeterministicNavigationShell(newNavigationPlan);

    console.log("New Navigation Plan:", JSON.stringify(newNavigationPlan, null, 2));

    // Update project_navigation table
    if (existingNav) {
      console.log(`Updating existing project navigation (${existingNav.id})...`);
      const { error: updateNavError } = await supabase
        .from("project_navigation")
        .update({
          plan: newNavigationPlan as any,
          shell_code: shellCode,
          status: "ready",
          error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingNav.id);

      if (updateNavError) {
        console.error(`Failed to update project_navigation: ${updateNavError.message}`);
        continue;
      }
    } else {
      console.log(`Inserting new project navigation...`);
      const { error: insertNavError } = await supabase
        .from("project_navigation")
        .insert({
          project_id: projectId,
          owner_id: project.owner_id || "system",
          plan: newNavigationPlan as any,
          shell_code: shellCode,
          status: "ready",
          error: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (insertNavError) {
        console.error(`Failed to insert project_navigation: ${insertNavError.message}`);
        continue;
      }
    }

    // Apply the navigation plan to screens
    const finalScreenPlans = applyNavigationPlanToScreens(initialScreenPlans, newNavigationPlan);

    // Update each screen in the database
    for (let i = 0; i < screens.length; i++) {
      const screen = screens[i];
      const screenPlan = finalScreenPlans[i];
      
      const originalCode = screen.code || "";
      const sanitizedCode = sanitizeScreenCodeForSharedNavigation(originalCode, screenPlan);

      console.log(`Updating screen: ${screen.name} (${screen.id})`);
      console.log(`  - Original code length: ${originalCode.length}`);
      console.log(`  - Sanitized code length: ${sanitizedCode.length}`);
      console.log(`  - Policy: ${JSON.stringify(screenPlan.chromePolicy)}`);
      console.log(`  - Navigation Item ID: ${screenPlan.navigationItemId}`);

      const { error: updateScreenError } = await supabase
        .from("screens")
        .update({
          code: sanitizedCode,
          chrome_policy: screenPlan.chromePolicy as any,
          navigation_item_id: screenPlan.navigationItemId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", screen.id);

      if (updateScreenError) {
        console.error(`  FAILED to update screen ${screen.name}: ${updateScreenError.message}`);
      } else {
        console.log(`  Successfully updated screen ${screen.name}.`);
      }
    }

    // Also update the project charter to reflect the new navigation architecture
    if (projectCharter) {
      console.log("Updating project charter in projects table...");
      const updatedCharter: ProjectCharter = {
        ...projectCharter,
        navigationArchitecture,
      };

      const { error: updateProjectError } = await supabase
        .from("projects")
        .update({
          project_charter: updatedCharter as any,
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId);

      if (updateProjectError) {
        console.error(`Failed to update project charter: ${updateProjectError.message}`);
      } else {
        console.log("Successfully updated project charter.");
      }
    }
  }

  console.log("\nMigration completed successfully!");
}

run().catch(console.error);
