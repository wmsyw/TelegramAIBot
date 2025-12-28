import { Context, NextFunction } from 'grammy';
import { db } from '../storage/sqlite.js';

export async function authMiddleware(ctx: Context, next: NextFunction): Promise<void> {
  const userId = ctx.from?.id;

  if (!userId) {
    return;
  }

  // Admins always allowed
  if (db.isAdmin(userId)) {
    await next();
    return;
  }

  const mode = db.getWhitelistMode();

  // Check based on mode
  if (mode === 'allow') {
    // Whitelist mode: only allowed users can access
    if (db.isAllowed(userId)) {
      await next();
      return;
    }
    // Silent ignore for unauthorized users
    return;
  } else {
    // Blacklist mode: all users allowed except denied
    if (db.isDenied(userId)) {
      return;
    }
    await next();
    return;
  }
}

export function isAdmin(userId: number): boolean {
  return db.isAdmin(userId);
}
