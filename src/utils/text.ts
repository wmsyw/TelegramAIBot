export const html = (t: string): string =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function stripCommand(text: string | undefined, command: string): string {
  if (!text) return '';
  const escaped = escapeRegExp(command);
  const re = new RegExp(`^/${escaped}(?:@\\w+)?\\s*`, 'i');
  return text.replace(re, '').trim();
}

export const nowISO = (): string => new Date().toISOString();

export const trimBase = (u: string): string => u.replace(/\/$/, '');

export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '#';
    return url.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  } catch {
    return '#';
  }
}

export function shortenUrlForDisplay(u: string): string {
  try {
    const url = new URL(u);
    const host = url.hostname;
    const path = url.pathname && url.pathname !== '/' ? url.pathname : '';
    let text = host + path;
    if (text.length > 60) {
      const head = text.slice(0, 45);
      const tail = text.slice(-10);
      text = head + '…' + tail;
    }
    return text || u;
  } catch {
    return u.length > 60 ? u.slice(0, 45) + '…' + u.slice(-10) : u;
  }
}

export function cleanTextBasic(t: string): string {
  if (!t) return '';
  return t
    .replace(/\uFEFF/g, '')
    .replace(/[\uFFFC\uFFFF\uFFFE]/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[\u200B\u200C\u200D\u2060]/g, '')
    .normalize('NFKC');
}
