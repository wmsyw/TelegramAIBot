import type { Provider, ChatMessage, AIResponse } from '../../types/ai.js';
import { axiosWithRetry } from '../../utils/retry.js';
import { trimBase } from '../../utils/text.js';
import type { AIProvider } from './interface.js';

const anthropicVersionCache = new Map<string, string>();

async function getAnthropicVersion(p: Provider): Promise<string> {
  const key = trimBase(p.baseUrl) || 'anthropic';
  const cached = anthropicVersionCache.get(key);
  if (cached) return cached;

  let ver = '2023-06-01';
  const base = trimBase(p.baseUrl);
  try {
    await axiosWithRetry({ method: 'GET', url: base + '/v1/models', headers: { 'x-api-key': p.apiKey } });
  } catch (err: any) {
    const txt = JSON.stringify(err?.response?.data || err?.message || '');
    const matches = txt.match(/\b20\d{2}-\d{2}-\d{2}\b/g);
    if (matches?.length) {
      matches.sort();
      ver = matches[matches.length - 1];
    }
  }
  anthropicVersionCache.set(key, ver);
  return ver;
}

function buildAuthHeaders(p: Provider, ver: string): Record<string, string> {
  return {
    'x-api-key': p.apiKey,
    'anthropic-version': ver,
    'Content-Type': 'application/json',
  };
}

function extractClaudeText(data: any): string {
  if (data?.content && Array.isArray(data.content)) {
    const textBlocks = data.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .filter((text: string) => text?.trim());
    if (textBlocks.length > 0) {
      return textBlocks.join('\n\n');
    }
  }

  const possibleTexts = [
    data?.content?.[0]?.text,
    data?.message?.content?.[0]?.text,
    data?.choices?.[0]?.message?.content,
    data?.response,
    data?.text,
    data?.output,
  ];

  for (const text of possibleTexts) {
    if (typeof text === 'string' && text.trim()) {
      return text.trim();
    }
  }
  return '';
}

export const claudeProvider: AIProvider = {
  name: 'claude',

  async chat(
    p: Provider,
    model: string,
    msgs: ChatMessage[],
    options?: { maxTokens?: number; useSearch?: boolean }
  ): Promise<AIResponse> {
    const url = trimBase(p.baseUrl) + '/v1/messages';
    const body: any = {
      model,
      max_tokens: options?.maxTokens || 4096,
      messages: msgs.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
    };

    if (options?.useSearch && p.baseUrl?.includes('api.anthropic.com')) {
      body.tools = [{ type: 'web_search_20241220', name: 'web_search', max_uses: 3 }];
    }

    const ver = await getAnthropicVersion(p);
    const headers = buildAuthHeaders(p, ver);
    const r = await axiosWithRetry({ method: 'POST', url, data: body, headers });
    return { content: extractClaudeText(r.data) };
  },

  async chatVision(
    p: Provider,
    model: string,
    mediaData: string,
    mimeType: string,
    prompt?: string
  ): Promise<string> {
    if (mimeType.startsWith('video/')) {
      throw new Error('Claude does not support video input');
    }

    const url = trimBase(p.baseUrl) + '/v1/messages';
    const ver = await getAnthropicVersion(p);
    const finalPrompt = prompt || 'Describe this image in Chinese';
    const body = {
      model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: finalPrompt },
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: mediaData } },
          ],
        },
      ],
    };

    const headers = buildAuthHeaders(p, ver);
    const r = await axiosWithRetry({ method: 'POST', url, data: body, headers });
    const blocks = r.data?.content || r.data?.message?.content || [];
    return Array.isArray(blocks)
      ? blocks.map((b: any) => b?.text || b?.content?.[0]?.text || '').join('')
      : '';
  },
};
