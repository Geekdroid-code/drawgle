const fs = require("fs");
const path = require("path");

function sanitizeScreenCodeForSharedNavigation(code, screenPlan) {
  if (!screenPlan.chromePolicy?.showPrimaryNavigation && !screenPlan.navigationItemId) {
    console.log("Returned early from sanitizeScreenCodeForSharedNavigation");
    return code;
  }

  return code
    .replace(/<!--\s*(?:floating\s+dock|bottom\s+nav|navigation)[\s\S]*?placeholder[\s\S]*?-->\s*<div\b[^>]*(?:h-\[[^\]]*(?:8[0-9]|9[0-9]|1[0-9]{2})px\]|height\s*:\s*(?:8[0-9]|9[0-9]|1[0-9]{2})px)[^>]*>\s*<\/div>/gi, "")
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, (match) => {
      const isMatch = /bottom|tab|navigation|nav|data-drawgle-primary-nav/i.test(match);
      console.log("Found nav match, isMatch to strip:", isMatch, "snippet:", match.substring(0, 100));
      return isMatch ? "" : match;
    })
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, (match) => {
      const isMatch = /bottom|tab|navigation|nav/i.test(match);
      console.log("Found footer match, isMatch to strip:", isMatch);
      return isMatch ? "" : match;
    })
    .trim();
}

async function run() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error(".env.local not found");
    return;
  }
  const envContent = fs.readFileSync(envPath, "utf8");
  const env = {};
  envContent.split("\n").forEach(line => {
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

  const screenId = "e68df1a6-6fe1-4718-bf0e-56219f6b3953";
  const url = `${supabaseUrl}/rest/v1/screens?id=eq.${screenId}&select=code,chrome_policy,navigation_item_id`;
  
  const res = await fetch(url, {
    headers: {
      "apikey": supabaseKey,
      "Authorization": `Bearer ${supabaseKey}`
    }
  });
  
  if (!res.ok) {
    console.error("Fetch failed:", res.status, await res.text());
    return;
  }
  
  const data = await res.json();
  if (!data || data.length === 0) {
    console.error("No screen found");
    return;
  }
  
  const screen = data[0];
  const screenPlan = {
    chromePolicy: screen.chrome_policy,
    navigationItemId: screen.navigation_item_id
  };
  
  console.log("ScreenPlan:", screenPlan);
  console.log("Code length:", screen.code.length);
  
  const sanitized = sanitizeScreenCodeForSharedNavigation(screen.code, screenPlan);
  console.log("Sanitized code contains nav:", sanitized.includes("<nav"));
}

run();
