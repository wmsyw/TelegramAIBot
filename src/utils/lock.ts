const userLocks = new Map<number, Promise<void>>();

export async function withUserLock<T>(userId: number, fn: () => Promise<T>): Promise<T> {
  const prev = userLocks.get(userId) || Promise.resolve();
  let release: () => void;
  const lock = new Promise<void>(r => { release = r; });
  userLocks.set(userId, prev.then(() => lock));

  await prev;
  try {
    return await fn();
  } finally {
    release!();
    if (userLocks.get(userId) === lock) {
      userLocks.delete(userId);
    }
  }
}
