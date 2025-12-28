import type { Provider, ChatMessage, AIResponse, Compat } from '../../types/ai.js';
import { axiosWithRetry } from '../../utils/retry.js';
import { trimBase } from '../../utils/text.js';
import type { AIProvider } from './interface.js';

function buildAuthHeaders(p: Provider): Record<string, string> {
  return { Authorization: `Bearer ${p.apiKey}` };
}

async function tryPostJSON(
  url: string,
  body: any,
  headers: Record<string, string>
): Promise<any> {
  const r = await axiosWithRetry({ method: 'POST', url, data: body, headers });
  return r.data;
}

export const openaiProvider: AIProvider = {
  name: 'openai',

  async chat(
    p: Provider,
    model: string,
    msgs: ChatMessage[],
    options?: { maxTokens?: number; useSearch?: boolean }
  ): Promise<AIResponse> {
    const url = trimBase(p.baseUrl) + '/v1/chat/completions';
    const body: any = {
      model,
      messages: msgs.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: options?.maxTokens || 4096,
    };

    if (options?.useSearch && p.baseUrl?.includes('api.openai.com')) {
      body.tools = [
        {
          type: 'function',
          function: {
            name: 'web_search',
            description: 'Search the web for current information',
            parameters: {
              type: 'object',
              properties: { query: { type: 'string', description: 'Search query' } },
              required: ['query'],
            },
          },
        },
      ];
    }

    const data = await tryPostJSON(url, body, buildAuthHeaders(p));
    return { content: data?.choices?.[0]?.message?.content || '' };
  },

  async chatVision(
    p: Provider,
    model: string,
    mediaData: string,
    mimeType: string,
    prompt?: string
  ): Promise<string> {
    if (mimeType.startsWith('video/')) {
      throw new Error('OpenAI does not support video input');
    }

    const url = trimBase(p.baseUrl) + '/v1/chat/completions';
    const finalPrompt = prompt || 'Describe this image in Chinese';
    const content = [
      { type: 'text', text: finalPrompt },
      { type: 'image_url', image_url: { url: `data:${mimeType};base64,${mediaData}` } },
    ];
    const body = { model, messages: [{ role: 'user', content }] };
    const data = await tryPostJSON(url, body, buildAuthHeaders(p));
    return data?.choices?.[0]?.message?.content || '';
  },

  async generateImage(p: Provider, model: string, prompt: string): Promise<string> {
    const url = trimBase(p.baseUrl) + '/v1/images/generations';
    const body = { model, prompt, n: 1, response_format: 'b64_json', size: '1024x1024' };
    const headers = { ...buildAuthHeaders(p), 'Content-Type': 'application/json' };
    const data = await tryPostJSON(url, body, headers);

    const first = data?.data?.[0] || {};
    const b64 = first?.b64_json || first?.image_base64 || first?.image || '';
    if (b64) return String(b64);

    const urlOut = first?.url || first?.image_url;
    if (urlOut) {
      const r = await axiosWithRetry({ method: 'GET', url: String(urlOut), responseType: 'arraybuffer' });
      const buf = Buffer.isBuffer(r.data) ? r.data : Buffer.from(r.data);
      if (buf.length > 0) return buf.toString('base64');
    }
    return '';
  },

  async tts(
    p: Provider,
    model: string,
    text: string,
    voice?: string
  ): Promise<{ audio?: Buffer; mime?: string }> {
    const base = trimBase(p.baseUrl);
    const paths = ['/v1/audio/speech', '/v1/audio/tts', '/audio/speech'];
    const payload = { model, input: text, voice: voice || 'alloy', format: 'opus' };
    const headers = { ...buildAuthHeaders(p), 'Content-Type': 'application/json' };

    for (const pth of paths) {
      try {
        const r = await axiosWithRetry({
          method: 'POST',
          url: base + pth,
          data: payload,
          responseType: 'arraybuffer',
          headers,
          timeout: 60000,
        });
        const buf = Buffer.isBuffer(r.data) ? r.data : Buffer.from(r.data);
        if (buf.length > 0) return { audio: buf, mime: 'audio/opus' };
      } catch {
        continue;
      }
    }
    throw new Error('TTS failed: no valid audio output');
  },
};

export function detectCompat(_name: string, model: string, _baseUrl: string): Compat {
  const m = (model || '').toLowerCase();
  if (/\bclaude\b|anthropic/.test(m)) return 'claude';
  if (/\bgemini\b|(^gemini-)|image-generation/.test(m)) return 'gemini';
  if (/(^gpt-|gpt-4o|gpt-image|dall-e|^tts-1\b)/.test(m)) return 'openai';
  return 'openai';
}
