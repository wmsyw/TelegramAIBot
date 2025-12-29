import type { ChatMessage, AIResponse, Compat } from '../../types/ai.js';
import type { Provider } from '../../storage/sqlite.js';
import { openaiProvider, detectCompat } from './openai.js';
import { geminiProvider } from './gemini.js';
import { claudeProvider } from './claude.js';
import type { AIProvider } from './interface.js';
import { globalLimiter } from '../../utils/lock.js';

const providers: Record<Compat, AIProvider> = {
  openai: openaiProvider,
  gemini: geminiProvider,
  claude: claudeProvider,
};

export function getCompat(provider: Provider, model: string): Compat {
  return detectCompat(provider.name, model, provider.baseUrl);
}

export async function chat(
  provider: Provider,
  model: string,
  messages: ChatMessage[],
  options?: { maxTokens?: number; useSearch?: boolean }
): Promise<AIResponse> {
  const compat = getCompat(provider, model);
  const p = providers[compat];
  return globalLimiter.run(
    () => p.chat({ apiKey: provider.apiKey, baseUrl: provider.baseUrl }, model, messages, options),
    true
  );
}

export async function chatVision(
  provider: Provider,
  model: string,
  mediaData: string,
  mimeType: string,
  prompt?: string
): Promise<string> {
  const compat = getCompat(provider, model);
  const p = providers[compat];

  if (!p.chatVision) {
    throw new Error(`Provider ${compat} does not support vision`);
  }
  return globalLimiter.run(
    () => p.chatVision!({ apiKey: provider.apiKey, baseUrl: provider.baseUrl }, model, mediaData, mimeType, prompt)
  );
}

export async function generateImage(
  provider: Provider,
  model: string,
  prompt: string
): Promise<Buffer | string> {
  const compat = getCompat(provider, model);
  const p = providers[compat];

  if (!p.generateImage) {
    throw new Error(`Provider ${compat} does not support image generation`);
  }
  return globalLimiter.run(
    () => p.generateImage!({ apiKey: provider.apiKey, baseUrl: provider.baseUrl }, model, prompt)
  );
}

export async function tts(
  provider: Provider,
  model: string,
  text: string,
  voice?: string
): Promise<{ audio?: Buffer; mime?: string }> {
  const compat = getCompat(provider, model);
  const p = providers[compat];

  if (!p.tts) {
    throw new Error(`Provider ${compat} does not support TTS`);
  }
  return globalLimiter.run(
    () => p.tts!({ apiKey: provider.apiKey, baseUrl: provider.baseUrl }, model, text, voice)
  );
}
