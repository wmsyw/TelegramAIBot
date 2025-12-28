import { Context } from 'grammy';
import { db } from '../storage/sqlite.js';
import { html, stripCommand } from '../utils/text.js';

const PROMPT_KINDS = ['chat', 'search', 'image', 'tts'] as const;

export async function handlePrompt(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const text = stripCommand(ctx.message?.text, 'prompt');
  const lines = text.split('\n');
  const args = lines[0].split(/\s+/).filter(Boolean);
  const sub = (args[0] || '').toLowerCase();

  if (sub === 'add') {
    const name = args[1]?.trim();
    const replyText = ctx.message?.reply_to_message?.text || '';
    const content = replyText || lines.slice(1).join('\n').trim();
    const description = lines[2]?.trim();

    if (!name || !content) {
      await ctx.reply('❌ 用法: 回复模板内容并执行 /prompt add <名称>');
      return;
    }

    db.setPrompt(userId, name, content, description);
    await ctx.reply(`✅ 已保存模板: <code>${html(name)}</code>`, { parse_mode: 'HTML' });
    return;
  }

  if (sub === 'list' || !sub) {
    const prompts = db.listPrompts(userId);
    const textOut = prompts.length
      ? prompts.map(t => {
          const head = `<b>${html(t.name)}</b>${t.description ? ` (${html(t.description)})` : ''}`;
          const body = `<blockquote expandable>${html(t.content)}</blockquote>`;
          return `${head}\n${body}`;
        }).join('\n\n')
      : '(空)';

    await ctx.reply(`🧩 <b>模板列表</b>\n\n${textOut}`, { parse_mode: 'HTML' });
    return;
  }

  if (sub === 'del') {
    const name = args[1]?.trim();
    if (!name) {
      await ctx.reply('❌ 用法: /prompt del <名称|all>');
      return;
    }

    if (name === 'all') {
      db.deleteAllPrompts(userId);
    } else {
      if (!db.deletePrompt(userId, name)) {
        await ctx.reply('❌ 未找到模板');
        return;
      }
    }

    await ctx.reply('✅ 删除完成');
    return;
  }

  if (PROMPT_KINDS.includes(sub as any)) {
    const kind = sub;
    const name = args[1]?.trim();

    if (!name) {
      db.setActivePrompt(userId, kind, null);
      await ctx.reply(`✅ 已清除 <b>${html(kind)}</b> 的 Prompt`, { parse_mode: 'HTML' });
      return;
    }

    if (!db.getPrompt(userId, name)) {
      await ctx.reply('❌ 未找到模板');
      return;
    }

    db.setActivePrompt(userId, kind, name);
    await ctx.reply(`✅ 已设置 <b>${html(kind)}</b> 的 Prompt: <code>${html(name)}</code>`, { parse_mode: 'HTML' });
    return;
  }

  await ctx.reply('❌ 未知子命令。支持: add, list, del, chat|search|image|tts <名称>');
}
