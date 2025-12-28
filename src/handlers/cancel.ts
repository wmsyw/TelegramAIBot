import { Context } from 'grammy';
import { db } from '../storage/sqlite.js';

export async function handleCancel(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const user = db.getUser(userId);

  if (user.mode === 'idle') {
    await ctx.reply('当前无活动模式');
    return;
  }

  const prevMode = user.mode;

  // Clear session messages (temporary context)
  db.clearSessionMessages(userId);

  // Reset to idle
  db.updateUser(userId, { mode: 'idle' });

  const modeNames: Record<string, string> = {
    chat: '对话',
    search: '搜索',
    image: '图片',
    tts: '语音合成',
    audio: '语音对话',
    live: 'Gemini Live'
  };

  await ctx.reply(`✅ 已退出${modeNames[prevMode] || prevMode}模式`);
}
