import { axiosWithRetry } from '../utils/retry.js';
import { db } from '../storage/sqlite.js';
import { nowISO } from '../utils/text.js';

function parseTGInline(text: string): any[] {
  if (!text) return [];
  const regex = /(`[^`]+`|\*\*[^\s*](?:[^*]*[^\s*])?\*\*|\*[^\s*](?:[^*]*[^\s*])?\*|\[[^\]]+\]\([^)]+\))/;
  const match = regex.exec(text);
  if (!match) return [text];

  const full = match[0];
  const idx = match.index;
  const before = text.substring(0, idx);
  const after = text.substring(idx + full.length);

  const children: any[] = [];
  if (before) children.push(...parseTGInline(before));

  if (full.startsWith('`')) {
    children.push({ tag: 'code', children: [full.slice(1, -1)] });
  } else if (full.startsWith('**')) {
    children.push({ tag: 'b', children: parseTGInline(full.slice(2, -2)) });
  } else if (full.startsWith('*')) {
    children.push({ tag: 'i', children: parseTGInline(full.slice(1, -1)) });
  } else if (full.startsWith('[')) {
    const m = full.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (m) children.push({ tag: 'a', attrs: { href: m[2] }, children: [m[1]] });
    else children.push(full);
  }

  if (after) children.push(...parseTGInline(after));
  return children;
}

function toNodes(text: string): string {
  const lines = text.split(/\r?\n/);
  const nodes: any[] = [];
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length) {
      nodes.push({ tag: 'p', children: parseTGInline(buffer.join('\n')) });
      buffer = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      flush();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      nodes.push({ tag: 'pre', children: [{ tag: 'code', children: [codeLines.join('\n')] }] });
      continue;
    }

    const hMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (hMatch) {
      flush();
      const level = hMatch[1].length;
      nodes.push({ tag: level <= 2 ? 'h3' : 'h4', children: parseTGInline(hMatch[2]) });
      continue;
    }

    if (line.match(/^[-*]\s/)) {
      flush();
      const items: any[] = [];
      while (i < lines.length && lines[i].match(/^[-*]\s/)) {
        items.push({ tag: 'li', children: parseTGInline(lines[i].replace(/^[-*]\s/, '')) });
        i++;
      }
      i--;
      nodes.push({ tag: 'ul', children: items });
      continue;
    }

    if (line.match(/^\d+\.\s/)) {
      flush();
      const items: any[] = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s/)) {
        items.push({ tag: 'li', children: parseTGInline(lines[i].replace(/^\d+\.\s/, '')) });
        i++;
      }
      i--;
      nodes.push({ tag: 'ol', children: items });
      continue;
    }

    if (line.startsWith('> ')) {
      flush();
      const qLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        qLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      i--;
      nodes.push({ tag: 'blockquote', children: parseTGInline(qLines.join('\n')) });
      continue;
    }

    if (!line.trim()) {
      flush();
      continue;
    }

    buffer.push(line);
  }
  flush();

  return JSON.stringify(nodes);
}

async function ensureTGToken(userId: number): Promise<string> {
  const tg = db.getTelegraph(userId);
  if (tg.token) return tg.token;

  const resp = await axiosWithRetry({
    method: 'POST',
    url: 'https://api.telegra.ph/createAccount',
    params: { short_name: 'TelegramAIBot', author_name: 'AIBot' },
  });

  const t = resp.data?.result?.access_token || '';
  db.setTelegraph(userId, { token: t });
  return t;
}

export async function createTGPage(title: string, text: string, userId?: number): Promise<string | null> {
  try {
    const uid = userId || 0;
    const token = await ensureTGToken(uid);
    if (!token) return null;

    const data = new URLSearchParams();
    data.append('access_token', token);
    data.append('title', title);
    data.append('content', toNodes(text));
    data.append('return_content', 'false');

    const resp = await axiosWithRetry({
      method: 'POST',
      url: 'https://api.telegra.ph/createPage',
      data,
    });

    return resp.data?.result?.url || null;
  } catch (e: any) {
    console.error(`[Telegraph] Create failed: ${e?.message || e}`);
    return null;
  }
}
