import { Context } from 'grammy';
import { db, SessionMode } from '../storage/sqlite.js';
import { withUserLock } from '../utils/lock.js';

const MODE_NAMES: Record<string, string> = {
  chat: '对话',
  search: '搜索',
  image: '图片',
  live: '实时语音',
};

const VALID_MODES: SessionMode[] = ['chat', 'search', 'image', 'live'];

export async function handleCallback(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  const userId = ctx.from?.id;
  if (!userId) return;

  const [namespace, action] = data.split(':');

  // Mode switching
  if (namespace === 'mode') {
    if (!VALID_MODES.includes(action as SessionMode)) {
      await ctx.answerCallbackQuery({ text: '无效模式' });
      return;
    }

    const targetMode = action as SessionMode;
    const user = db.getUser(userId);

    if (user.mode === targetMode) {
      await ctx.answerCallbackQuery({ text: `已在${MODE_NAMES[targetMode] || targetMode}模式` });
      return;
    }

    db.clearSessionMessages(userId);
    db.updateUser(userId, { mode: targetMode });
    await ctx.answerCallbackQuery({ text: `已切换到${MODE_NAMES[targetMode] || targetMode}模式` });

    const modeHints: Record<string, string> = {
      chat: '直接发送消息即可对话',
      search: '发送关键词开始搜索',
      image: '发送描述生成图片',
      live: '发送语音消息开始对话',
    };
    await ctx.reply(`${getModeEmoji(targetMode)} 进入${MODE_NAMES[targetMode]}模式\n${modeHints[targetMode] || ''}\n使用 /cancel 退出`);
    return;
  }

  // Chat/Search actions - wrap in user lock
  if (namespace === 'chat' || namespace === 'search') {
    if (action === 'clear') {
      await withUserLock(userId, async () => {
        db.clearSessionMessages(userId);
      });
      await ctx.answerCallbackQuery({ text: '上下文已清空' });
      try {
        await ctx.editMessageReplyMarkup({ reply_markup: undefined });
      } catch {}
      await ctx.reply('🧹 上下文已清空，可继续对话');
      return;
    }

    if (action === 'retry') {
      await ctx.answerCallbackQuery({ text: '正在重新生成...' });
      try {
        await ctx.editMessageReplyMarkup({ reply_markup: undefined });
      } catch {}

      await withUserLock(userId, async () => {
        const history = db.getSessionMessages(userId);
        const lastUserMsg = [...history].reverse().find(m => m.role === 'user');
        const lastMsg = history[history.length - 1];

        // Verify we have a valid Q&A pair to retry
        if (!lastUserMsg || history.length < 2 || lastMsg?.role !== 'assistant') {
          await ctx.reply('❌ 无历史消息可重试');
          return;
        }

        // Remove the last Q&A pair
        db.clearSessionMessages(userId);
        const remaining = history.slice(0, -2);
        for (const msg of remaining) {
          db.addSessionMessage(userId, msg.role as 'user' | 'assistant', msg.content, msg.thought);
        }

        // Dynamically import to avoid circular dependency
        const { processChat, processSearch } = await import('./chat.js');
        const fn = namespace === 'search' ? processSearch : processChat;
        await fn(ctx, userId, lastUserMsg.content);
      });
      return;
    }

    await ctx.answerCallbackQuery();
    return;
  }

  // Config actions
  if (namespace === 'config') {
    if (action === 'toggle_tg') {
      const tg = db.getTelegraph(userId);
      db.setTelegraph(userId, { enabled: !tg.enabled });
      await ctx.answerCallbackQuery({ text: `Telegraph 已${!tg.enabled ? '开启' : '关闭'}` });

      const { renderConfigStatus } = await import('./config.js');
      await renderConfigStatus(ctx, userId, true);
      return;
    }

    if (action === 'refresh') {
      await ctx.answerCallbackQuery({ text: '已刷新' });
      const { renderConfigStatus } = await import('./config.js');
      await renderConfigStatus(ctx, userId, true);
      return;
    }

    await ctx.answerCallbackQuery();
    return;
  }

  await ctx.answerCallbackQuery();
}

function getModeEmoji(mode: string): string {
  const emojis: Record<string, string> = {
    chat: '💬',
    search: '🔍',
    image: '🎨',
    live: '🎤',
  };
  return emojis[mode] || '🤖';
}
