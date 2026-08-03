import "server-only";

import { createOpenAI } from "@ai-sdk/openai";
import { createProviderRegistry } from "ai";

import { env } from "~/env";

const openai = createOpenAI({
  apiKey: env.OPENAI_API_KEY ?? env.OPEN_AI_API_KEY,
});

/** One provider boundary keeps editor actions independent of key vendors. */
const providers = createProviderRegistry({ openai });

export function hasAiTranslationProvider(): boolean {
  return Boolean(env.OPENAI_API_KEY ?? env.OPEN_AI_API_KEY);
}

export function getTranslationModel() {
  if (!hasAiTranslationProvider()) {
    throw new Error("AI translation is not configured");
  }

  return {
    id: `${env.AI_TRANSLATION_PROVIDER}:${env.AI_TRANSLATION_MODEL}`,
    model: providers.languageModel(
      `${env.AI_TRANSLATION_PROVIDER}:${env.AI_TRANSLATION_MODEL}`,
    ),
  };
}

export function getSpeechModel() {
  if (!hasAiTranslationProvider()) {
    throw new Error("AI speech is not configured");
  }
  return providers.speechModel(`openai:${env.AI_SPEECH_MODEL}`);
}
