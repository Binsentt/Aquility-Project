import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'aquility.access-token';
let memoryToken = null;

function normalizeToken(token) {
  return typeof token === 'string' && token.trim() ? token.trim() : null;
}

async function canUseSecureStore() {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function getStoredAccessToken() {
  try {
    if (await canUseSecureStore()) {
      memoryToken = normalizeToken(await SecureStore.getItemAsync(ACCESS_TOKEN_KEY));
    }
  } catch {
    // Keep the in-memory session available when the native store is unavailable.
  }
  return memoryToken;
}

export async function saveAccessToken(token) {
  memoryToken = normalizeToken(token);
  if (!memoryToken) return;
  try {
    if (await canUseSecureStore()) await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, memoryToken);
  } catch {
    // The caller can continue with the in-memory token when SecureStore is unavailable.
  }
}

export async function clearStoredAccessToken() {
  memoryToken = null;
  try {
    if (await canUseSecureStore()) {
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    }
  } catch {
    // Clearing in-memory state is still safe when SecureStore is unavailable.
  }
}
