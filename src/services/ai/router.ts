import type { Provider, ChatMessage, AIResponse, Compat, Models } from '../../types/ai.js';
import { store } from '../../storage/store.js';
import { openaiProvider, detectCompat } from './openai.js';
import { geminiProvider } from './gemini.js';
import { claudeProvider } from './claude.js';
import type { AIProvider } from './interface.js';

const providers: Record<Compat, AIProvider> = {
  openai: openaiProvider,
  gemini: geminiProvider,
  claude: claudeProvider,
};

export function getCompat(providerName: string, model: string): Compat {
  const ml = model.toLowerCase();
  const catalog = store.data.modelCatalog?.map || {};
  if (catalog[ml]) return catalog[ml];

  const modelCompat = store.data.modelCompat?.[providerName]?.[ml];
  if (modelCompat) return modelCompat;

  const p = store.data.providers[providerName];
  return detectCompat(providerName, model, p?.baseUrl || '');
}

export function pick(kind: keyof Models): { provider: string; model: string } | null {
  const s = store.data.models[kind];
  if (!s) return null;
  const i = s.indexOf(' ');
  if (i <= 0) return null;
  return { provider: s.slice(0, i), model: s.slice(i + 1) };
}

export function providerOf(name: string): Provider | null {
  return store.data.providers[name] || null;
}

export async function chat(
  providerName: string,
  model: string,
  messages: ChatMessage[],
  options?: { maxTokens?: number; useSearch?: boolean }
): Promise<AIResponse> {
  const p = providerOf(providerName);
  if (!p) throw new Error(`Provider ${providerName} not configured`);

  const compat = getCompat(providerName, model);
  const provider = providers[compat];
  return provider.chat(p, model, messages, options);
}

export async function chatVision(
  providerName: string,
  model: string,
  mediaData: string,
  mimeType: string,
  prompt?: string
): Promise<string> {
  const p = providerOf(providerName);
  if (!p) throw new Error(`Provider ${providerName} not configured`);

  const compat = getCompat(providerName, model);
  const provider = providers[compat];

  if (!provider.chatVision) {
    throw new Error(`Provider ${compat} does not support vision`);
  }
  return provider.chatVision(p, model, mediaData, mimeType, prompt);
}

export async function generateImage(
  providerName: string,
  model: string,
  prompt: string
): Promise<Buffer | string> {
  const p = providerOf(providerName);
  if (!p) throw new Error(`Provider ${providerName} not configured`);

  const compat = getCompat(providerName, model);
  const provider = providers[compat];

  if (!provider.generateImage) {
    throw new Error(`Provider ${compat} does not support image generation`);
  }
  return provider.generateImage(p, model, prompt);
}

export async function tts(
  providerName: string,
  model: string,
  text: string,
  voice?: string
): Promise<{ audio?: Buffer; mime?: string }> {
  const p = providerOf(providerName);
  if (!p) throw new Error(`Provider ${providerName} not configured`);

  const compat = getCompat(providerName, model);
  const provider = providers[compat];

  if (!provider.tts) {
    throw new Error(`Provider ${compat} does not support TTS`);
  }
  return provider.tts(p, model, text, voice);
}

export function getCurrentVoice(compat: Compat): string {
  if (!store.data.voices) store.data.voices = { gemini: 'Kore', openai: 'alloy' };
  return compat === 'gemini' ? store.data.voices.gemini : store.data.voices.openai;
}
