import { Context } from 'grammy';
import { InputFile } from 'grammy';
import { db } from '../storage/sqlite.js';
import { env } from '../config/env.js';
import { processWithGeminiLive } from '../services/live/gemini-live.js';
import { convertOggToPcm, convertPcmToOgg, downloadTelegramFile, textToSpeechPcm } from '../utils/audio.js';
import { html } from '../utils/text.js';
import { stripCommand } from '../utils/text.js';
import { withUserLock } from '../utils/lock.js';

export async function handleLive(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const liveProvider = db.getProvider(userId, 'gemini-live');
  if (!liveProvider) {
    await ctx.reply('❌ 请先配置 Gemini Live API Key：\n<code>/config add gemini-live YOUR_API_KEY https://generativelanguage.googleapis.com</code>', { parse_mode: 'HTML' });
    return;
  }

  const text = stripCommand(ctx.message?.text, 'live');
  if (!text) {
    await ctx.reply('❌ 请提供文本内容\n用法：\n• <code>/live 你的问题</code> - 文字对话\n• 直接发送语音消息 - 语音对话', { parse_mode: 'HTML' });
    return;
  }

  await processLiveText(ctx, userId, text, liveProvider.apiKey);
}

export async function handleLiveVoice(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const liveProvider = db.getProvider(userId, 'gemini-live');
  if (!liveProvider) {
    await ctx.reply('❌ 请先配置 Gemini Live API Key：\n<code>/config add gemini-live YOUR_API_KEY https://generativelanguage.googleapis.com</code>', { parse_mode: 'HTML' });
    return;
  }

  const voice = ctx.message?.voice;
  if (!voice) return;

  await processLiveVoice(ctx, userId, voice.file_id, liveProvider.apiKey);
}

async function processLiveText(ctx: Context, userId: number, text: string, apiKey: string): Promise<void> {
  await withUserLock(userId, () => doProcessLiveText(ctx, userId, text, apiKey));
}

async function doProcessLiveText(ctx: Context, userId: number, text: string, apiKey: string): Promise<void> {
  const statusMsg = await ctx.reply('🗣️ 生成语音中...');

  try {
    const pcmData = await textToSpeechPcm(text);
    await ctx.api.editMessageText(ctx.chat!.id, statusMsg.message_id, '🤔 思考中...');

    const voiceId = db.getVoice(userId, 'gemini') || 'Aoede';
    const responseAudio = await processWithGeminiLive({ apiKey, voiceName: voiceId }, pcmData);

    if (!responseAudio || responseAudio.length === 0) {
      await ctx.api.editMessageText(ctx.chat!.id, statusMsg.message_id, '❌ Gemini 没有返回语音');
      return;
    }

    const oggBuffer = await convertPcmToOgg(responseAudio);
    await ctx.replyWithVoice(new InputFile(oggBuffer, 'response.ogg'));
    await ctx.api.deleteMessage(ctx.chat!.id, statusMsg.message_id).catch(() => {});

  } catch (e: any) {
    console.error('[Live] Text processing error:', e);
    await ctx.api.editMessageText(ctx.chat!.id, statusMsg.message_id, `❌ 处理失败：${html(e?.message || String(e))}`, { parse_mode: 'HTML' }).catch(() => {});
  }
}

async function processLiveVoice(ctx: Context, userId: number, fileId: string, apiKey: string): Promise<void> {
  await withUserLock(userId, () => doProcessLiveVoice(ctx, userId, fileId, apiKey));
}

async function doProcessLiveVoice(ctx: Context, userId: number, fileId: string, apiKey: string): Promise<void> {
  const statusMsg = await ctx.reply('👂 正在听取...');

  try {
    const file = await ctx.api.getFile(fileId);
    if (!file.file_path) {
      await ctx.api.editMessageText(ctx.chat!.id, statusMsg.message_id, '❌ 无法获取语音文件');
      return;
    }

    const oggBuffer = await downloadTelegramFile(env.BOT_TOKEN, file.file_path);
    const pcmData = await convertOggToPcm(oggBuffer);

    await ctx.api.editMessageText(ctx.chat!.id, statusMsg.message_id, '🤔 思考中...');

    const voiceId = db.getVoice(userId, 'gemini') || 'Aoede';
    const responseAudio = await processWithGeminiLive({ apiKey, voiceName: voiceId }, pcmData);

    if (!responseAudio || responseAudio.length === 0) {
      await ctx.api.editMessageText(ctx.chat!.id, statusMsg.message_id, '❌ Gemini 没有返回语音');
      return;
    }

    const oggOutput = await convertPcmToOgg(responseAudio);
    await ctx.replyWithVoice(new InputFile(oggOutput, 'response.ogg'));
    await ctx.api.deleteMessage(ctx.chat!.id, statusMsg.message_id).catch(() => {});

  } catch (e: any) {
    console.error('[Live] Voice processing error:', e);
    await ctx.api.editMessageText(ctx.chat!.id, statusMsg.message_id, `❌ 处理失败：${html(e?.message || String(e))}`, { parse_mode: 'HTML' }).catch(() => {});
  }
}

export async function handleLiveText(_ctx: Context): Promise<void> {}
