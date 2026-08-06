import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, clearAccessToken, getApiBaseUrl, setAccessToken, setUnauthorizedHandler } from '../services/apiClient';
import { toApiProfile, toScanResult, toSessionUser } from '../services/apiMappers';
import { readOfflineState, writeOfflineState } from '../services/sessionCache';
import { clearStoredAccessToken, getStoredAccessToken, saveAccessToken } from '../services/authTokenStore';
import { resetToWelcome } from '../navigation/navigationRef';

const AuthContext = createContext(null);

function normalizeScanResult(result = {}) {
  if (result?.analysisId || result?.pH !== undefined || result?.nitrate?.value !== undefined) {
    return toScanResult(result, getApiBaseUrl());
  }

  const imageUri = result?.imageUri || result?.image || result?.uri || result?.images?.[0] || null;
  return {
    ...result,
    id: result?.id || `scan-${Date.now()}`,
    title: result?.title || 'Water Test',
    status: result?.overallStatus || result?.status || 'Moderate',
    overallStatus: result?.overallStatus || result?.status || 'Moderate',
    imageUri,
    images: result?.images?.length ? result.images : imageUri ? [imageUri] : [],
    createdAt: result?.createdAt || result?.generatedAt || new Date().toISOString(),
    generatedAt: result?.generatedAt || result?.createdAt || new Date().toISOString(),
    location: result?.location || null,
    resultData: result?.resultData || {},
    files: Array.isArray(result?.files) ? result.files : [],
  };
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  const [mapVersion, setMapVersion] = useState(0);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      title: 'AQUILITY ready',
      detail: 'Profile and water-test data are synchronised through the AQUILITY service.',
      createdAt: new Date().toISOString(),
      unread: false,
    },
  ]);

  const cacheState = useCallback((user, history) => {
    return writeOfflineState(AsyncStorage, { currentUser: user, scanHistory: history }).catch(() => undefined);
  }, []);

  const clearSession = useCallback(async () => {
    clearAccessToken();
    await clearStoredAccessToken().catch(() => undefined);
    setCurrentUser(null);
    setScanHistory([]);
    await cacheState(null, []);
  }, [cacheState]);

  useEffect(() => {
    setUnauthorizedHandler(async () => {
      await clearSession();
      resetToWelcome();
    });
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  const addNotification = useCallback((title, detail = '') => {
    setNotifications((previous) => [
      { id: Date.now(), title, detail, createdAt: new Date().toISOString(), unread: true },
      ...previous,
    ].slice(0, 6));
  }, []);

  const setSession = useCallback((user, history = []) => {
    const sessionUser = toSessionUser(user);
    const normalizedHistory = history.map(normalizeScanResult);
    setCurrentUser(sessionUser);
    setScanHistory(normalizedHistory);
    cacheState(sessionUser, normalizedHistory);
    return sessionUser;
  }, [cacheState]);

  const refreshHistory = useCallback(async (userId) => {
    if (!userId) return [];
    const response = await api.listWaterTests(userId);
    const history = (response.items || []).map((item) => toScanResult(item, getApiBaseUrl()));
    setScanHistory(history);
    setCurrentUser((user) => {
      if (user) cacheState(user, history);
      return user;
    });
    return history;
  }, [cacheState]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const [storedToken, cached] = await Promise.all([getStoredAccessToken(), readOfflineState(AsyncStorage)]);
      if (!mounted) return;

      setAccessToken(storedToken);
      if (!storedToken) {
        setCurrentUser(null);
        setScanHistory([]);
        setAuthLoaded(true);
        return;
      }

      const cachedUser = cached.currentUser ? toSessionUser(cached.currentUser) : null;
      const cachedHistory = cached.scanHistory.map(normalizeScanResult);
      setCurrentUser(cachedUser);
      setScanHistory(cachedHistory);
      setAuthLoaded(true);

      if (!cachedUser?.id) return;

      try {
        const [profileResponse, waterTestsResponse] = await Promise.all([
          api.getUser(cachedUser.id),
          api.listWaterTests(cachedUser.id),
        ]);
        if (!mounted) return;
        setSession(profileResponse.user, waterTestsResponse.items || []);
      } catch {}
    })().catch(() => {
      if (mounted) setAuthLoaded(true);
    });

    return () => {
      mounted = false;
    };
  }, [setSession]);

  const registerUser = useCallback(async (payload) => {
    const response = await api.createUser({
      ...toApiProfile(payload),
      password: payload.password,
      accountType: 'registered',
    });
    if (!response.token) throw new Error('The AQUILITY server did not return a session token.');
    setAccessToken(response.token);
    await saveAccessToken(response.token);
    const user = setSession(response.user, []);
    addNotification('Registration successful', 'Your AQUILITY profile has been created.');
    return user;
  }, [addNotification, setSession]);

  const loginUser = useCallback(async (email, password) => {
    const response = await api.login({ email, password });
    if (!response.token) throw new Error('The AQUILITY server did not return a session token.');
    setAccessToken(response.token);
    await saveAccessToken(response.token);
    const user = setSession(response.user, []);
    try {
      await refreshHistory(user.id);
    } catch {}
    addNotification('Login successful', 'Your AQUILITY session has been restored.');
    return user;
  }, [addNotification, refreshHistory, setSession]);

  const loginGuest = useCallback(async (payload) => {
    const response = await api.createUser({
      ...toApiProfile(payload),
      accountType: 'guest',
    });
    if (!response.token) throw new Error('The AQUILITY server did not return a session token.');
    setAccessToken(response.token);
    await saveAccessToken(response.token);
    const user = setSession(response.user, []);
    addNotification('Guest session started', 'Your guest profile is ready for water-test collection.');
    return user;
  }, [addNotification, setSession]);

  const updateUserProfile = useCallback(async (updates) => {
    if (!currentUser?.id) {
      throw new Error('No AQUILITY profile is currently active.');
    }
    const response = await api.updateUser(currentUser.id, toApiProfile({ ...currentUser, ...updates }));
    const user = toSessionUser(response.user, currentUser);
    setCurrentUser(user);
    cacheState(user, scanHistory);
    return user;
  }, [cacheState, currentUser, scanHistory]);

  const addScanResult = useCallback(async (result) => {
    const normalizedResult = normalizeScanResult(result);
    setScanHistory((previous) => {
      const withoutDuplicate = previous.filter((entry) => entry.id !== normalizedResult.id);
      const next = [normalizedResult, ...withoutDuplicate];
      if (currentUser) cacheState(currentUser, next);
      return next;
    });
    setMapVersion((previous) => previous + 1);
    return normalizedResult;
  }, [cacheState, currentUser]);

  const deleteScanResult = useCallback(async (scanId) => {
    await api.deleteWaterTest(scanId);
    setScanHistory((previous) => {
      const next = previous.filter((entry) => entry.id !== scanId);
      if (currentUser) cacheState(currentUser, next);
      return next;
    });
    setMapVersion((previous) => previous + 1);
  }, [cacheState, currentUser]);

  const deleteAccount = useCallback(async (password) => {
    if (!currentUser?.id) {
      throw new Error('No AQUILITY profile is currently active.');
    }
    await api.deleteAccount(currentUser.isGuest ? null : password);
    await clearSession();
    setMapVersion((previous) => previous + 1);
    resetToWelcome();
  }, [clearSession, currentUser]);

  const logout = useCallback(async () => {
    try {
      if (currentUser?.isGuest) await api.logout();
    } catch {}
    await clearSession();
    addNotification('Session closed', 'You have logged out from AQUILITY.');
    resetToWelcome();
  }, [addNotification, clearSession, currentUser?.isGuest]);

  const value = useMemo(() => ({
    currentUser,
    notifications,
    scanHistory,
    mapVersion,
    authLoaded,
    addNotification,
    markAllNotificationsRead: () => setNotifications((previous) => previous.map((item) => ({ ...item, unread: false }))),
    clearNotifications: () => setNotifications([]),
    registerUser,
    updateUserProfile,
    loginUser,
    loginGuest,
    refreshHistory,
    addScanResult,
    deleteScanResult,
    deleteAccount,
    logout,
  }), [
    addNotification,
    addScanResult,
    authLoaded,
    currentUser,
    deleteScanResult,
    deleteAccount,
    loginGuest,
    loginUser,
    notifications,
    mapVersion,
    refreshHistory,
    registerUser,
    scanHistory,
    updateUserProfile,
    logout,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
