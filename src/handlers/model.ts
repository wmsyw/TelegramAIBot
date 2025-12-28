import { Context } from 'grammy';
import { store } from '../storage/store.js';
import { html, stripCommand } from '../utils/text.js';

export async function handleModel(ctx: Context): Promise<void> {
  const text = stripCommand(ctx.message?.text, 'model');
  const args = text.split(/\s+/).filter(Boolean);
  const sub = (args[0] || '').toLowerCase();

  if (sub === 'list' || !sub) {
    const cur = store.data.models;
    const txt = `⚙️ <b>当前模型配置</b>

<b>chat:</b> <code>${html(cur.chat) || '(未设)'}</code>
<b>search:</b> <code>${html(cur.search) || '(未设)'}</code>
<b>image:</b> <code>${html(cur.image) || '(未设)'}</code>
<b>tts:</b> <code>${html(cur.tts) || '(未设)'}</code>`;

    await ctx.reply(txt, { parse_mode: 'HTML' });
    return;
  }

  const kind = sub as keyof typeof store.data.models;
  if (!['chat', 'search', 'image', 'tts'].includes(kind)) {
    await ctx.reply('❌ 未知模型类型。支持: chat, search, image, tts');
    return;
  }

  const [, provider, ...modelParts] = args;
  const model = modelParts.join(' ').trim();

  if (!provider || !model) {
    await ctx.reply(`❌ 用法: /model ${kind} <服务商> <模型名>`);
    return;
  }

  if (!store.data.providers[provider]) {
    await ctx.reply('❌ 未知服务商，请先使用 /config add 添加');
    return;
  }

  store.data.models[kind] = `${provider} ${model}`;
  await store.writeSoon();
  await ctx.reply(`✅ 已设置 ${kind}: <code>${html(store.data.models[kind])}</code>`, { parse_mode: 'HTML' });
}
