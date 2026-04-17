import { GoogleGenAI } from "@google/genai";

export async function POST(req: Request) {
  try {
    const { messages, screenCode } = await req.json();
    
    const apiKey = process.env.MY_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("MY_GEMINI_API_KEY is missing. Please ensure it is set in your AI Studio secrets and restart the dev server.");
    }
    
    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `You are an expert frontend developer modifying an existing HTML/Tailwind UI.
You MUST output ONLY the exact changes using the following XML format:

<edit>
<search>
[EXACT code to be replaced, including indentation]
</search>
<replace>
[New code to insert]
</replace>
</edit>

Rules:
1. You can output multiple <edit> blocks if needed.
2. The <search> block MUST perfectly match the existing code.
3. To add code, include surrounding lines in <search> and <replace>.
4. To delete code, include it in <search> and leave <replace> empty.
5. DO NOT output the entire file. ONLY output the <edit> blocks.
6. If the user asks a general question, you can answer in plain text outside the <edit> blocks.
7. IMPORTANT: Do NOT wrap the UI in a phone frame, device mockup, or add a notch/status bar. The rendering environment already provides a mobile device frame. Your code should just be the app content.`;

    const history = messages.map((m: any) => ({
      role: m.role,
      parts: [{ text: m.content }]
    }));

    const chat = ai.chats.create({
      model: "gemini-3.1-pro-preview",
      history,
      config: {
        systemInstruction,
        temperature: 0.7,
      }
    });

    const responseStream = await chat.sendMessageStream({
      message: `Here is the current code:\n\n\`\`\`html\n${screenCode}\n\`\`\``
    });

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of responseStream) {
            if (chunk.text) {
              controller.enqueue(new TextEncoder().encode(chunk.text));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      }
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain' }
    });
  } catch (error: any) {
    console.error("Edit API Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
