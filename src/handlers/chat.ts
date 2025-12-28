import { Context } from 'grammy';
import { store } from '../storage/store.js';
import { chat, chatVision, pick, providerOf, getCompat, getCurrentVoice } from '../services/ai/router.js';
import { histFor, pushHist, applyPromptPrefix } from '../services/ai/history.js';
import { createTGPage } from '../services/telegraph.js';
import { buildChunks, formatQA, footer, escapeAndFormatForTelegram } from '../utils/helpers.js';
import { html, sanitizeUrl, stripCommand } from '../utils/text.js';
import type { ChatMessage } from '../types/ai.js';

async function tryDeleteMessage(ctx: Context, messageId: number): Promise<void> {
  try {
    await ctx.api.deleteMessage(ctx.chat!.id, messageId);
  } catch {
    // Ignore delete failures (message may already be deleted or bot lacks permission)
  }
}

async function sendLong(ctx: Context, text: string, collapse?: boolean, postfix?: string): Promise<void> {
  const chunks = buildChunks(text, collapse, postfix);
  if (chunks.length === 0) return;

  for (const chunk of chunks) {
    await ctx.reply(chunk, { parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
  }
}

export async function handleChat(ctx: Context): Promise<void> {
  const text = stripCommand(ctx.message?.text, 'chat');
  const replyText = ctx.message?.reply_to_message?.text || '';
  const input = text || replyText;

  if (!input) {
    await ctx.reply('❌ 请输入内容或回复一条消息');
    return;
  }

  const m = pick('chat');
  if (!m) {
    await ctx.reply('❌ 未设置 chat 模型，请使用 /model chat <provider> <model>');
    return;
  }

  const p = providerOf(m.provider);
  if (!p) {
    await ctx.reply(`❌ 服务商 ${m.provider} 未配置`);
    return;
  }

  const statusMsg = await ctx.reply('🔄 处理中...');
  const chatId = String(ctx.chat?.id || 'global');

  try {
    const msgs: ChatMessage[] = [];
    if (store.data.contextEnabled) {
      const hist = histFor(chatId);
      msgs.push(...hist.map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content })));
    }

    const userText = applyPromptPrefix('chat', input);
    msgs.push({ role: 'user', content: userText });

    const result = await chat(m.provider, m.model, msgs);

    if (store.data.contextEnabled) {
      pushHist(chatId, 'user', input);
      pushHist(chatId, 'assistant', result.content, result.thought);
      await store.writeSoon();
    }

    const full = formatQA(input, result.content, store.data.collapse);
    const footTxt = footer(m.model);

    if (store.data.telegraph.enabled && store.data.telegraph.limit > 0 && full.length > store.data.telegraph.limit) {
      const url = await createTGPage('AI Response', result.content);
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
    await sendLong(ctx, full, store.data.collapse, footTxt);
  } catch (e: any) {
    await ctx.api.editMessageText(ctx.chat!.id, statusMsg.message_id, `❌ 错误：${html(e?.message || String(e))}`);
  }
}

export async function handleSearch(ctx: Context): Promise<void> {
  const text = stripCommand(ctx.message?.text, 'search');
  const replyText = ctx.message?.reply_to_message?.text || '';
  const input = text || replyText;

  if (!input) {
    await ctx.reply('❌ 请输入搜索内容');
    return;
  }

  const m = pick('search');
  if (!m) {
    await ctx.reply('❌ 未设置 search 模型，请使用 /model search <provider> <model>');
    return;
  }

  const p = providerOf(m.provider);
  if (!p) {
    await ctx.reply(`❌ 服务商 ${m.provider} 未配置`);
    return;
  }

  const statusMsg = await ctx.reply('🔍 搜索中...');
  const chatId = String(ctx.chat?.id || 'global');

  try {
    const msgs: ChatMessage[] = [];
    if (store.data.contextEnabled) {
      const hist = histFor(chatId);
      msgs.push(...hist.map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content })));
    }

    const userText = applyPromptPrefix('search', input);
    msgs.push({ role: 'user', content: userText });

    const result = await chat(m.provider, m.model, msgs, { useSearch: true });

    if (store.data.contextEnabled) {
      pushHist(chatId, 'user', input);
      pushHist(chatId, 'assistant', result.content);
      await store.writeSoon();
    }

    const full = formatQA(input, result.content, store.data.collapse);
    const footTxt = footer(m.model, 'with Search');

    await tryDeleteMessage(ctx, statusMsg.message_id);
    await sendLong(ctx, full, store.data.collapse, footTxt);
  } catch (e: any) {
    await ctx.api.editMessageText(ctx.chat!.id, statusMsg.message_id, `❌ 错误：${html(e?.message || String(e))}`);
  }
}
