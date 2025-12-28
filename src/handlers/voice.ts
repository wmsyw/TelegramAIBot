import { Context } from 'grammy';
import { store } from '../storage/store.js';
import { html, stripCommand } from '../utils/text.js';
import { GEMINI_VOICES, OPENAI_VOICES } from '../config/constants.js';

export async function handleVoice(ctx: Context): Promise<void> {
  const text = stripCommand(ctx.message?.text, 'voice');
  const args = text.split(/\s+/).filter(Boolean);
  const sub = (args[0] || '').toLowerCase();

  if (!store.data.voices) store.data.voices = { gemini: 'Kore', openai: 'alloy' };

  if (sub === 'list' || !sub) {
    const geminiList = GEMINI_VOICES.map((v, i) => `${i + 1}. ${v}`).join('\n');
    const openaiList = OPENAI_VOICES.map((v, i) => `${i + 1}. ${v}`).join('\n');

    const txt = `🎤 <b>可用音色列表</b>

<b>当前配置:</b>
Gemini: <code>${store.data.voices.gemini}</code>
OpenAI: <code>${store.data.voices.openai}</code>

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
      await ctx.reply(`❌ 请指定音色名称\n当前: <code>${store.data.voices.gemini}</code>`, { parse_mode: 'HTML' });
      return;
    }

    if (!GEMINI_VOICES.includes(voiceName as any)) {
      await ctx.reply(`❌ 未知音色: ${html(voiceName)}\n使用 /voice list 查看可用音色`, { parse_mode: 'HTML' });
      return;
    }

    store.data.voices.gemini = voiceName;
    await store.writeSoon();
    await ctx.reply(`✅ 已设置 Gemini 音色: <code>${html(voiceName)}</code>`, { parse_mode: 'HTML' });
    return;
  }

  if (sub === 'openai') {
    const voiceName = args[1];
    if (!voiceName) {
      await ctx.reply(`❌ 请指定音色名称\n当前: <code>${store.data.voices.openai}</code>`, { parse_mode: 'HTML' });
      return;
    }

    if (!OPENAI_VOICES.includes(voiceName as any)) {
      await ctx.reply(`❌ 未知音色: ${html(voiceName)}\n使用 /voice list 查看可用音色`, { parse_mode: 'HTML' });
      return;
    }

    store.data.voices.openai = voiceName;
    await store.writeSoon();
    await ctx.reply(`✅ 已设置 OpenAI 音色: <code>${html(voiceName)}</code>`, { parse_mode: 'HTML' });
    return;
  }

  await ctx.reply('❌ 未知子命令。支持: list, gemini <音色>, openai <音色>');
}
