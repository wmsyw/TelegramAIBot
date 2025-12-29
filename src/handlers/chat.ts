import { Context, InlineKeyboard } from 'grammy';
import { db } from '../storage/sqlite.js';
import { chat } from '../services/ai/router.js';
import { createTGPage } from '../services/telegraph.js';
import { buildChunks, formatQA, footer } from '../utils/helpers.js';
import { html, sanitizeUrl, stripCommand } from '../utils/text.js';
import { withUserLock } from '../utils/lock.js';
import type { ChatMessage } from '../types/ai.js';

async function tryDeleteMessage(ctx: Context, messageId: number): Promise<void> {
  try {
    await ctx.api.deleteMessage(ctx.chat!.id, messageId);
  } catch {
    // Ignore
  }
}

async function sendLong(ctx: Context, text: string, postfix?: string, keyboard?: InlineKeyboard): Promise<void> {
  const chunks = buildChunks(text, postfix);
  for (let i = 0; i < chunks.length; i++) {
    const isLast = i === chunks.length - 1;
    await ctx.reply(chunks[i], {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: isLast ? keyboard : undefined,
    });
  }
}

export async function processChat(ctx: Context, userId: number, input: string): Promise<void> {
  await withUserLock(userId, () => doProcessChat(ctx, userId, input));
}

async function doProcessChat(ctx: Context, userId: number, input: string): Promise<void> {
  const user = db.getUser(userId);
  // Smart mode switching: auto-switch to chat mode
  if (user.mode !== 'chat') {
    if (user.mode !== 'idle') db.clearSessionMessages(userId);
    db.updateUser(userId, { mode: 'chat' });
  }

  const m = db.getModel(userId, 'chat');
  if (!m) {
    await ctx.reply('❌ 未设置 chat 模型，请使用 /model chat <provider> <model>');
    return;
  }

  const p = db.getProvider(userId, m.provider);
  if (!p) {
    await ctx.reply(`❌ 服务商 ${m.provider} 未配置`);
    return;
  }

  const statusMsg = await ctx.reply('🔄 处理中...');

  try {
    // Build messages from session context
    const history = db.getSessionMessages(userId);
    const msgs: ChatMessage[] = history.map(h => ({ role: h.role, content: h.content }));

    // Apply prompt prefix if set
    const activePrompt = db.getActivePrompt(userId, 'chat');
    const finalInput = activePrompt ? `${activePrompt.content}\n\n${input}` : input;
    msgs.push({ role: 'user', content: finalInput });

    const result = await chat(p, m.model, msgs);

    // Save to session context
    db.addSessionMessage(userId, 'user', input);
    db.addSessionMessage(userId, 'assistant', result.content, result.thought);

    const full = formatQA(input, result.content);
    const footTxt = footer(m.model);

    const telegraph = db.getTelegraph(userId);
    if (telegraph.enabled && telegraph.limit > 0 && full.length > telegraph.limit) {
      const url = await createTGPage('AI Response', result.content, userId);
      if (url) {
        await tryDeleteMessage(ctx, statusMsg.message_id);
        await ctx.reply(`📰 <a href="${sanitizeUrl(url)}">内容较长，已创建 Telegraph</a>${footTxt}`, {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: false },
        });
        return;
      }
    }

    await tryDeleteMessage(ctx, statusMsg.message_id);

    const actionKeyboard = new InlineKeyboard()
      .text('🔄 重试', 'chat:retry')
      .text('🧹 清空', 'chat:clear');

    await sendLong(ctx, full, footTxt, actionKeyboard);
  } catch (e: any) {
    try {
      await ctx.api.editMessageText(ctx.chat!.id, statusMsg.message_id, `❌ 错误：${html(e?.message || String(e))}`);
    } catch {
      await ctx.reply(`❌ 错误：${html(e?.message || String(e))}`);
    }
  }
}

export async function handleChat(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const text = stripCommand(ctx.message?.text, 'chat');
  const replyText = ctx.message?.reply_to_message?.text || '';
  const input = text || replyText;

  if (!input) {
    // Enter chat mode
    const user = db.getUser(userId);
    if (user.mode !== 'chat') db.clearSessionMessages(userId);
    db.updateUser(userId, { mode: 'chat' });
    await ctx.reply('💬 进入对话模式\n直接发送消息即可对话\n使用 /cancel 退出');
    return;
  }

  await processChat(ctx, userId, input);
}

export async function handleChatMessage(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const input = ctx.message?.text;
  if (!input) return;

  await processChat(ctx, userId, input);
}

export async function processSearch(ctx: Context, userId: number, input: string): Promise<void> {
  await withUserLock(userId, () => doProcessSearch(ctx, userId, input));
}

async function doProcessSearch(ctx: Context, userId: number, input: string): Promise<void> {
  const user = db.getUser(userId);
  // Smart mode switching: auto-switch to search mode
  if (user.mode !== 'search') {
    if (user.mode !== 'idle') db.clearSessionMessages(userId);
    db.updateUser(userId, { mode: 'search' });
  }

  const m = db.getModel(userId, 'search');
  if (!m) {
    await ctx.reply('❌ 未设置 search 模型，请使用 /model search <provider> <model>');
    return;
  }

  const p = db.getProvider(userId, m.provider);
  if (!p) {
    await ctx.reply(`❌ 服务商 ${m.provider} 未配置`);
    return;
  }

  const statusMsg = await ctx.reply('🔍 搜索中...');

  try {
    const history = db.getSessionMessages(userId);
    const msgs: ChatMessage[] = history.map(h => ({ role: h.role, content: h.content }));

    const activePrompt = db.getActivePrompt(userId, 'search');
    const finalInput = activePrompt ? `${activePrompt.content}\n\n${input}` : input;
    msgs.push({ role: 'user', content: finalInput });

    const result = await chat(p, m.model, msgs, { useSearch: true });

    db.addSessionMessage(userId, 'user', input);
    db.addSessionMessage(userId, 'assistant', result.content);

    const full = formatQA(input, result.content);
    const footTxt = footer(m.model, 'with Search');

    await tryDeleteMessage(ctx, statusMsg.message_id);

    const actionKeyboard = new InlineKeyboard()
      .text('🔄 重试', 'search:retry')
      .text('🧹 清空', 'search:clear');

    await sendLong(ctx, full, footTxt, actionKeyboard);
  } catch (e: any) {
    try {
      await ctx.api.editMessageText(ctx.chat!.id, statusMsg.message_id, `❌ 错误：${html(e?.message || String(e))}`);
    } catch {
      await ctx.reply(`❌ 错误：${html(e?.message || String(e))}`);
    }
  }
}

export async function handleSearch(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const text = stripCommand(ctx.message?.text, 'search');
  const replyText = ctx.message?.reply_to_message?.text || '';
  const input = text || replyText;

  if (!input) {
    const user = db.getUser(userId);
    if (user.mode !== 'search') db.clearSessionMessages(userId);
    db.updateUser(userId, { mode: 'search' });
    await ctx.reply('🔍 进入搜索模式\n发送关键词开始搜索\n使用 /cancel 退出');
    return;
  }

  await processSearch(ctx, userId, input);
}

export async function handleSearchMessage(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const input = ctx.message?.text;
  if (!input) return;

  await processSearch(ctx, userId, input);
}
