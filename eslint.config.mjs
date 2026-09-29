import { defineConfig } from "eslint/config";
import next from "eslint-config-next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig([
  {
    ignores: ["exported/**", "scripts/**", "scratch/**", ".next/**", ".trigger/tmp/**", "node_modules/**", "new-landing-idea/**"]
  },
  {
    extends: [...next],
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["error", {
        selector: "CallExpression[callee.name=/^map[A-Za-z]+Row$/] MemberExpression[object.name='payload'][property.name='new']",
        message: "Realtime UPDATE records omit unchanged large columns, so mapping payload.new as a whole row nulls them (this erased design tokens on the canvas). Merge it with mergeRealtimeRecord from lib/supabase/realtime-patch.ts.",
      }],
    },
  },
]);
