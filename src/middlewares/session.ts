import { Context, NextFunction } from 'grammy';
import { db, SessionMode } from '../storage/sqlite.js';

export async function sessionRouterMiddleware(ctx: Context, next: NextFunction): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return next();

  // Skip commands - let command handlers deal with them
  if (ctx.message?.text?.startsWith('/')) {
    return next();
  }

  const user = db.getUser(userId);

  // If user is in a mode, attach it to context for handlers
  (ctx as any).sessionMode = user.mode;

  await next();
}
