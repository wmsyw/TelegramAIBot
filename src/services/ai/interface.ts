import type { ChatMessage, AIResponse, Provider } from '../../types/ai.js';

export interface AIProvider {
  name: string;
  chat(
    provider: Provider,
    model: string,
    messages: ChatMessage[],
    options?: { maxTokens?: number; useSearch?: boolean }
  ): Promise<AIResponse>;

  chatVision?(
    provider: Provider,
    model: string,
    mediaData: string,
    mimeType: string,
    prompt?: string
  ): Promise<string>;

  generateImage?(provider: Provider, model: string, prompt: string): Promise<Buffer | string>;

  tts?(
    provider: Provider,
    model: string,
    text: string,
    voice?: string
  ): Promise<{ audio?: Buffer; mime?: string }>;
}
