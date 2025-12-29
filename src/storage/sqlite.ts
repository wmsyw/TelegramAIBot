import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { env } from '../config/env.js';
import { encrypt, decrypt } from '../utils/crypto.js';

export type SessionMode = 'idle' | 'chat' | 'search' | 'image' | 'tts' | 'audio' | 'live';

export interface UserConfig {
  userId: number;
  collapse: boolean;
  mode: SessionMode;
}

export interface Provider {
  name: string;
  apiKey: string;
  baseUrl: string;
}

export interface ModelConfig {
  provider: string;
  model: string;
}

export interface PromptTemplate {
  name: string;
  content: string;
  description?: string;
}

export interface TelegraphConfig {
  enabled: boolean;
  limit: number;
  token: string;
}

export interface SessionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  thought?: string;
}

class SQLiteStore {
  private static instance: SQLiteStore;
  private db!: Database.Database;
  private cache = new Map<string, any>();
  private readonly CACHE_LIMIT = 2000;
  public baseDir: string = '';

  private constructor() {}

  private getCached<T>(key: string, fetchFn: () => T): T {
    if (this.cache.has(key)) return this.cache.get(key) as T;
    const val = fetchFn();
    if (this.cache.size >= this.CACHE_LIMIT) this.cache.clear();
    this.cache.set(key, val);
    return val;
  }

