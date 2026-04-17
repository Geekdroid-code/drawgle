import "server-only";

import { z } from "zod";

import { createGeminiClient } from "@/lib/ai/gemini";
import { applyEdits } from "@/lib/diff-engine";
import {
  buildSystemInstruction,
  designInstruction,
  editInstruction,
  plannerInstruction,
} from "@/lib/generation/prompts";
import type {
  BuildScreenInput,
  DesignTokens,
  Message,
  PromptImagePayload,
  ScreenPlan,
} from "@/lib/types";

const ScreenPlanSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: z.enum(["root", "detail"]).default("detail"),
  description: z.string().trim().min(1).max(4000),
});

const PlanSchema = z.object({
  requires_bottom_nav: z.boolean().default(false),
  screens: z.array(ScreenPlanSchema).min(1).max(8),
});

const DesignTokensSchema = z
  .object({
    system_schema: z.string().optional(),
    tokens: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const fallbackScreenPlan = (prompt: string): ScreenPlan => ({
  name: "New Screen",
  type: "root",
  description: prompt.trim() || "Convert this concept into a polished mobile screen.",
});

export const getDefaultDesignTokens = (): DesignTokens => ({
  system_schema: "mobile_universal_core",
  tokens: {
    color: {
      background: {
        primary: "#ffffff",
        secondary: "#f9fafb",
      },
      surface: {
        card: "#ffffff",
        bottom_sheet: "#ffffff",
        modal: "#ffffff",
      },
      text: {
        high_emphasis: "#111827",
        medium_emphasis: "#6b7280",
        low_emphasis: "#9ca3af",
      },
      action: {
        primary: "#111827",
        secondary: "#6b7280",
        on_primary_text: "#ffffff",
        disabled: "#e5e7eb",
      },
      border: {
        divider: "#e5e7eb",
        focused: "#111827",
      },
    },
    typography: {
      font_family: "Geist, Inter, sans-serif",
      title_large: {
        size: "32px",
        weight: 700,
        line_height: "40px",
      },
      title_main: {
        size: "28px",
        weight: 700,
        line_height: "32px",
      },
      body_primary: {
        size: "16px",
        weight: 400,
        line_height: "24px",
      },
      body_secondary: {
        size: "14px",
        weight: 400,
        line_height: "20px",
      },
      caption: {
        size: "12px",
        weight: 400,
        line_height: "16px",
      },
      button_label: {
        size: "16px",
        weight: 600,
        line_height: "24px",
      },
    },
    spacing: {
      none: "0px",
      xxs: "4px",
      xs: "8px",
      sm: "12px",
      md: "16px",
      lg: "24px",
      xl: "32px",
      xxl: "48px",
    },
    mobile_layout: {
      screen_margin: "16px",
      safe_area_top: "44px",
      safe_area_bottom: "34px",
      section_gap: "24px",
      element_gap: "16px",
    },
    sizing: {
      min_touch_target: "48px",
      standard_button_height: "48px",
      standard_input_height: "48px",
      icon_small: "20px",
      icon_standard: "24px",
      bottom_nav_height: "80px",
    },
    radii: {
      sharp: "0px",
      sm: "4px",
      md: "8px",
      lg: "12px",
      xl: "16px",
      pill: "9999px",
    },
    border_widths: {
      none: "0px",
      hairline: "1px",
      thin: "2px",
      thick: "4px",
    },
    shadows: {
      none: "none",
      sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
      md: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
      lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
      upward: "0 -4px 6px -1px rgba(0, 0, 0, 0.1)",
    },
    opacities: {
      transparent: "0",
      disabled: "0.38",
      scrim_overlay: "0.50",
      pressed: "0.12",
      opaque: "1",
    },
    z_index: {
      base: "0",
      sticky_header: "10",
      bottom_nav: "20",
      bottom_sheet: "30",
      modal_dialog: "40",
      toast_snackbar: "50",
    },
  },
});

const parseJsonResponse = <T>(text: string): T => {
  const trimmed = text.trim();
  const cleaned = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("The model did not return valid JSON.");
    }

    return JSON.parse(jsonMatch[0]) as T;
  }
};

const toInlineImage = (image?: PromptImagePayload | null) => {
  if (!image) {
    return null;
  }

  return {
    inlineData: {
      data: image.data,
      mimeType: image.mimeType,
    },
  };
};

export const extractCode = (text: string) => {
  const match = text.match(/```(?:html)?\n([\s\S]*?)\n```/i);
  if (match) {
    return match[1].trim();
  }

  return text.replace(/^```html\n/i, "").replace(/\n```$/, "").trim();
};

