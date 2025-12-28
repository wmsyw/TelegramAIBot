import { Low } from 'lowdb';
import { JSONFilePreset } from 'lowdb/node';
import * as fs from 'fs';
import * as path from 'path';
import { env } from '../config/env.js';
import type { DB } from '../types/store.js';
import { DEFAULT_DB } from '../types/store.js';
import { runMigrations } from './migrations.js';

class Store {
  private static instance: Store;
  private db: Low<DB> | null = null;
  public data: DB = { ...DEFAULT_DB };
  public baseDir: string = '';
  public file: string = '';

  private constructor() {}

  static getInstance(): Store {
    if (!Store.instance) {
      Store.instance = new Store();
    }
    return Store.instance;
  }

  async init(): Promise<void> {
    if (this.db) return;

    this.baseDir = path.resolve(env.DATA_DIR);
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }

    this.file = path.join(this.baseDir, 'config.json');
    this.db = await JSONFilePreset<DB>(this.file, { ...DEFAULT_DB });
    this.data = this.db.data;

    // Initialize whitelist from env
    if (env.ADMIN_IDS.length > 0 && this.data.whitelist.admins.length === 0) {
      this.data.whitelist.admins = [...env.ADMIN_IDS];
      this.data.whitelist.mode = env.WHITELIST_MODE;
    }

    // Initialize providers from env
    this.initProvidersFromEnv();

    // Run migrations
    await runMigrations(this.data);
    await this.write();
  }

  private initProvidersFromEnv(): void {
    if (env.OPENAI_API_KEY && !this.data.providers['openai']) {
      this.data.providers['openai'] = {
        apiKey: env.OPENAI_API_KEY,
        baseUrl: env.OPENAI_BASE_URL.replace(/\/$/, ''),
      };
    }
    if (env.GEMINI_API_KEY && !this.data.providers['gemini']) {
      this.data.providers['gemini'] = {
        apiKey: env.GEMINI_API_KEY,
        baseUrl: env.GEMINI_BASE_URL.replace(/\/$/, ''),
      };
    }
    if (env.CLAUDE_API_KEY && !this.data.providers['claude']) {
      this.data.providers['claude'] = {
        apiKey: env.CLAUDE_API_KEY,
        baseUrl: env.CLAUDE_BASE_URL.replace(/\/$/, ''),
      };
    }
  }

  async write(): Promise<void> {
    if (!this.db) return;
    const tmp = this.file + '.tmp';
    const json = JSON.stringify(this.data, null, 2);
    await fs.promises.writeFile(tmp, json, { encoding: 'utf8' });
    await fs.promises.rename(tmp, this.file);
  }

  private writeTimer: NodeJS.Timeout | null = null;
  async writeSoon(): Promise<void> {
    if (this.writeTimer) clearTimeout(this.writeTimer);
    this.writeTimer = setTimeout(async () => {
      try {
        await this.write();
      } finally {
        this.writeTimer = null;
      }
    }, 300);
  }
}

export const store = Store.getInstance();
