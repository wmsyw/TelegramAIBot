import { Bot, GrammyError, HttpError } from 'grammy';
import { env } from './config/env.js';
import { store } from './storage/store.js';
import { authMiddleware } from './middlewares/auth.js';
import { errorMiddleware } from './middlewares/error.js';
import { handleStart, handleHelp } from './handlers/start.js';
import { handleChat, handleSearch } from './handlers/chat.js';
import { handleImage } from './handlers/image.js';
import { handleTTS, handleAudio } from './handlers/audio.js';
import { handleConfig } from './handlers/config.js';
import { handleModel } from './handlers/model.js';
import { handleVoice } from './handlers/voice.js';
import { handlePrompt, handleContext } from './handlers/prompt.js';
import { handleWhitelist } from './handlers/whitelist.js';

export function createBot(): Bot {
  const bot = new Bot(env.BOT_TOKEN);

  // Middlewares
  bot.use(errorMiddleware);
  bot.use(authMiddleware);

  // Commands
  bot.command('start', handleStart);
  bot.command('help', handleHelp);
  bot.command('chat', handleChat);
  bot.command('search', handleSearch);
  bot.command('image', handleImage);
  bot.command('tts', handleTTS);
  bot.command('audio', handleAudio);
  bot.command('config', handleConfig);
  bot.command('model', handleModel);
  bot.command('voice', handleVoice);
  bot.command('prompt', handlePrompt);
  bot.command('context', handleContext);
  bot.command('whitelist', handleWhitelist);

  // Aliases
  bot.command('c', handleChat);
  bot.command('s', handleSearch);
  bot.command('img', handleImage);
  bot.command('i', handleImage);
  bot.command('v', handleTTS);
  bot.command('a', handleAudio);
  bot.command('ctx', handleContext);

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
  await store.init();
  console.info('[Bot] Store initialized');

  // Create bot
  const bot = createBot();

  // Set commands
  await bot.api.setMyCommands([
    { command: 'start', description: '开始使用' },
    { command: 'help', description: '查看帮助' },
    { command: 'chat', description: 'AI 对话' },
    { command: 'search', description: '搜索模式对话' },
    { command: 'image', description: '生成图片' },
    { command: 'tts', description: '文本转语音' },
    { command: 'audio', description: '对话后转语音' },
    { command: 'config', description: '配置管理' },
    { command: 'model', description: '模型设置' },
    { command: 'voice', description: '音色设置' },
    { command: 'context', description: '上下文管理' },
    { command: 'prompt', description: '模板管理' },
    { command: 'whitelist', description: '白名单管理' },
  ]);

  console.info('[Bot] Commands set');
  return bot;
}