export async function planUiFlow({
  prompt,
  image,
}: {
  prompt: string;
  image?: PromptImagePayload | null;
}) {
  const ai = createGeminiClient();
  const parts: Array<Record<string, unknown>> = [];

  const inlineImage = toInlineImage(image);
  if (inlineImage) {
    parts.push(inlineImage);
  }

  parts.push({
    text: prompt.trim() ? `User Prompt: "${prompt}"` : "Convert this sketch into a high-fidelity mobile UI.",
  });

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: { parts },
    config: {
      systemInstruction: plannerInstruction,
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });

  const rawPlan = parseJsonResponse<unknown>(response.text || "{}");
  const parsed = PlanSchema.safeParse(rawPlan);

  if (!parsed.success) {
    return {
      requires_bottom_nav: false,
      screens: [fallbackScreenPlan(prompt)],
    };
  }

  return parsed.data;
}

export async function generateDesignTokens({
  prompt,
  image,
}: {
  prompt: string;
  image?: PromptImagePayload | null;
}) {
  const ai = createGeminiClient();
  const parts: Array<Record<string, unknown>> = [];

  const inlineImage = toInlineImage(image);
  if (inlineImage) {
    parts.push(inlineImage);
  }

  parts.push({
    text: prompt.trim()
      ? `User Prompt & Design Constraints: "${prompt}"`
      : "Create a modern, clean design system for a premium mobile app.",
  });

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: { parts },
    config: {
      systemInstruction: designInstruction,
      responseMimeType: "application/json",
      temperature: 0.3,
    },
  });

  const rawTokens = parseJsonResponse<unknown>(response.text || "{}");
  const parsed = DesignTokensSchema.safeParse(rawTokens);

  if (!parsed.success) {
    return getDefaultDesignTokens();
  }

  return parsed.data as DesignTokens;
}

export async function* buildScreenStream(input: BuildScreenInput): AsyncGenerator<string, void, void> {
  const ai = createGeminiClient();
  const parts: Array<Record<string, unknown>> = [];

  const inlineImage = toInlineImage(input.image);
  if (inlineImage) {
    parts.push(inlineImage);
    parts.push({
      text: "Use the uploaded sketch or wireframe for layout inspiration while still honoring the provided design tokens.",
    });
  }

  parts.push({
    text: `Build the UI for ${input.screenPlan.name}. Original context prompt: "${input.prompt || "No overarching prompt provided."}"`,
  });

  const responseStream = await ai.models.generateContentStream({
    model: "gemini-3.1-pro-preview",
    contents: { parts },
    config: {
      systemInstruction: buildSystemInstruction({
        designTokens: input.designTokens,
        screenPlan: input.screenPlan,
        requiresBottomNav: input.requiresBottomNav,
      }),
      temperature: 0.2,
    },
  });

  for await (const chunk of responseStream) {
    if (chunk.text) {
      yield chunk.text;
    }
  }
}

export async function buildScreenCode(input: BuildScreenInput) {
  let rawText = "";

  for await (const chunk of buildScreenStream(input)) {
    rawText += chunk;
  }

  return {
    rawText,
    code: extractCode(rawText),
  };
}

export async function* editScreenStream({
  messages,
  screenCode,
}: {
  messages: Array<Pick<Message, "role" | "content">>;
  screenCode: string;
}) {
  const ai = createGeminiClient();
  const history = messages.map((message) => ({
    role: message.role === "model" ? "model" : "user",
    parts: [{ text: message.content }],
  }));

  const chat = ai.chats.create({
    model: "gemini-3.1-pro-preview",
    history,
    config: {
      systemInstruction: editInstruction,
      temperature: 0.7,
    },
  });

  const responseStream = await chat.sendMessageStream({
    message: `Here is the current code:\n\n\`\`\`html\n${screenCode}\n\`\`\``,
  });

  for await (const chunk of responseStream) {
    if (chunk.text) {
      yield chunk.text;
    }
  }
}

export async function editScreenCode({
  messages,
  screenCode,
}: {
  messages: Array<Pick<Message, "role" | "content">>;
  screenCode: string;
}) {
  let rawText = "";

  for await (const chunk of editScreenStream({ messages, screenCode })) {
    rawText += chunk;
  }

  return {
    rawText,
    code: rawText.includes("<edit>") ? applyEdits(screenCode, rawText) : screenCode,
  };
}