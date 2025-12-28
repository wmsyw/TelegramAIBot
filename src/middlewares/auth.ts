import { Context, NextFunction } from 'grammy';
import { store } from '../storage/store.js';
import { env } from '../config/env.js';

export async function authMiddleware(ctx: Context, next: NextFunction): Promise<void> {
  const userId = ctx.from?.id;

  if (!userId) {
    return;
  }

  const wl = store.data.whitelist;

  // Admins always allowed
  if (wl.admins.includes(userId) || env.ADMIN_IDS.includes(userId)) {
    await next();
    return;
  }

  // Check based on mode
  if (wl.mode === 'allow') {
    // Whitelist mode: only allowed users can access
    if (wl.allowed.includes(userId)) {
      await next();
      return;
    }
    // Silent ignore for unauthorized users
    return;
  } else {
    // Blacklist mode: all users allowed except denied
    if (wl.denied.includes(userId)) {
      return;
    }
    await next();
    return;
  }
}

export function isAdmin(userId: number): boolean {
  return store.data.whitelist.admins.includes(userId) || env.ADMIN_IDS.includes(userId);
}
