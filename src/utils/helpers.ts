import { MAX_MSG, PAGE_EXTRA } from '../config/constants.js';

export function splitMessage(text: string, reserve = 0): string[] {
  const limit = Math.max(1, MAX_MSG - Math.max(0, reserve));
  if (text.length <= limit) return [text];

  const parts: string[] = [];
  let cur = '';

  for (const line of text.split('\n')) {
    if (line.length > limit) {
      if (cur) {
        parts.push(cur);
        cur = '';
      }
      for (let i = 0; i < line.length; i += limit) {
        parts.push(line.slice(i, i + limit));
      }
      continue;
    }
    const next = cur ? cur + '\n' + line : line;
    if (next.length > limit) {
      parts.push(cur);
      cur = line;
    } else {
      cur = next;
    }
  }
  if (cur) parts.push(cur);
  return parts;
}

export function buildChunks(text: string, postfix?: string): string[] {
  const parts = splitMessage(text, PAGE_EXTRA);
  if (parts.length === 0) return [];

  if (parts.length === 1) {
    return [parts[0] + (postfix || '')];
  }

  const total = parts.length;
  const chunks: string[] = [];
  for (let i = 0; i < total; i++) {
    const isLast = i === total - 1;
    const header = `📄 (${i + 1}/${total})\n\n`;
    const body = header + parts[i] + (isLast ? postfix || '' : '');
    chunks.push(body);
  }
  return chunks;
}

export function escapeAndFormatForTelegram(raw: string): string {
  if (!raw) return '';

  const blocks: string[] = [];
  const pushBlock = (text: string): string => {
    blocks.push(text);
    return `\u0000${blocks.length - 1}\u0000`;
  };

  const html = (t: string): string =>
    t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  let text = raw.replace(/```([\w-]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    return pushBlock(`<pre><code class="language-${html(lang || '')}">${html(code)}</code></pre>`);
  });

  text = text.replace(/`([^`]+)`/g, (_, code) => {
    return pushBlock(`<code>${html(code)}</code>`);
  });

  text = html(text);
  text = text.replace(/(\*\*|__)(?=\S)(.+?)(?<=\S)\1/g, '<b>$2</b>');
  text = text.replace(/(\*|_)(?=\S)(.+?)(?<=\S)\1/g, '<i>$2</i>');
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return label;
      const safeUrl = url.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      return `<a href="${safeUrl}">${label}</a>`;
    } catch {
      return label;
    }
  });
  text = text.replace(/^&gt; (.*)$/gm, '<blockquote>$1</blockquote>');
  text = text.replace(/^#+\s+(.*)$/gm, '<b>$1</b>');
  text = text.replace(/\u0000(\d+)\u0000/g, (_, id) => blocks[parseInt(id)]);

  return text;
}

export function formatQA(qRaw: string, aRaw: string, collapse = false): string {
  return escapeAndFormatForTelegram(aRaw);
}

export function footer(model: string, extra?: string): string {
  return '';
}
