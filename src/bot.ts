import { Bot, GrammyError, HttpError } from 'grammy';
import { env } from './config/env.js';
import { db } from './storage/sqlite.js';
import { authMiddleware } from './middlewares/auth.js';
import { errorMiddleware } from './middlewares/error.js';
import { sessionRouterMiddleware } from './middlewares/session.js';
import { handleStart, handleHelp } from './handlers/start.js';
import { handleChat, handleChatMessage, handleSearch, handleSearchMessage, handleInlineQuery, processChat } from './handlers/chat.js';
import { handleImage, handleImageMessage } from './handlers/image.js';
import { handleLive, handleLiveVoice, handleLiveText } from './handlers/live.js';
import { handleCancel } from './handlers/cancel.js';
import { handleConfig } from './handlers/config.js';
import { handleModel } from './handlers/model.js';
import { handlePrompt } from './handlers/prompt.js';
import { handleWhitelist } from './handlers/whitelist.js';
import { handleCallback } from './handlers/callback.js';

export function createBot(): Bot {
  const bot = new Bot(env.BOT_TOKEN);

  // Middlewares
  bot.use(errorMiddleware);
  bot.use(authMiddleware);
  bot.use(sessionRouterMiddleware);

  // Commands
  bot.command('start', handleStart);
  bot.command('help', handleHelp);
  bot.command('chat', handleChat);
  bot.command('search', handleSearch);
  bot.command('image', handleImage);
  bot.command('live', handleLive);
  bot.command('cancel', handleCancel);
  bot.command('config', handleConfig);
  bot.command('model', handleModel);
  bot.command('prompt', handlePrompt);
  bot.command('whitelist', handleWhitelist);

  // Aliases
  bot.command('c', handleChat);
  bot.command('s', handleSearch);
  bot.command('img', handleImage);
  bot.command('i', handleImage);
  bot.command('l', handleLive);

  // Callback query handler
  bot.on('callback_query:data', handleCallback);

  // Inline query handler
  bot.on('inline_query', handleInlineQuery);

  // Session message routing for non-command messages
  bot.on('message:text', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const text = ctx.message?.text || '';
    const botInfo = ctx.me;

    // Group @mention detection
    if (ctx.chat?.type !== 'private' && botInfo?.username) {
      const mentionPattern = new RegExp(`@${botInfo.username}\\b`, 'i');
      if (mentionPattern.test(text)) {
        const query = text.replace(mentionPattern, '').trim();
        if (query) {
          await processChat(ctx, userId, query);
          return;
        }
      }
    }

    const user = db.getUser(userId);
    const mode = user.mode;

    if (mode === 'idle') return;

    switch (mode) {
      case 'chat':
        await handleChatMessage(ctx);
        break;
      case 'search':
        await handleSearchMessage(ctx);
        break;
      case 'image':
        await handleImageMessage(ctx);
        break;
      case 'live':
        await handleLiveText(ctx);
        break;
    }
  });

  // Voice message routing
  bot.on('message:voice', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const user = db.getUser(userId);
    if (user.mode === 'live') {
      await handleLiveVoice(ctx);
      return;
    }

    // One-shot live voice: any voice message triggers live processing
    const liveProvider = db.getProvider(userId, 'gemini-live');
    if (liveProvider) {
      await handleLiveVoice(ctx);
    }
  });

  // Global error handling
  bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`[Bot] Error while handling update ${ctx.update.update_id}:`);
    const e = err.error;
    if (e instanceof GrammyError) console.error('[Bot] Error in request:', e.description);
    else if (e instanceof HttpError) console.error('[Bot] Could not contact Telegram:', e);
    else console.error('[Bot] Unknown error:', e);
  });

  return bot;
}

export async function setupBot(): Promise<Bot> {
  // Initialize store
  await db.init();
  console.info('[Bot] SQLite initialized');

  // Create bot
  const bot = createBot();

  // Set commands
  await bot.api.setMyCommands([
    { command: 'start', description: '开始使用' },
    { command: 'help', description: '查看帮助' },
    { command: 'chat', description: 'AI 对话' },
    { command: 'search', description: '搜索模式对话' },
    { command: 'image', description: '生成图片' },
    { command: 'live', description: '实时语音对话' },
    { command: 'cancel', description: '退出当前模式' },
    { command: 'config', description: '配置管理' },
    { command: 'model', description: '模型设置' },
    { command: 'prompt', description: '模板管理' },
    { command: 'whitelist', description: '白名单管理' },
  ]);

  console.info('[Bot] Commands set');
  return bot;
}
