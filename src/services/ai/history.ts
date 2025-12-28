import { store } from '../../storage/store.js';
import type { Models, PromptTemplate } from '../../types/ai.js';
import {
  HISTORY_GLOBAL_MAX_SESSIONS,
  HISTORY_GLOBAL_MAX_BYTES,
  HISTORY_MAX_ITEMS_PER_SESSION,
  HISTORY_MAX_BYTES_PER_SESSION,
} from '../../config/constants.js';

export function histFor(id: string): Array<{ role: string; content: string; thought?: string }> {
  return store.data.histories[id] || [];
}

function sizeOf(x: { role: string; content: string; thought?: string }): number {
  return Buffer.byteLength(`${x.role}:${x.content}${x.thought || ''}`);
}

function pruneGlobalHistories(): void {
  const ids = Object.keys(store.data.histories || {});
  if (!ids.length) return;

  const meta = store.data.histMeta || {};
  let totalBytes = 0;

  for (const id of ids) {
    if (meta[id]?.bytesUsed !== undefined) {
      totalBytes += meta[id].bytesUsed!;
    } else {
      const bytes = (store.data.histories[id] || []).reduce((t, x) => t + sizeOf(x), 0);
      totalBytes += bytes;
      if (!meta[id]) meta[id] = { lastAt: new Date().toISOString(), bytesUsed: bytes };
      else meta[id].bytesUsed = bytes;
    }
  }

  if (ids.length <= HISTORY_GLOBAL_MAX_SESSIONS && totalBytes <= HISTORY_GLOBAL_MAX_BYTES) return;

  const sorted = ids.sort((a, b) => {
    const ta = Date.parse(meta[a]?.lastAt || '1970-01-01T00:00:00.000Z');
    const tb = Date.parse(meta[b]?.lastAt || '1970-01-01T00:00:00.000Z');
    return ta - tb;
  });

  while ((sorted.length > HISTORY_GLOBAL_MAX_SESSIONS || totalBytes > HISTORY_GLOBAL_MAX_BYTES) && sorted.length) {
    const victim = sorted.shift()!;
    const victimBytes = meta[victim]?.bytesUsed || 0;
    totalBytes -= victimBytes;
    delete store.data.histories[victim];
    if (store.data.histMeta) delete store.data.histMeta[victim];
  }
}

export function pushHist(id: string, role: string, content: string, thought?: string): void {
  if (!store.data.histories[id]) store.data.histories[id] = [];
  const item = { role, content, thought };
  store.data.histories[id].push(item);
  const h = store.data.histories[id];

  const itemSize = sizeOf(item);

  if (!store.data.histMeta) store.data.histMeta = {};
  const meta = store.data.histMeta;

  if (!meta[id]) {
    meta[id] = { lastAt: new Date().toISOString(), bytesUsed: itemSize };
  } else {
    meta[id].lastAt = new Date().toISOString();
    meta[id].bytesUsed = (meta[id].bytesUsed || 0) + itemSize;
  }

  while (h.length > HISTORY_MAX_ITEMS_PER_SESSION) {
    const removed = h.shift()!;
    meta[id].bytesUsed! -= sizeOf(removed);
  }

  while (meta[id].bytesUsed! > HISTORY_MAX_BYTES_PER_SESSION && h.length > 1) {
    const removed = h.shift()!;
    meta[id].bytesUsed! -= sizeOf(removed);
  }

  pruneGlobalHistories();
}

export function clearHistory(id: string): void {
  delete store.data.histories[id];
  if (store.data.histMeta) delete store.data.histMeta[id];
}

export function getPromptByName(name: string): PromptTemplate | null {
  return store.data.prompts?.templates?.[name] || null;
}

export function applyPromptPrefix(kind: keyof Models, input: string): string {
  try {
    const name = store.data.prompts?.activeByKind?.[kind];
    const tmpl = name ? store.data.prompts?.templates?.[name] : undefined;
    return tmpl?.content ? `${tmpl.content}\n\n${input}` : input;
  } catch {
    return input;
  }
}

export function listPrompts(): PromptTemplate[] {
  return Object.values(store.data.prompts?.templates || {});
}

export function setPrompt(name: string, content: string, description?: string): void {
  if (!store.data.prompts) {
    store.data.prompts = { version: 2, templates: {}, activeByKind: {} };
  }
  const now = new Date().toISOString();
  const prev = store.data.prompts.templates[name];
  store.data.prompts.templates[name] = {
    name,
    description,
    content,
    createdAt: prev?.createdAt || now,
    updatedAt: now,
  };
}

export function deletePrompt(name: string): boolean {
  if (store.data.prompts?.templates?.[name]) {
    delete store.data.prompts.templates[name];
    return true;
  }
  return false;
}
