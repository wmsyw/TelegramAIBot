import type { DB } from '../types/store.js';

export async function runMigrations(data: DB): Promise<void> {
  const d = data as any;

  if (typeof d.dataVersion !== 'number') d.dataVersion = 1;
  if (!d.providers) d.providers = {};
  if (!d.modelCompat) d.modelCompat = {};
  if (!d.modelCatalog) d.modelCatalog = { map: {}, updatedAt: undefined };
  if (!d.models) d.models = { chat: '', search: '', image: '', tts: '' };
  if (typeof d.contextEnabled !== 'boolean') d.contextEnabled = false;
  if (typeof d.collapse !== 'boolean') d.collapse = false;
  if (!d.telegraph) d.telegraph = { enabled: false, limit: 0, token: '', posts: [] };
  if (!d.voices) d.voices = { gemini: 'Kore', openai: 'alloy' };
  if (!d.histories) d.histories = {};
  if (!d.histMeta) d.histMeta = {};
  if (!d.prompts) d.prompts = { version: 2, templates: {}, activeByKind: {} };
  if (!d.whitelist) d.whitelist = { admins: [], allowed: [], denied: [], mode: 'allow' };

  // Migration v2: ensure histMeta exists
  if (d.dataVersion < 2) {
    d.dataVersion = 2;
  }

  // Migration v3: ensure whitelist structure
  if (d.dataVersion < 3) {
    if (!d.whitelist.admins) d.whitelist.admins = [];
    if (!d.whitelist.allowed) d.whitelist.allowed = [];
    if (!d.whitelist.denied) d.whitelist.denied = [];
    if (!d.whitelist.mode) d.whitelist.mode = 'allow';
    d.dataVersion = 3;
  }

  // Migration v4: ensure voices
  if (d.dataVersion < 4) {
    if (!d.voices) d.voices = { gemini: 'Kore', openai: 'alloy' };
    d.dataVersion = 4;
  }

  // Migration v5: ensure prompts structure
  if (d.dataVersion < 5) {
    if (!d.prompts) d.prompts = { version: 2, templates: {}, activeByKind: {} };
    d.dataVersion = 5;
  }

  console.info(`[Store] Data version: ${d.dataVersion}`);
}
