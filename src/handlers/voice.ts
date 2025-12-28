import { Context } from 'grammy';
import { db } from '../storage/sqlite.js';
import { html, stripCommand } from '../utils/text.js';
import { GEMINI_VOICES, OPENAI_VOICES } from '../config/constants.js';

export async function handleVoice(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const text = stripCommand(ctx.message?.text, 'voice');
  const args = text.split(/\s+/).filter(Boolean);
  const sub = (args[0] || '').toLowerCase();

  if (sub === 'list' || !sub) {
    const geminiVoice = db.getVoice(userId, 'gemini') || 'Kore';
    const openaiVoice = db.getVoice(userId, 'openai') || 'alloy';

    const geminiList = GEMINI_VOICES.map((v, i) => `${i + 1}. ${v}`).join('\n');
    const openaiList = OPENAI_VOICES.map((v, i) => `${i + 1}. ${v}`).join('\n');

    const txt = `🎤 <b>可用音色列表</b>

<b>当前配置:</b>
Gemini: <code>${geminiVoice}</code>
OpenAI: <code>${openaiVoice}</code>

<b>Gemini (${GEMINI_VOICES.length}种):</b>
<blockquote expandable>${geminiList}</blockquote>

<b>OpenAI (${OPENAI_VOICES.length}种):</b>
<blockquote expandable>${openaiList}</blockquote>`;

    await ctx.reply(txt, { parse_mode: 'HTML' });
    return;
  }

  if (sub === 'gemini') {
    const voiceName = args[1];
    if (!voiceName) {
      const current = db.getVoice(userId, 'gemini') || 'Kore';
      await ctx.reply(`❌ 请指定音色名称\n当前: <code>${current}</code>`, { parse_mode: 'HTML' });
      return;
    }

    if (!GEMINI_VOICES.includes(voiceName as any)) {
      await ctx.reply(`❌ 未知音色: ${html(voiceName)}\n使用 /voice list 查看可用音色`, { parse_mode: 'HTML' });
      return;
    }

    db.setVoice(userId, 'gemini', voiceName);
    await ctx.reply(`✅ 已设置 Gemini 音色: <code>${html(voiceName)}</code>`, { parse_mode: 'HTML' });
    return;
  }

  if (sub === 'openai') {
    const voiceName = args[1];
    if (!voiceName) {
      const current = db.getVoice(userId, 'openai') || 'alloy';
      await ctx.reply(`❌ 请指定音色名称\n当前: <code>${current}</code>`, { parse_mode: 'HTML' });
      return;
    }

    if (!OPENAI_VOICES.includes(voiceName as any)) {
      await ctx.reply(`❌ 未知音色: ${html(voiceName)}\n使用 /voice list 查看可用音色`, { parse_mode: 'HTML' });
      return;
    }

    db.setVoice(userId, 'openai', voiceName);
    await ctx.reply(`✅ 已设置 OpenAI 音色: <code>${html(voiceName)}</code>`, { parse_mode: 'HTML' });
    return;
  }

  await ctx.reply('❌ 未知子命令。支持: list, gemini <音色>, openai <音色>');
}
