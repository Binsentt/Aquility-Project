export const CACHE_KEYS = {
  session: 'aquility:session',
  user: 'aquility:user-cache',
  history: 'aquility:scan-history-cache',
};

async function readJson(storage, key, fallback) {
  const rawValue = await storage.getItem(key);
  if (!rawValue) return fallback;
  try {
    return JSON.parse(rawValue);
  } catch {
    return fallback;
  }
}

export async function readOfflineState(storage) {
  const [session, currentUser, scanHistory] = await Promise.all([
    readJson(storage, CACHE_KEYS.session, null),
    readJson(storage, CACHE_KEYS.user, null),
    readJson(storage, CACHE_KEYS.history, []),
  ]);

  if (!session?.userId || currentUser?.id !== session.userId) {
    return { currentUser: null, scanHistory: [] };
  }

  return {
    currentUser,
    scanHistory: Array.isArray(scanHistory) ? scanHistory : [],
  };
}

export async function writeOfflineState(storage, { currentUser, scanHistory }) {
  if (!currentUser?.id) {
    await Promise.all(Object.values(CACHE_KEYS).map((key) => storage.removeItem(key)));
    return;
  }

  await Promise.all([
    storage.setItem(CACHE_KEYS.session, JSON.stringify({ userId: currentUser.id })),
    storage.setItem(CACHE_KEYS.user, JSON.stringify(currentUser)),
    storage.setItem(CACHE_KEYS.history, JSON.stringify(Array.isArray(scanHistory) ? scanHistory : [])),
  ]);
}
