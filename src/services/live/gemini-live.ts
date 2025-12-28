import { GoogleGenAI, Modality } from '@google/genai';

export interface GeminiLiveConfig {
  apiKey: string;
  voiceName?: string;
  proxyUrl?: string;
}

const AUDIO_CONFIG = {
  INPUT_SAMPLE_RATE: 16000,
  OUTPUT_SAMPLE_RATE: 24000,
  CHUNK_SIZE: 3200,
};

export async function processWithGeminiLive(
  config: GeminiLiveConfig,
  pcmData: Buffer
): Promise<Buffer> {
  if (config.proxyUrl) {
    process.env.HTTPS_PROXY = config.proxyUrl;
    process.env.HTTP_PROXY = config.proxyUrl;
    process.env.ALL_PROXY = config.proxyUrl;
  }

  const client = new GoogleGenAI({ apiKey: config.apiKey });
  const model = 'gemini-2.5-flash-native-audio-preview-09-2025';

  const sessionConfig: any = {
    responseModalities: [Modality.AUDIO],
    tools: [{ googleSearch: {} }]
  };

  if (config.voiceName) {
    sessionConfig.speechConfig = {
      voiceConfig: {
        prebuiltVoiceConfig: { voiceName: config.voiceName }
      }
    };
  }

  const responseChunks: Buffer[] = [];
  let openResolver: () => void;
  const openPromise = new Promise<void>((resolve) => { openResolver = resolve; });

  return new Promise(async (resolve, reject) => {
    try {
      const session = await client.live.connect({
        model,
        config: sessionConfig,
        callbacks: {
          onopen: () => openResolver(),
          onmessage: (message: any) => {
            if (message.serverContent?.modelTurn?.parts) {
              for (const part of message.serverContent.modelTurn.parts) {
                if (part.inlineData?.data) {
                  if (typeof part.inlineData.data === 'string') {
                    responseChunks.push(Buffer.from(part.inlineData.data, 'base64'));
                  } else if (part.inlineData.data instanceof Uint8Array) {
                    responseChunks.push(Buffer.from(part.inlineData.data));
                  }
                }
              }
            }
            if (message.serverContent?.turnComplete) {
              resolve(Buffer.concat(responseChunks));
              session.close();
            }
          },
          onclose: (e: any) => {
            const code = typeof e?.code === 'number' ? e.code : undefined;
            const reason = typeof e?.reason === 'string' ? e.reason : (typeof e?.message === 'string' ? e.message : '');
            if (code === 1007 || /location is not supported/i.test(String(reason))) {
              reject(new Error('当前网络不支持 Gemini Live，请设置代理'));
              return;
            }
            resolve(Buffer.concat(responseChunks));
          },
          onerror: (e: any) => {
            const reason = typeof e?.message === 'string' ? e.message : String(e);
            console.error('[GeminiLive] Error:', reason);
            reject(new Error(`Gemini Live 错误: ${reason}`));
          }
        }
      });

      await openPromise;

      let offset = 0;
      while (offset < pcmData.length) {
        const end = Math.min(offset + AUDIO_CONFIG.CHUNK_SIZE, pcmData.length);
        const chunk = pcmData.subarray(offset, end);
        await session.sendRealtimeInput({
          audio: {
            mimeType: `audio/pcm;rate=${AUDIO_CONFIG.INPUT_SAMPLE_RATE}`,
            data: chunk.toString('base64')
          }
        });
        offset = end;
      }
      await session.sendRealtimeInput({ audioStreamEnd: true });

    } catch (error: any) {
      console.error('[GeminiLive] Connection error:', error.message);
      reject(error);
    }
  });
}
