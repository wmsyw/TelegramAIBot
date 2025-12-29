import { Context } from 'grammy';
import { InputFile } from 'grammy';
import { db } from '../storage/sqlite.js';
import { generateImage, getCompat } from '../services/ai/router.js';
import { footer } from '../utils/helpers.js';
import { html, stripCommand } from '../utils/text.js';
import { withUserLock } from '../utils/lock.js';

async function tryDeleteMessage(ctx: Context, messageId: number): Promise<void> {
  try {
    await ctx.api.deleteMessage(ctx.chat!.id, messageId);
  } catch {
    // Ignore
  }
}

async function processImage(ctx: Context, userId: number, prompt: string): Promise<void> {
  await withUserLock(userId, () => doProcessImage(ctx, userId, prompt));
}

async function doProcessImage(ctx: Context, userId: number, prompt: string): Promise<void> {
  const user = db.getUser(userId);
  if (user.mode !== 'idle' && user.mode !== 'image') {
    await ctx.reply('❌ 请先使用 /cancel 退出当前模式');
    return;
  }

  const m = db.getModel(userId, 'image');
  if (!m) {
    await ctx.reply('❌ 未设置 image 模型，请使用 /model image <provider> <model>');
    return;
  }

  const p = db.getProvider(userId, m.provider);
  if (!p) {
    await ctx.reply(`❌ 服务商 ${m.provider} 未配置`);
    return;
  }

  const statusMsg = await ctx.reply('🎨 生成中...');

  try {
    const activePrompt = db.getActivePrompt(userId, 'image');
    const finalPrompt = activePrompt ? `${activePrompt.content}\n\n${prompt}` : prompt;
    const result = await generateImage(p, m.model, finalPrompt);

    await tryDeleteMessage(ctx, statusMsg.message_id);

    if (Buffer.isBuffer(result)) {
      await ctx.replyWithPhoto(new InputFile(result, 'image.png'), {
        caption: `🖼️ ${html(prompt)}${footer(m.model)}`,
        parse_mode: 'HTML',
      });
    } else if (typeof result === 'string' && result.length > 0) {
      const buf = Buffer.from(result, 'base64');
      await ctx.replyWithPhoto(new InputFile(buf, 'image.png'), {
        caption: `🖼️ ${html(prompt)}${footer(m.model)}`,
        parse_mode: 'HTML',
      });
    } else {
      await ctx.reply('❌ 图片生成失败：服务无有效输出');
    }
  } catch (e: any) {
    await ctx.api.editMessageText(ctx.chat!.id, statusMsg.message_id, `❌ 错误：${html(e?.message || String(e))}`);
  }
}

export async function handleImage(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const text = stripCommand(ctx.message?.text, 'image');
  const replyText = ctx.message?.reply_to_message?.text || '';
  const prompt = text || replyText;

  if (!prompt) {
    const user = db.getUser(userId);
    if (user.mode !== 'idle') {
      await ctx.reply('❌ 请先使用 /cancel 退出当前模式');
      return;
    }
    db.clearSessionMessages(userId);
    db.updateUser(userId, { mode: 'image' });
    await ctx.reply('🎨 进入图片模式\n发送描述生成图片\n使用 /cancel 退出');
    return;
  }

  await processImage(ctx, userId, prompt);
}

export async function handleImageMessage(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const prompt = ctx.message?.text;
  if (!prompt) return;

  await processImage(ctx, userId, prompt);
}
