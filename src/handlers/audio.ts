import { Context } from 'grammy';
import { store } from '../storage/store.js';
import { tts, chat, pick, providerOf, getCompat, getCurrentVoice } from '../services/ai/router.js';
import { applyPromptPrefix, histFor, pushHist } from '../services/ai/history.js';
import { footer } from '../utils/helpers.js';
import { html, stripCommand } from '../utils/text.js';
import { InputFile } from 'grammy';
import type { ChatMessage } from '../types/ai.js';

async function tryDeleteMessage(ctx: Context, messageId: number): Promise<void> {
  try {
    await ctx.api.deleteMessage(ctx.chat!.id, messageId);
  } catch {
    // Ignore delete failures
  }
}

function convertPcmToWav(raw: Buffer, mime?: string): { buf: Buffer; mime: string } {
  let buf = raw;
  let outMime = mime || 'audio/ogg';
  const lm = outMime.toLowerCase();

  if (lm.includes('l16') || lm.includes('pcm')) {
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;

    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + buf.length, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(buf.length, 40);

    buf = Buffer.concat([header, buf]);
    outMime = 'audio/wav';
  }

  return { buf, mime: outMime };
}

export async function handleTTS(ctx: Context): Promise<void> {
  const text = stripCommand(ctx.message?.text, 'tts');
  const replyText = ctx.message?.reply_to_message?.text || '';
  const input = text || replyText;

  if (!input) {
    await ctx.reply('❌ 请输入文本');
    return;
  }

  const m = pick('tts');
  if (!m) {
    await ctx.reply('❌ 未设置 tts 模型，请使用 /model tts <provider> <model>');
    return;
  }

  const p = providerOf(m.provider);
  if (!p) {
    await ctx.reply(`❌ 服务商 ${m.provider} 未配置`);
    return;
  }

  const statusMsg = await ctx.reply('🔊 合成中...');

  try {
    const compat = getCompat(m.provider, m.model);
    const voice = getCurrentVoice(compat);
    const finalText = applyPromptPrefix('tts', input);
    const result = await tts(m.provider, m.model, finalText, voice);

    if (!result.audio) {
      await ctx.api.editMessageText(ctx.chat!.id, statusMsg.message_id, '❌ 语音合成失败：服务无有效输出');
      return;
    }

    await tryDeleteMessage(ctx, statusMsg.message_id);
    const { buf } = convertPcmToWav(result.audio, result.mime);
    await ctx.replyWithVoice(new InputFile(buf, 'audio.ogg'));
  } catch (e: any) {
    await ctx.api.editMessageText(ctx.chat!.id, statusMsg.message_id, `❌ 错误：${html(e?.message || String(e))}`);
  }
}

export async function handleAudio(ctx: Context): Promise<void> {
  const text = stripCommand(ctx.message?.text, 'audio');
  const replyText = ctx.message?.reply_to_message?.text || '';
  const input = text || replyText;

  if (!input) {
    await ctx.reply('❌ 请输入内容');
    return;
  }

  const chatModel = pick('chat');
  const ttsModel = pick('tts');

  if (!chatModel) {
    await ctx.reply('❌ 未设置 chat 模型');
    return;
  }
  if (!ttsModel) {
    await ctx.reply('❌ 未设置 tts 模型');
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

    msgs.push({ role: 'user', content: input });
    const result = await chat(chatModel.provider, chatModel.model, msgs);

    if (store.data.contextEnabled) {
      pushHist(chatId, 'user', input);
      pushHist(chatId, 'assistant', result.content);
      await store.writeSoon();
    }

    await ctx.api.editMessageText(ctx.chat!.id, statusMsg.message_id, '🔊 合成语音中...');

    const compat = getCompat(ttsModel.provider, ttsModel.model);
    const voice = getCurrentVoice(compat);
    const ttsResult = await tts(ttsModel.provider, ttsModel.model, result.content, voice);

    if (!ttsResult.audio) {
      await ctx.api.editMessageText(ctx.chat!.id, statusMsg.message_id, '❌ 语音合成失败');
      return;
    }

    await tryDeleteMessage(ctx, statusMsg.message_id);
    const { buf } = convertPcmToWav(ttsResult.audio, ttsResult.mime);
    await ctx.replyWithVoice(new InputFile(buf, 'audio.ogg'));
  } catch (e: any) {
    await ctx.api.editMessageText(ctx.chat!.id, statusMsg.message_id, `❌ 错误：${html(e?.message || String(e))}`);
  }
}
