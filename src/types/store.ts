import type { Provider, Models, VoiceConfig, Telegraph, PromptStore, Whitelist, Compat } from './ai.js';

export interface HistoryMeta {
  lastAt: string;
  bytesUsed?: number;
}

export interface HistoryItem {
  role: string;
  content: string;
  thought?: string;
}

export interface DB {
  dataVersion?: number;
  providers: Record<string, Provider>;
  modelCompat?: Record<string, Record<string, Compat>>;
  modelCatalog?: { map: Record<string, Compat>; updatedAt?: string };
  models: Models;
  contextEnabled: boolean;
  collapse: boolean;
  telegraph: Telegraph;
  voices?: VoiceConfig;
  histories: Record<string, HistoryItem[]>;
  histMeta?: Record<string, HistoryMeta>;
  prompts?: PromptStore;
  whitelist: Whitelist;
}

export const DEFAULT_DB: DB = {
  dataVersion: 1,
  providers: {},
  modelCompat: {},
  modelCatalog: { map: {}, updatedAt: undefined },
  models: { chat: '', search: '', image: '', tts: '' },
  contextEnabled: false,
  collapse: false,
  telegraph: { enabled: false, limit: 0, token: '', posts: [] },
  voices: { gemini: 'Kore', openai: 'alloy' },
  histories: {},
  histMeta: {},
  prompts: { version: 2, templates: {}, activeByKind: {} },
  whitelist: { admins: [], allowed: [], denied: [], mode: 'allow' },
};
