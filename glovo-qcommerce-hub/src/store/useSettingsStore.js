import { create } from 'zustand';

const STORAGE_KEY = 'qcommerce-hub.settings.v1';

function loadPersisted() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persist(state) {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        apiBaseUrl: state.apiBaseUrl,
        oauthClientId: state.oauthClientId,
        oauthClientSecret: state.oauthClientSecret
      })
    );
  } catch {
    // localStorage unavailable (e.g. private mode) — settings just won't
    // survive a restart; not fatal.
  }
}

const persisted = loadPersisted();

const ENV_API_URL = import.meta.env.VITE_MFC_API_URL || '';

/**
 * Holds the deployed Apps Script web app URL (the `.../exec` endpoint)
 * that all MFC API calls target, plus the Google OAuth2 credentials used
 * by the sign-in flow.
 *
 * The API URL is set via the `VITE_MFC_API_URL` environment variable
 * (`.env` file) and baked into the build so users can't accidentally
 * change it. If no env var is set, the old persisted value is used as
 * a fallback for development convenience.
 */
export const useSettingsStore = create((set, get) => ({
  apiBaseUrl: ENV_API_URL || persisted.apiBaseUrl || '',
  apiUrlFixed: !!ENV_API_URL,
  oauthClientId: persisted.oauthClientId || import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  oauthClientSecret: persisted.oauthClientSecret || import.meta.env.VITE_GOOGLE_CLIENT_SECRET || '',

  setApiBaseUrl: (url) => {
    if (ENV_API_URL) return;
    const next = { ...get(), apiBaseUrl: url.trim() };
    persist(next);
    set({ apiBaseUrl: next.apiBaseUrl });
  },

  setOAuthCredentials: (clientId, clientSecret) => {
    const next = { ...get(), oauthClientId: clientId.trim(), oauthClientSecret: clientSecret.trim() };
    persist(next);
    set({ oauthClientId: next.oauthClientId, oauthClientSecret: next.oauthClientSecret });
  }
}));
