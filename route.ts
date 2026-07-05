import { OpenRouter } from "@openrouter/sdk";

const openrouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const runtime = "nodejs";

interface MessageContent {
  type: "text" | "image";
  text?: string;
  source?: {
    type: "base64";
    media_type: string;
    data: string;
  };
}

interface Message {
  role: "user" | "assistant";
  content: string | MessageContent[];
}

export async function POST(req: Request) {
  try {
    const { messages, thinkingBudget } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Invalid messages format" }),
        { status: 400 }
      );
    }

    // Map thinking budget to effort level
    const thinkingLevel =
      thinkingBudget === "high"
        ? 30000
        : thinkingBudget === "medium"
          ? 15000
          : 5000;

    // Create a ReadableStream for streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await openrouter.chat.send({
            chatRequest: {
              model: "moonshotai/kimi-k2.5",
              messages: messages as Message[],
              max_tokens: 8192,
              temperature: 0.7,
              top_p: 1,
              top_k: 0,
              frequency_penalty: 0,
              presence_penalty: 0,
              thinking: {
                type: "enabled",
                budget_tokens: thinkingLevel,
              },
            } as any,
          });

          // Extract thinking and content from response
          let thinkingContent = "";
          let responseContent = "";

          if (typeof response === "object" && response !== null) {
            // Check for content blocks (thinking + text)
            if ("content" in response && Array.isArray((response as any).content)) {
              const contentBlocks = (response as any).content;
              for (const block of contentBlocks) {
                if (block.type === "thinking") {
                  thinkingContent = block.thinking || "";
                  // Stream thinking in chunks
                  if (thinkingContent) {
                    // Split thinking into smaller chunks for streaming effect
                    const thinkingChunks = thinkingContent.match(/[\s\S]{1,50}/g) || [];
                    for (const chunk of thinkingChunks) {
                      controller.enqueue(
                        new TextEncoder().encode(
                          JSON.stringify({ type: "thinking", data: chunk }) + "\n"
                        )
                      );
                      // Small delay for streaming effect
                      await new Promise(resolve => setTimeout(resolve, 10));
                    }
                  }
                } else if (block.type === "text") {
                  responseContent = block.text || "";
                  // Stream response content in chunks
                  if (responseContent) {
                    const contentChunks = responseContent.match(/[\s\S]{1,50}/g) || [];
                    for (const chunk of contentChunks) {
                      controller.enqueue(
                        new TextEncoder().encode(
                          JSON.stringify({ type: "content", data: chunk }) + "\n"
                        )
                      );
                      await new Promise(resolve => setTimeout(resolve, 10));
                    }
                  }
                }
              }
            }
            // Fallback for choices format
            else if ("choices" in response) {
              const choice = (response as any).choices?.[0];
              if (choice?.message?.content) {
                responseContent = choice.message.content;
                // Stream response in chunks
                const contentChunks = responseContent.match(/[\s\S]{1,50}/g) || [];
                for (const chunk of contentChunks) {
                  controller.enqueue(
                    new TextEncoder().encode(
                      JSON.stringify({ type: "content", data: chunk }) + "\n"
                    )
                  );
                  await new Promise(resolve => setTimeout(resolve, 10));
                }
              }
            }
          }

          // Signal completion
          controller.enqueue(
            new TextEncoder().encode(
              JSON.stringify({ type: "done", data: "" }) + "\n"
            )
          );
          controller.close();
        } catch (error) {
          console.error("[v0] Stream Error:", error);
          controller.enqueue(
            new TextEncoder().encode(
              JSON.stringify({
                type: "error",
                data: error instanceof Error ? error.message : "Unknown error",
              }) + "\n"
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("[v0] API Error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
