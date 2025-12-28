import type { Provider, ChatMessage, AIResponse } from '../../types/ai.js';
import { axiosWithRetry } from '../../utils/retry.js';
import { trimBase } from '../../utils/text.js';
import type { AIProvider } from './interface.js';

async function geminiRequestWithFallback(
  p: Provider,
  path: string,
  axiosConfig: any
): Promise<any> {
  const base = trimBase(p.baseUrl);
  const mkConfigs = () => {
    const cfgKey = { ...axiosConfig, params: { ...axiosConfig.params, key: p.apiKey } };
    const cfgXGoog = { ...axiosConfig, headers: { ...axiosConfig.headers, 'x-goog-api-key': p.apiKey } };
    const cfgAuth = { ...axiosConfig, headers: { ...axiosConfig.headers, Authorization: `Bearer ${p.apiKey}` } };
    return [cfgKey, cfgXGoog, cfgAuth];
  };

  const configs = mkConfigs();
  const paths = [`/v1beta${path}`, `/v1${path}`];
  let lastErr: any;

  for (const suffix of paths) {
    for (const cfg of configs) {
      try {
        const r = await axiosWithRetry({ url: base + suffix, ...cfg });
        return r.data;
      } catch (err: any) {
        lastErr = err;
        const s = err?.response?.status;
        if (s === 404 || s === 405) break;
      }
    }
  }
  throw lastErr;
}

export const geminiProvider: AIProvider = {
  name: 'gemini',

  async chat(
    p: Provider,
    model: string,
    msgs: ChatMessage[],
    options?: { maxTokens?: number; useSearch?: boolean }
  ): Promise<AIResponse> {
    const path = `/models/${encodeURIComponent(model)}:generateContent`;

    const contents = msgs.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    const requestData: any = { contents };
    const tools: any[] = [];

    if (options?.useSearch) {
      tools.push({ google_search: {} });
    }

    const hasUrl = msgs.some((m) => {
      if (m.role !== 'user') return false;
      const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b/;
      return urlRegex.test(m.content);
    });
    if (hasUrl) {
      tools.push({ url_context: {} });
    }

    if (tools.length > 0) {
      requestData.tools = tools;
    }

    if (model.toLowerCase().includes('thinking') || model.toLowerCase().includes('gemini-3')) {
      requestData.generationConfig = {
        thinkingConfig: { includeThoughts: true },
      };
    }

    const data = await geminiRequestWithFallback(p, path, {
      method: 'POST',
      data: requestData,
    });

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const thought = parts.find((x: any) => x.thought_signature)?.thought_signature;
    const text = parts.filter((x: any) => !x.thought).map((x: any) => x.text || '').join('');

    return { content: text, thought };
  },

  async chatVision(
    p: Provider,
    model: string,
    mediaData: string,
    mimeType: string,
    prompt?: string
  ): Promise<string> {
    const path = `/models/${encodeURIComponent(model)}:generateContent`;
    const basePrompt = prompt || (mimeType.startsWith('video/') ? 'Analyze this video' : 'Describe this image in Chinese');

    const data = await geminiRequestWithFallback(p, path, {
      method: 'POST',
      data: {
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType, data: mediaData } },
              { text: basePrompt },
            ],
          },
        ],
      },
    });

    const parts = data?.candidates?.[0]?.content?.parts || [];
    return parts.filter((x: any) => !x.thought).map((x: any) => x.text || '').join('');
  },

  async generateImage(
    p: Provider,
    model: string,
    prompt: string
  ): Promise<Buffer | string> {
    let imageModel = model;
    const lower = model.toLowerCase();
    if (lower === 'gemini-2.5-flash') imageModel = 'gemini-2.5-flash-image';
    if (!imageModel.includes('image') && !imageModel.includes('2.5-flash') && !imageModel.includes('2.0-flash')) {
      imageModel = 'gemini-2.5-flash-image';
    }

    const path = `/models/${encodeURIComponent(imageModel)}:generateContent`;
    const data = await geminiRequestWithFallback(p, path, {
      method: 'POST',
      data: {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      },
    });

    const parts = data?.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      const inline = part?.inlineData || part?.inline_data;
      if (inline?.data) {
        return Buffer.from(inline.data, 'base64');
      }
    }

    const text = parts.map((p: any) => p.text || '').join('');
    return text || '';
  },

  async tts(
    p: Provider,
    model: string,
    text: string,
    voice?: string
  ): Promise<{ audio?: Buffer; mime?: string }> {
    const path = `/models/${encodeURIComponent(model)}:generateContent`;
    const voiceName = voice || 'Kore';

    const payloads = [
      {
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
        },
      },
      {
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: { responseModalities: ['AUDIO'] },
      },
    ];

    for (const payload of payloads) {
      try {
        const data = await geminiRequestWithFallback(p, path, {
          method: 'POST',
          data: payload,
          timeout: 60000,
        });

        const parts = data?.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          const inline = part?.inlineData || part?.inline_data;
          const d = inline?.data;
          const m = inline?.mimeType || inline?.mime_type || 'audio/ogg';
          if (d && String(m).startsWith('audio/')) {
            return { audio: Buffer.from(d, 'base64'), mime: m };
          }
        }
      } catch {
        continue;
      }
    }
    throw new Error('TTS failed: no valid audio output');
  },
};
