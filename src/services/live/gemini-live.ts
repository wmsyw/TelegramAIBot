import WebSocket from 'ws';
import { EventEmitter } from 'events';

export interface GeminiLiveConfig {
  apiKey: string;
  voiceName?: string;
}

export class GeminiLiveSession extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: GeminiLiveConfig;
  private audioBuffer: Buffer[] = [];
  private audioBufferSize = 0;
  private isSetupComplete = false;
  private static readonly MAX_AUDIO_BUFFER_SIZE = 10 * 1024 * 1024; // 10MB

  constructor(config: GeminiLiveConfig) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    const model = 'gemini-2.5-flash-preview-native-audio-dialog';
    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.config.apiKey}`;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
        this.ws?.close();
      }, 30000);

      this.ws.on('open', () => {
        this.sendSetup(model);
      });

      this.ws.on('message', (data: Buffer) => {
        this.handleMessage(data);
        if (!this.isSetupComplete) {
          this.isSetupComplete = true;
          clearTimeout(timeout);
          resolve();
        }
      });

      this.ws.on('error', (err: Error) => {
        clearTimeout(timeout);
        this.emit('error', err);
        reject(err);
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        clearTimeout(timeout);
        this.emit('close', code, reason?.toString());
      });
    });
  }

  private sendSetup(model: string): void {
    const setup: any = {
      setup: {
        model: `models/${model}`,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: this.config.voiceName ? {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: this.config.voiceName }
            }
          } : undefined
        }
      }
    };

    this.ws?.send(JSON.stringify(setup));
  }

  sendAudio(pcmData: Buffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const CHUNK_SIZE = 3200;
    for (let offset = 0; offset < pcmData.length; offset += CHUNK_SIZE) {
      const chunk = pcmData.subarray(offset, Math.min(offset + CHUNK_SIZE, pcmData.length));
      const message = {
        realtimeInput: {
          mediaChunks: [{
            mimeType: 'audio/pcm;rate=16000',
            data: chunk.toString('base64')
          }]
        }
      };
      this.ws.send(JSON.stringify(message));
    }

    // End of audio stream
    this.ws.send(JSON.stringify({
      clientContent: { turnComplete: true }
    }));
  }

  sendText(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const message = {
      clientContent: {
        turns: [{ role: 'user', parts: [{ text }] }],
        turnComplete: true
      }
    };
    this.ws.send(JSON.stringify(message));
  }

  private handleMessage(data: Buffer): void {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.serverContent?.modelTurn?.parts) {
        for (const part of msg.serverContent.modelTurn.parts) {
          if (part.inlineData?.data) {
            const audioData = Buffer.from(part.inlineData.data, 'base64');
            if (this.audioBufferSize + audioData.length > GeminiLiveSession.MAX_AUDIO_BUFFER_SIZE) {
              this.audioBuffer = [];
              this.audioBufferSize = 0;
              this.emit('error', new Error('Audio buffer overflow'));
              continue;
            }
            this.audioBuffer.push(audioData);
            this.audioBufferSize += audioData.length;
          }
          if (part.text) {
            this.emit('text', part.text);
          }
        }
      }

      if (msg.serverContent?.turnComplete) {
        if (this.audioBuffer.length > 0) {
          const fullAudio = Buffer.concat(this.audioBuffer);
          this.audioBuffer = [];
          this.audioBufferSize = 0;
          this.emit('audio', fullAudio);
        }
        this.emit('turnComplete');
      }

      if (msg.serverContent?.interrupted) {
        this.audioBuffer = [];
        this.audioBufferSize = 0;
        this.emit('interrupted');
      }
    } catch {
      // ignore parse errors
    }
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
    this.audioBuffer = [];
    this.audioBufferSize = 0;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Per-user session manager
const activeSessions = new Map<number, GeminiLiveSession>();

export function getLiveSession(userId: number): GeminiLiveSession | undefined {
  return activeSessions.get(userId);
}

export async function createLiveSession(userId: number, config: GeminiLiveConfig): Promise<GeminiLiveSession> {
  // Close existing
  closeLiveSession(userId);

  const session = new GeminiLiveSession(config);
  session.on('close', () => {
    activeSessions.delete(userId);
  });

  await session.connect();
  activeSessions.set(userId, session);
  return session;
}

export function closeLiveSession(userId: number): void {
  const session = activeSessions.get(userId);
  if (session) {
    session.close();
    activeSessions.delete(userId);
  }
}
