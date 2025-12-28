import { setupBot } from './bot.js';

async function main(): Promise<void> {
  console.info('[Bot] Starting...');

  try {
    const bot = await setupBot();

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.info(`[Bot] Received ${signal}, shutting down...`);
      await bot.stop();
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
