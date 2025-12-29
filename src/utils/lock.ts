const userLocks = new Map<number, Promise<void>>();

export async function withUserLock<T>(userId: number, fn: () => Promise<T>): Promise<T> {
  const prev = userLocks.get(userId) || Promise.resolve();
  let release: () => void;
  const lock = new Promise<void>(r => { release = r; });
  const next = prev.catch(() => {}).then(() => lock);
  userLocks.set(userId, next);

  await prev.catch(() => {});
  try {
    return await fn();
  } finally {
    release!();
    if (userLocks.get(userId) === next) {
      userLocks.delete(userId);
    }
  }
}

export class Semaphore {
  private active = 0;
  private queue: { resolve: () => void; priority: boolean }[] = [];

  constructor(public readonly limit: number) {}

  async run<T>(fn: () => Promise<T>, priority = false): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>((resolve) => {
        if (priority) {
          const idx = this.queue.findIndex(item => !item.priority);
          if (idx === -1) this.queue.push({ resolve, priority });
          else this.queue.splice(idx, 0, { resolve, priority });
        } else {
          this.queue.push({ resolve, priority });
        }
      });
    }
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      if (this.queue.length > 0) {
        this.queue.shift()!.resolve();
      }
    }
  }
}

export const globalLimiter = new Semaphore(15);
