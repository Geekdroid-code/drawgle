import "server-only";

import { GoogleGenAI } from "@google/genai";

import { getGeminiApiKey } from "@/lib/env/server";

export const createGeminiClient = () => new GoogleGenAI({ apiKey: getGeminiApiKey() });