import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'aquility:access-token';
let memoryToken = null;

async function canUseSecureStore() {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function getStoredAccessToken() {
  if (await canUseSecureStore()) {
    return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  }
  return memoryToken;
}

export async function saveAccessToken(token) {
  memoryToken = token || null;
  if (await canUseSecureStore()) {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
  }
}

export async function clearStoredAccessToken() {
  memoryToken = null;
  if (await canUseSecureStore()) {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  }
}
