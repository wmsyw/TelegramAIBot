import { Context } from 'grammy';
import { store } from '../storage/store.js';
import { html, stripCommand } from '../utils/text.js';
import { listPrompts, setPrompt, deletePrompt } from '../services/ai/history.js';
import type { Models } from '../types/ai.js';

export async function handlePrompt(ctx: Context): Promise<void> {
  const text = stripCommand(ctx.message?.text, 'prompt');
  const lines = text.split('\n');
  const args = lines[0].split(/\s+/).filter(Boolean);
  const sub = (args[0] || '').toLowerCase();

  if (sub === 'add') {
    const name = args[1]?.trim();
    const replyText = ctx.message?.reply_to_message?.text || '';
    const content = replyText || lines.slice(1).join('\n').trim();
    const description = lines[2]?.trim();

    if (!name || !content) {
      await ctx.reply('❌ 用法: 回复模板内容并执行 /prompt add <名称>');
      return;
    }

    setPrompt(name, content, description);
    await store.writeSoon();
    await ctx.reply(`✅ 已保存模板: <code>${html(name)}</code>`, { parse_mode: 'HTML' });
    return;
  }

  if (sub === 'list' || !sub) {
    const temps = listPrompts();
    const textOut = temps.length
      ? temps.map((t) => {
          const head = `<b>${html(t.name)}</b>${t.description ? ` (${html(t.description)})` : ''}`;
          const body = `<blockquote expandable>${html(t.content)}</blockquote>`;
          return `${head}\n${body}`;
        }).join('\n\n')
      : '(空)';

    await ctx.reply(`🧩 <b>模板列表</b>\n\n${textOut}`, { parse_mode: 'HTML' });
    return;
  }

  if (sub === 'del') {
    const name = args[1]?.trim();
    if (!name) {
      await ctx.reply('❌ 用法: /prompt del <名称|all>');
      return;
    }

    if (name === 'all') {
      store.data.prompts = { version: 2, templates: {}, activeByKind: {} };
    } else {
      const ok = deletePrompt(name);
      if (!ok) {
        await ctx.reply('❌ 未找到模板');
        return;
      }
    }

    await store.writeSoon();
    await ctx.reply('✅ 删除完成');
    return;
  }

  if (['chat', 'search', 'image', 'tts'].includes(sub)) {
    const kind = sub as keyof Models;
    const name = args[1]?.trim();

    if (!store.data.prompts) {
      store.data.prompts = { version: 2, templates: {}, activeByKind: {} };
    }

    const act = store.data.prompts.activeByKind || {};

    if (!name) {
      delete (act as any)[kind];
    } else {
      if (!store.data.prompts.templates[name]) {
        await ctx.reply('❌ 未找到模板');
        return;
      }
      (act as any)[kind] = name;
    }

    store.data.prompts.activeByKind = act;
    await store.writeSoon();
    await ctx.reply(`✅ 已设置 <b>${html(kind)}</b> 的 Prompt: <code>${html(name || '(系统)')}</code>`, { parse_mode: 'HTML' });
    return;
  }

  await ctx.reply('❌ 未知子命令。支持: add, list, del, chat|search|image|tts <名称>');
}

export async function handleContext(ctx: Context): Promise<void> {
  const text = stripCommand(ctx.message?.text, 'context');
  const sub = text.toLowerCase();
  const chatId = String(ctx.chat?.id || 'global');

  if (sub === 'on') {
    store.data.contextEnabled = true;
    await store.writeSoon();
    await ctx.reply('✅ 已开启上下文');
    return;
  }

  if (sub === 'off') {
    store.data.contextEnabled = false;
    await store.writeSoon();
    await ctx.reply('✅ 已关闭上下文');
    return;
  }

  if (sub === 'show') {
    const hist = store.data.histories[chatId] || [];
    const t = hist.map((x) => `${x.role}: ${html(x.content)}`).join('\n');
    await ctx.reply(t || '(空)', { parse_mode: 'HTML' });
    return;
  }

  if (sub === 'del') {
    delete store.data.histories[chatId];
    if (store.data.histMeta) delete store.data.histMeta[chatId];
    await store.writeSoon();
    await ctx.reply('✅ 已清空本会话上下文');
    return;
  }

  await ctx.reply(`上下文状态: ${store.data.contextEnabled ? '开启' : '关闭'}\n\n支持: on, off, show, del`);
}
