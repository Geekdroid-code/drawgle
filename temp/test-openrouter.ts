import Module from "module";
// Mock the 'server-only' module so it doesn't throw when running in pure Node.js
const originalRequire = (Module.prototype as any).require;
(Module.prototype as any).require = function (id: string) {
  if (id === "server-only") {
    return {};
  }
  return originalRequire.apply(this, arguments);
};

import * as fs from "fs";
import * as path from "path";

// Manually load env local
function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    let content = fs.readFileSync(envPath, "utf-8");
    if (content.startsWith("\uFEFF")) {
      content = content.slice(1);
    }
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let val = match[2].trim();
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1);
        } else if (val.startsWith("'") && val.endsWith("'")) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    }
  }
}

async function runTest() {
  loadEnvLocal();
  const { generateScreenBuilderContentStream } = await import("../lib/ai/provider");

  console.log("Environment variables loaded.");
  console.log("DRAWGLE_SCREEN_BUILDER_PROVIDER:", process.env.DRAWGLE_SCREEN_BUILDER_PROVIDER);
  console.log("DRAWGLE_SCREEN_BUILDER_MODEL:", process.env.DRAWGLE_SCREEN_BUILDER_MODEL);
  console.log("OPENROUTER_API_KEY present:", !!process.env.OPENROUTER_API_KEY);
  console.log("GEMINI_API_KEY present:", !!process.env.GEMINI_API_KEY);

  console.log("\nStarting streaming completion test...");
  process.env.DRAWGLE_SCREEN_BUILDER_PROVIDER = "gemini";

  try {
    const stream = generateScreenBuilderContentStream({
      task: "chat",
      contents: "Hello, tell me a 1-sentence joke.",
    });

    console.log("Stream response chunks:");
    let fullText = "";
    for await (const chunk of stream) {
      process.stdout.write(chunk);
      fullText += chunk;
    }
    console.log("\n\nTest 1 (Gemini Default) succeeded! Full response length:", fullText.length);
  } catch (error) {
    console.error("Test 1 (Gemini Default) failed with error:", error);
    process.exit(1);
  }

  console.log("\n\nStarting Test 2 (OpenRouter Routing with Mock Key)...");
  process.env.DRAWGLE_SCREEN_BUILDER_PROVIDER = "openrouter";
  process.env.OPENROUTER_API_KEY = "sk-or-v1-mock-key-123";
  process.env.DRAWGLE_SCREEN_BUILDER_MODEL = "qwen/qwen3.6-plus";

  try {
    const stream = generateScreenBuilderContentStream({
      task: "chat",
      contents: "Hello, tell me a 1-sentence joke.",
    });

    console.log("Stream response chunks (expecting 401 Unauthorized from OpenRouter API):");
    let fullText = "";
    for await (const chunk of stream) {
      process.stdout.write(chunk);
      fullText += chunk;
    }
    console.log("\nOpenRouter test completed. Response:", fullText);
  } catch (error: any) {
    console.log("\nOpenRouter call correctly threw an error (expected due to mock key):", error.message || error);
    if (error.message && (error.message.includes("401") || error.message.includes("API key") || error.message.includes("Unauthorized") || error.message.includes("status code") || error.message.includes("User not found"))) {
      console.log("Verification SUCCESS: OpenRouter SDK initiated call to OpenRouter endpoints.");
    } else {
      console.error("Verification FAILED: Unexpected error:", error);
      process.exit(1);
    }
  }

  console.log("\n\nStarting Test 3 (Dual-Model Task-Based Routing)...");
  process.env.DRAWGLE_SCREEN_BUILDER_PROVIDER = "openrouter";
  process.env.DRAWGLE_SCREEN_BUILDER_MODEL = "qwen/qwen3.6-plus";
  process.env.DRAWGLE_SCREEN_EDITOR_MODEL = "deepseek/deepseek-v4-pro";

  const originalFetch = globalThis.fetch;
  const interceptedModels: string[] = [];

  globalThis.fetch = async function (url: any, options: any) {
    const requestObject = url instanceof Request ? url : null;
    const urlStr = requestObject ? requestObject.url : String(url);

    if (urlStr.includes("openrouter.ai")) {
      let modelName = "qwen/qwen3.6-plus";
      try {
        const reqClone = requestObject ? requestObject.clone() : null;
        const bodyText = reqClone ? await reqClone.text() : (options?.body || "");
        const body = JSON.parse(bodyText);
        if (body && body.model) {
          modelName = body.model;
          interceptedModels.push(body.model);
        }
      } catch (e) {}

      const sseData = {
        id: "chatcmpl-123",
        object: "chat.completion.chunk",
        created: 1677652288,
        model: modelName,
        choices: [
          {
            index: 0,
            delta: {
              content: ""
            },
            finish_reason: "stop"
          }
        ]
      };
      const responseBody = `data: ${JSON.stringify(sseData)}\n\ndata: [DONE]\n\n`;
      return new Response(responseBody, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" }
      });
    }
    return originalFetch(url, options);
  } as any;

  try {
    const stream1 = generateScreenBuilderContentStream({
      task: "screen_build",
      contents: "Test build",
    });
    for await (const _ of stream1) {}

    const stream2 = generateScreenBuilderContentStream({
      task: "selected_region_edit",
      contents: "Test edit",
    });
    for await (const _ of stream2) {}

    console.log("Intercepted models:", interceptedModels);
    if (interceptedModels[0] === "qwen/qwen3.6-plus" && interceptedModels[1] === "deepseek/deepseek-v4-pro") {
      console.log("Verification SUCCESS: Correctly routed tasks to builder/editor models!");
    } else {
      console.error("Verification FAILED: Models were not routed correctly. Got:", interceptedModels);
      process.exit(1);
    }
  } catch (err) {
    console.error("Test 3 failed:", err);
    process.exit(1);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

runTest();
