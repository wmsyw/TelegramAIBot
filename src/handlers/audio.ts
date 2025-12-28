import { Context } from 'grammy';
import { InputFile } from 'grammy';
import { db } from '../storage/sqlite.js';
import { tts, chat, getCompat } from '../services/ai/router.js';
import { footer } from '../utils/helpers.js';
import { html, stripCommand } from '../utils/text.js';
import { withUserLock } from '../utils/lock.js';
import type { ChatMessage } from '../types/ai.js';

async function tryDeleteMessage(ctx: Context, messageId: number): Promise<void> {
  try {
    await ctx.api.deleteMessage(ctx.chat!.id, messageId);
  } catch {
    // Ignore
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

async function processTTS(ctx: Context, userId: number, input: string): Promise<void> {
  const user = db.getUser(userId);
  if (user.mode !== 'idle' && user.mode !== 'tts') {
    await ctx.reply('❌ 请先使用 /cancel 退出当前模式');
    return;
  }

  const m = db.getModel(userId, 'tts');
  if (!m) {
    await ctx.reply('❌ 未设置 tts 模型，请使用 /model tts <provider> <model>');
    return;
  }

  const p = db.getProvider(userId, m.provider);
  if (!p) {
    await ctx.reply(`❌ 服务商 ${m.provider} 未配置`);
    return;
  }

  const statusMsg = await ctx.reply('🔊 合成中...');

  try {
    const compat = getCompat(p, m.model);
    const voiceId = db.getVoice(userId, compat) || (compat === 'gemini' ? 'Kore' : 'alloy');

    const activePrompt = db.getActivePrompt(userId, 'tts');
    const finalText = activePrompt ? `${activePrompt.content}\n\n${input}` : input;
    const result = await tts(p, m.model, finalText, voiceId);

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

export async function handleTTS(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const text = stripCommand(ctx.message?.text, 'tts');
  const replyText = ctx.message?.reply_to_message?.text || '';
  const input = text || replyText;

  if (!input) {
    const user = db.getUser(userId);
    if (user.mode !== 'idle') {
      await ctx.reply('❌ 请先使用 /cancel 退出当前模式');
      return;
    }
    db.clearSessionMessages(userId);
    db.updateUser(userId, { mode: 'tts' });
    await ctx.reply('🔊 进入语音合成模式\n发送文本转语音\n使用 /cancel 退出');
    return;
  }

  await processTTS(ctx, userId, input);
}

export async function handleTTSMessage(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const input = ctx.message?.text;
  if (!input) return;

  await processTTS(ctx, userId, input);
}

async function processAudio(ctx: Context, userId: number, input: string): Promise<void> {
  await withUserLock(userId, () => doProcessAudio(ctx, userId, input));
}

async function doProcessAudio(ctx: Context, userId: number, input: string): Promise<void> {
  const user = db.getUser(userId);
  if (user.mode !== 'idle' && user.mode !== 'audio') {
    await ctx.reply('❌ 请先使用 /cancel 退出当前模式');
    return;
  }

  const chatModel = db.getModel(userId, 'chat');
  const ttsModel = db.getModel(userId, 'tts');

  if (!chatModel) {
    await ctx.reply('❌ 未设置 chat 模型');
    return;
  }
  if (!ttsModel) {
    await ctx.reply('❌ 未设置 tts 模型');
    return;
  }

  const chatProvider = db.getProvider(userId, chatModel.provider);
  const ttsProvider = db.getProvider(userId, ttsModel.provider);

  if (!chatProvider) {
    await ctx.reply(`❌ 服务商 ${chatModel.provider} 未配置`);
    return;
  }
  if (!ttsProvider) {
    await ctx.reply(`❌ 服务商 ${ttsModel.provider} 未配置`);
    return;
  }

  const statusMsg = await ctx.reply('🔄 处理中...');

  try {
    const history = db.getSessionMessages(userId);
    const msgs: ChatMessage[] = history.map(h => ({ role: h.role, content: h.content }));
    msgs.push({ role: 'user', content: input });

    const result = await chat(chatProvider, chatModel.model, msgs);

    db.addSessionMessage(userId, 'user', input);
    db.addSessionMessage(userId, 'assistant', result.content);

    await ctx.api.editMessageText(ctx.chat!.id, statusMsg.message_id, '🔊 合成语音中...');

    const compat = getCompat(ttsProvider, ttsModel.model);
    const voiceId = db.getVoice(userId, compat) || (compat === 'gemini' ? 'Kore' : 'alloy');
    const ttsResult = await tts(ttsProvider, ttsModel.model, result.content, voiceId);

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

export async function handleAudio(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const text = stripCommand(ctx.message?.text, 'audio');
  const replyText = ctx.message?.reply_to_message?.text || '';
  const input = text || replyText;

  if (!input) {
    const user = db.getUser(userId);
    if (user.mode !== 'idle') {
      await ctx.reply('❌ 请先使用 /cancel 退出当前模式');
      return;
    }
    db.clearSessionMessages(userId);
    db.updateUser(userId, { mode: 'audio' });
    await ctx.reply('🎵 进入语音对话模式\n发送消息进行对话后转语音\n使用 /cancel 退出');
    return;
  }

  await processAudio(ctx, userId, input);
}

export async function handleAudioMessage(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const input = ctx.message?.text;
  if (!input) return;

  await processAudio(ctx, userId, input);
}
