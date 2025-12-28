import { Context } from 'grammy';
import { store } from '../storage/store.js';
import { generateImage, pick, providerOf, getCompat } from '../services/ai/router.js';
import { applyPromptPrefix } from '../services/ai/history.js';
import { footer } from '../utils/helpers.js';
import { html, stripCommand } from '../utils/text.js';
import { InputFile } from 'grammy';

async function tryDeleteMessage(ctx: Context, messageId: number): Promise<void> {
  try {
    await ctx.api.deleteMessage(ctx.chat!.id, messageId);
  } catch {
    // Ignore delete failures
  }
}

export async function handleImage(ctx: Context): Promise<void> {
  const text = stripCommand(ctx.message?.text, 'image');
  const replyText = ctx.message?.reply_to_message?.text || '';
  const prompt = text || replyText;

  if (!prompt) {
    await ctx.reply('❌ 请输入图片描述');
    return;
  }

  const m = pick('image');
  if (!m) {
    await ctx.reply('❌ 未设置 image 模型，请使用 /model image <provider> <model>');
    return;
  }

  const p = providerOf(m.provider);
  if (!p) {
    await ctx.reply(`❌ 服务商 ${m.provider} 未配置`);
    return;
  }

  const statusMsg = await ctx.reply('🎨 生成中...');

  try {
    const finalPrompt = applyPromptPrefix('image', prompt);
    const result = await generateImage(m.provider, m.model, finalPrompt);

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
