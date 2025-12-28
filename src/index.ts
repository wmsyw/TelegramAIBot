import { setupBot } from './bot.js';
import { store } from './storage/store.js';

async function main(): Promise<void> {
  console.info('[Bot] Starting...');

  try {
    const bot = await setupBot();

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.info(`[Bot] Received ${signal}, shutting down...`);
      await bot.stop();
      try {
        await store.write();
        console.info('[Bot] Store saved');
      } catch (e) {
        console.error('[Bot] Failed to save store:', e);
      }
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Start polling
    await bot.start({
      onStart: (info) => {
        console.info(`[Bot] Started as @${info.username}`);
      },
    });
  } catch (error) {
    console.error('[Bot] Failed to start:', error);
    process.exit(1);
  }
}

main();