  private invalidate(keyPrefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(keyPrefix)) this.cache.delete(key);
    }
  }

  static getInstance(): SQLiteStore {
    if (!SQLiteStore.instance) {
      SQLiteStore.instance = new SQLiteStore();
    }
    return SQLiteStore.instance;
  }

  async init(): Promise<void> {
    this.baseDir = path.resolve(env.DATA_DIR);
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }

    this.db = new Database(path.join(this.baseDir, 'bot.sqlite'));
    this.db.pragma('journal_mode = WAL');
    this.runMigrations();
    this.initWhitelist();
  }

  private runMigrations(): void {
    this.db.exec(`
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY,
        collapse INTEGER DEFAULT 0,
        mode TEXT DEFAULT 'idle',
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Per-user providers
      CREATE TABLE IF NOT EXISTS providers (
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        api_key TEXT NOT NULL,
        base_url TEXT NOT NULL,
        PRIMARY KEY (user_id, name)
      );

      -- Per-user models
      CREATE TABLE IF NOT EXISTS models (
        user_id INTEGER NOT NULL,
        kind TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        PRIMARY KEY (user_id, kind)
      );

      -- Per-user voices
      CREATE TABLE IF NOT EXISTS voices (
        user_id INTEGER NOT NULL,
        provider TEXT NOT NULL,
        voice_id TEXT NOT NULL,
        PRIMARY KEY (user_id, provider)
      );

      -- Per-user prompts
      CREATE TABLE IF NOT EXISTS prompts (
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        description TEXT,
        PRIMARY KEY (user_id, name)
      );

      -- Per-user active prompts
      CREATE TABLE IF NOT EXISTS active_prompts (
        user_id INTEGER NOT NULL,
        kind TEXT NOT NULL,
        prompt_name TEXT,
        PRIMARY KEY (user_id, kind)
      );

      -- Per-user telegraph
      CREATE TABLE IF NOT EXISTS telegraph (
        user_id INTEGER PRIMARY KEY,
        enabled INTEGER DEFAULT 0,
        limit_val INTEGER DEFAULT 0,
        token TEXT DEFAULT ''
      );

      -- Session messages (temporary context)
      CREATE TABLE IF NOT EXISTS session_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        thought TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_session_user ON session_messages(user_id);

      -- Global whitelist
      CREATE TABLE IF NOT EXISTS whitelist (
        user_id INTEGER PRIMARY KEY,
        role TEXT NOT NULL CHECK (role IN ('admin','allowed','denied'))
      );

      CREATE TABLE IF NOT EXISTS whitelist_mode (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        mode TEXT DEFAULT 'allow'
      );
    `);
  }

  private initWhitelist(): void {
    const row = this.db.prepare('SELECT * FROM whitelist_mode WHERE id = 1').get() as any;
    if (!row) {
      this.db.prepare("INSERT INTO whitelist_mode (id, mode) VALUES (1, ?)").run(env.WHITELIST_MODE);
    } else if (row.mode !== env.WHITELIST_MODE) {
      this.db.prepare("UPDATE whitelist_mode SET mode = ? WHERE id = 1").run(env.WHITELIST_MODE);
    }
    for (const adminId of env.ADMIN_IDS) {
      this.db.prepare("INSERT OR IGNORE INTO whitelist (user_id, role) VALUES (?, 'admin')").run(adminId);
    }
  }

  // ========== User ==========
  getUser(userId: number): UserConfig {
    return this.getCached(`u:${userId}`, () => {
      const row = this.db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId) as any;
      if (!row) {
        this.db.prepare('INSERT INTO users (user_id) VALUES (?)').run(userId);
        return { userId, collapse: false, mode: 'idle' as SessionMode };
      }
      return { userId, collapse: !!row.collapse, mode: row.mode as SessionMode };
    });
  }

  updateUser(userId: number, updates: Partial<Pick<UserConfig, 'collapse' | 'mode'>>): void {
    this.getUser(userId); // ensure exists
    const sets: string[] = [];
    const vals: any[] = [];
    if (updates.collapse !== undefined) { sets.push('collapse = ?'); vals.push(updates.collapse ? 1 : 0); }
    if (updates.mode !== undefined) { sets.push('mode = ?'); vals.push(updates.mode); }
    if (sets.length === 0) return;
    vals.push(userId);
    this.db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE user_id = ?`).run(...vals);
    this.invalidate(`u:${userId}`);
  }

  // ========== Providers ==========
  getProvider(userId: number, name: string): Provider | null {
    return this.getCached(`p:${userId}:${name}`, () => {
      const row = this.db.prepare('SELECT * FROM providers WHERE user_id = ? AND name = ?').get(userId, name) as any;
      if (!row) return null;
      try {
        return { name: row.name, apiKey: decrypt(row.api_key), baseUrl: row.base_url };
      } catch {
        return { name: row.name, apiKey: row.api_key, baseUrl: row.base_url };
      }
    });
  }

  listProviders(userId: number): Provider[] {
    const rows = this.db.prepare('SELECT * FROM providers WHERE user_id = ?').all(userId) as any[];
    return rows.map(r => {
      try {
        return { name: r.name, apiKey: decrypt(r.api_key), baseUrl: r.base_url };
      } catch {
        return { name: r.name, apiKey: r.api_key, baseUrl: r.base_url };
      }
    });
  }

  setProvider(userId: number, name: string, apiKey: string, baseUrl: string): void {
    this.getUser(userId);
    const encryptedKey = encrypt(apiKey);
    this.db.prepare(`
      INSERT INTO providers (user_id, name, api_key, base_url) VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, name) DO UPDATE SET api_key = excluded.api_key, base_url = excluded.base_url
    `).run(userId, name, encryptedKey, baseUrl);
    this.invalidate(`p:${userId}`);
  }

  deleteProvider(userId: number, name: string): boolean {
    const result = this.db.prepare('DELETE FROM providers WHERE user_id = ? AND name = ?').run(userId, name);
    this.invalidate(`p:${userId}`);
    return result.changes > 0;
  }

  deleteAllProviders(userId: number): void {
    this.db.prepare('DELETE FROM providers WHERE user_id = ?').run(userId);
    this.invalidate(`p:${userId}`);
  }

  // ========== Models ==========
  getModel(userId: number, kind: string): ModelConfig | null {
    return this.getCached(`m:${userId}:${kind}`, () => {
      const row = this.db.prepare('SELECT * FROM models WHERE user_id = ? AND kind = ?').get(userId, kind) as any;
      return row ? { provider: row.provider, model: row.model } : null;
    });
  }

  getAllModels(userId: number): Record<string, string> {
    const rows = this.db.prepare('SELECT * FROM models WHERE user_id = ?').all(userId) as any[];
    const result: Record<string, string> = {};
    for (const r of rows) {
      result[r.kind] = `${r.provider} ${r.model}`;
    }
    return result;
  }

  setModel(userId: number, kind: string, provider: string, model: string): void {
    this.getUser(userId);
    this.db.prepare(`
      INSERT INTO models (user_id, kind, provider, model) VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, kind) DO UPDATE SET provider = excluded.provider, model = excluded.model
    `).run(userId, kind, provider, model);
    this.invalidate(`m:${userId}`);
  }

  // ========== Voices ==========
  getVoice(userId: number, provider: string): string | null {
    return this.getCached(`v:${userId}:${provider}`, () => {
      const row = this.db.prepare('SELECT voice_id FROM voices WHERE user_id = ? AND provider = ?').get(userId, provider) as any;
      return row?.voice_id || null;
    });
  }

  setVoice(userId: number, provider: string, voiceId: string): void {
    this.getUser(userId);
    this.db.prepare(`
      INSERT INTO voices (user_id, provider, voice_id) VALUES (?, ?, ?)
      ON CONFLICT(user_id, provider) DO UPDATE SET voice_id = excluded.voice_id
    `).run(userId, provider, voiceId);
    this.invalidate(`v:${userId}:${provider}`);
  }

  // ========== Prompts ==========
  getPrompt(userId: number, name: string): PromptTemplate | null {
    const row = this.db.prepare('SELECT * FROM prompts WHERE user_id = ? AND name = ?').get(userId, name) as any;
    return row ? { name: row.name, content: row.content, description: row.description } : null;
  }

  listPrompts(userId: number): PromptTemplate[] {
    const rows = this.db.prepare('SELECT * FROM prompts WHERE user_id = ?').all(userId) as any[];
    return rows.map(r => ({ name: r.name, content: r.content, description: r.description }));
  }

  setPrompt(userId: number, name: string, content: string, description?: string): void {
    this.getUser(userId);
    this.db.prepare(`
      INSERT INTO prompts (user_id, name, content, description) VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, name) DO UPDATE SET content = excluded.content, description = excluded.description
    `).run(userId, name, content, description || null);
  }

  deletePrompt(userId: number, name: string): boolean {
    const result = this.db.prepare('DELETE FROM prompts WHERE user_id = ? AND name = ?').run(userId, name);
    this.db.prepare('DELETE FROM active_prompts WHERE user_id = ? AND prompt_name = ?').run(userId, name);
    return result.changes > 0;
  }

  deleteAllPrompts(userId: number): void {
    this.db.prepare('DELETE FROM prompts WHERE user_id = ?').run(userId);
    this.db.prepare('DELETE FROM active_prompts WHERE user_id = ?').run(userId);
  }

  getActivePrompt(userId: number, kind: string): PromptTemplate | null {
    const row = this.db.prepare('SELECT prompt_name FROM active_prompts WHERE user_id = ? AND kind = ?').get(userId, kind) as any;
    if (!row?.prompt_name) return null;
    return this.getPrompt(userId, row.prompt_name);
  }

  setActivePrompt(userId: number, kind: string, promptName: string | null): void {
    if (promptName) {
      this.db.prepare(`
        INSERT INTO active_prompts (user_id, kind, prompt_name) VALUES (?, ?, ?)
        ON CONFLICT(user_id, kind) DO UPDATE SET prompt_name = excluded.prompt_name
      `).run(userId, kind, promptName);
    } else {
      this.db.prepare('DELETE FROM active_prompts WHERE user_id = ? AND kind = ?').run(userId, kind);
    }
  }

  // ========== Telegraph ==========
  getTelegraph(userId: number): TelegraphConfig {
    return this.getCached(`tg:${userId}`, () => {
      const row = this.db.prepare('SELECT * FROM telegraph WHERE user_id = ?').get(userId) as any;
      return row
        ? { enabled: !!row.enabled, limit: row.limit_val, token: row.token || '' }
        : { enabled: false, limit: 0, token: '' };
    });
  }

  setTelegraph(userId: number, config: Partial<TelegraphConfig>): void {
    this.getUser(userId);
    const current = this.getTelegraph(userId);
    const enabled = config.enabled !== undefined ? (config.enabled ? 1 : 0) : (current.enabled ? 1 : 0);
    const limit = config.limit ?? current.limit;
    const token = config.token ?? current.token;
    this.db.prepare(`
      INSERT INTO telegraph (user_id, enabled, limit_val, token) VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET enabled = excluded.enabled, limit_val = excluded.limit_val, token = excluded.token
    `).run(userId, enabled, limit, token);
    this.invalidate(`tg:${userId}`);
  }

  // ========== Session Messages ==========
  getSessionMessages(userId: number): SessionMessage[] {
    const rows = this.db.prepare('SELECT role, content, thought FROM session_messages WHERE user_id = ? ORDER BY id ASC').all(userId) as any[];
    return rows.map(r => ({ role: r.role, content: r.content, thought: r.thought }));
  }

  addSessionMessage(userId: number, role: string, content: string, thought?: string): void {
    this.db.prepare('INSERT INTO session_messages (user_id, role, content, thought) VALUES (?, ?, ?, ?)').run(userId, role, content, thought || null);
  }

  clearSessionMessages(userId: number): void {
    this.db.prepare('DELETE FROM session_messages WHERE user_id = ?').run(userId);
  }

  // ========== Whitelist (Global) ==========
  getWhitelistMode(): 'allow' | 'deny' {
    const row = this.db.prepare('SELECT mode FROM whitelist_mode WHERE id = 1').get() as any;
    return (row?.mode as 'allow' | 'deny') || 'allow';
  }

  setWhitelistMode(mode: 'allow' | 'deny'): void {
    this.db.prepare('UPDATE whitelist_mode SET mode = ? WHERE id = 1').run(mode);
  }

  isAdmin(userId: number): boolean {
    const row = this.db.prepare("SELECT * FROM whitelist WHERE user_id = ? AND role = 'admin'").get(userId);
    return !!row || env.ADMIN_IDS.includes(userId);
  }

  isAllowed(userId: number): boolean {
    const row = this.db.prepare("SELECT * FROM whitelist WHERE user_id = ? AND role = 'allowed'").get(userId);
    return !!row;
  }

  isDenied(userId: number): boolean {
    const row = this.db.prepare("SELECT * FROM whitelist WHERE user_id = ? AND role = 'denied'").get(userId);
    return !!row;
  }

  getWhitelistAdmins(): number[] {
    const rows = this.db.prepare("SELECT user_id FROM whitelist WHERE role = 'admin'").all() as any[];
    return rows.map(r => r.user_id);
  }

  getWhitelistAllowed(): number[] {
    const rows = this.db.prepare("SELECT user_id FROM whitelist WHERE role = 'allowed'").all() as any[];
    return rows.map(r => r.user_id);
  }

  getWhitelistDenied(): number[] {
    const rows = this.db.prepare("SELECT user_id FROM whitelist WHERE role = 'denied'").all() as any[];
    return rows.map(r => r.user_id);
  }

  addToWhitelist(userId: number, role: 'admin' | 'allowed' | 'denied'): void {
    this.db.prepare('DELETE FROM whitelist WHERE user_id = ?').run(userId);
    this.db.prepare('INSERT INTO whitelist (user_id, role) VALUES (?, ?)').run(userId, role);
  }

  removeFromWhitelist(userId: number): void {
    this.db.prepare('DELETE FROM whitelist WHERE user_id = ?').run(userId);
  }
}

export const db = SQLiteStore.getInstance();
