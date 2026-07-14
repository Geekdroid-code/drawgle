import assert from "node:assert/strict";

import { analyzePromptScreenIntent } from "@/lib/generation/scope-contract";

const prompt = "An AI photo restoration and photo animation app 'BringBack AI'. Inspired by the attached reference UI. Must have 2 step thoughtfully planned onboarding screen, one login/signup screen and 1 home screen.";

const main = async () => {
  const result = await analyzePromptScreenIntent({ prompt });

  assert.equal(result.promptScreenCount, 4);
  assert.deepEqual(result.screens?.map((screen) => screen.name), [
    "Onboarding Step 1",
    "Onboarding Step 2",
    "Login / Signup",
    "Home",
  ]);

  console.log(JSON.stringify(result, null, 2));
};

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
