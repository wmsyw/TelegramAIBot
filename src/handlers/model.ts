import { Context } from 'grammy';
import { db } from '../storage/sqlite.js';
import { html, stripCommand } from '../utils/text.js';

const MODEL_KINDS = ['chat', 'search', 'image', 'live'] as const;
type ModelKind = typeof MODEL_KINDS[number];

export async function handleModel(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const text = stripCommand(ctx.message?.text, 'model');
  const args = text.split(/\s+/).filter(Boolean);
  const sub = (args[0] || '').toLowerCase();

  if (sub === 'list' || !sub) {
    const models = db.getAllModels(userId);
    const txt = `⚙️ <b>当前模型配置</b>

<b>chat:</b> <code>${html(models.chat || '(未设)')}</code>
<b>search:</b> <code>${html(models.search || '(未设)')}</code>
<b>image:</b> <code>${html(models.image || '(未设)')}</code>
<b>live:</b> <code>${html(models.live || '(未设)')}</code>`;

    await ctx.reply(txt, { parse_mode: 'HTML' });
    return;
  }

  if (!MODEL_KINDS.includes(sub as ModelKind)) {
    await ctx.reply('❌ 未知模型类型。支持: chat, search, image, live');
    return;
  }

  const kind = sub as ModelKind;
  const [, provider, ...modelParts] = args;
  const model = modelParts.join(' ').trim();

  if (!provider || !model) {
    await ctx.reply(`❌ 用法: /model ${kind} <服务商> <模型名>`);
    return;
  }

  if (!db.getProvider(userId, provider)) {
    await ctx.reply('❌ 未知服务商，请先使用 /config add 添加');
    return;
  }

  db.setModel(userId, kind, provider, model);
  await ctx.reply(`✅ 已设置 ${kind}: <code>${html(provider)} ${html(model)}</code>`, { parse_mode: 'HTML' });
}
