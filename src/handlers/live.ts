import { Context } from 'grammy';
import { InputFile } from 'grammy';
import { db } from '../storage/sqlite.js';
import { env } from '../config/env.js';
import { createLiveSession, getLiveSession, closeLiveSession } from '../services/live/gemini-live.js';
import { convertOggToPcm, convertPcmToOgg, downloadTelegramFile } from '../utils/audio.js';
import { html } from '../utils/text.js';

export async function handleLive(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  // Check for Gemini provider
  const geminiProvider = db.getProvider(userId, 'gemini');
  if (!geminiProvider) {
    await ctx.reply('❌ 请先配置 Gemini API Key：\n<code>/config add gemini YOUR_API_KEY https://generativelanguage.googleapis.com</code>', { parse_mode: 'HTML' });
    return;
  }

  const user = db.getUser(userId);
  if (user.mode !== 'idle') {
    await ctx.reply('❌ 请先使用 /cancel 退出当前模式');
    return;
  }

  const voiceId = db.getVoice(userId, 'gemini') || 'Aoede';

  try {
    await ctx.reply('🔄 正在连接 Gemini Live...');

    const session = await createLiveSession(userId, {
      apiKey: geminiProvider.apiKey,
      voiceName: voiceId
    });

    // Set up event handlers
    session.on('audio', async (pcmBuffer: Buffer) => {
      try {
        const oggBuffer = await convertPcmToOgg(pcmBuffer);
        await ctx.replyWithVoice(new InputFile(oggBuffer, 'response.ogg'));
      } catch (e) {
        console.error('[Live] Audio conversion error:', e);
      }
    });

    session.on('text', async (text: string) => {
      try {
        await ctx.reply(html(text), { parse_mode: 'HTML' });
      } catch {
        // Ignore reply errors
      }
    });

    session.on('error', async (err: Error) => {
      console.error('[Live] Session error:', err);
      try {
        await ctx.reply(`❌ Live 错误：${html(err.message)}`, { parse_mode: 'HTML' });
      } catch {
        // Ignore reply errors
      }
      closeLiveSession(userId);
      db.updateUser(userId, { mode: 'idle' });
    });

    session.on('close', () => {
      console.log(`[Live] Session closed for user ${userId}`);
      db.updateUser(userId, { mode: 'idle' });
    });

    db.updateUser(userId, { mode: 'live' });
    await ctx.reply('🎙️ Gemini Live 已连接\n发送语音或文字消息即可对话\n使用 /cancel 退出');

  } catch (e: any) {
    console.error('[Live] Connection error:', e);
    await ctx.reply(`❌ 连接失败：${html(e?.message || String(e))}`, { parse_mode: 'HTML' });
  }
}

export async function handleLiveVoice(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const session = getLiveSession(userId);
  if (!session?.isConnected) {
    await ctx.reply('❌ Live 会话已断开，请重新使用 /live');
    db.updateUser(userId, { mode: 'idle' });
    return;
  }

  const voice = ctx.message?.voice;
  if (!voice) return;

  try {
    const file = await ctx.api.getFile(voice.file_id);
    if (!file.file_path) {
      await ctx.reply('❌ 无法获取语音文件');
      return;
    }

    const oggBuffer = await downloadTelegramFile(env.BOT_TOKEN, file.file_path);
    const pcmBuffer = await convertOggToPcm(oggBuffer);

    session.sendAudio(pcmBuffer);
  } catch (e: any) {
    console.error('[Live] Voice processing error:', e);
    await ctx.reply(`❌ 语音处理失败：${html(e?.message || String(e))}`, { parse_mode: 'HTML' });
  }
}

export async function handleLiveText(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const session = getLiveSession(userId);
  if (!session?.isConnected) {
    await ctx.reply('❌ Live 会话已断开，请重新使用 /live');
    db.updateUser(userId, { mode: 'idle' });
    return;
  }

  const text = ctx.message?.text;
  if (!text) return;

  try {
    session.sendText(text);
  } catch (e: any) {
    console.error('[Live] Text send error:', e);
    await ctx.reply(`❌ 发送失败：${html(e?.message || String(e))}`, { parse_mode: 'HTML' });
  }
}
