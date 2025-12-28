import { Context, NextFunction } from 'grammy';

export async function errorMiddleware(ctx: Context, next: NextFunction): Promise<void> {
  try {
    await next();
  } catch (error: any) {
    console.error('[Bot Error]', error);

    const message = error?.message || String(error);
    const isApiError = error?.code || error?.response?.status;

    if (isApiError) {
      console.error('[API Error]', {
        code: error?.code,
        status: error?.response?.status,
        data: error?.response?.data,
      });
    }

    try {
      await ctx.reply(`❌ 发生错误: ${message.slice(0, 200)}`);
    } catch {
      // Cannot send message, ignore
    }
  }
}
