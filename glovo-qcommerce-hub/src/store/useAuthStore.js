import { create } from 'zustand';

const STORAGE_KEY = 'qcommerce-hub.auth.v1';

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
      JSON.stringify({ user: state.user })
    );
  } catch {
    // localStorage unavailable — session won't survive a restart.
  }
}

function clearPersisted() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Not fatal.
  }
}

const persisted = loadPersisted();

/**
 * Authentication state driven by real Google session cookies in Electron.
 *
 * `user`           — { email, name, picture } from profile info.
 * `sessionChecked` — true once we've verified Google session cookies are
 *                    alive (resets to false on every app launch).
 *
 * On startup, App.jsx checks session cookies via Electron IPC. If valid,
 * `sessionChecked` is set to true and the user sees the app. If not,
 * `clearAuth()` is called and the sign-in page is shown.
 */
export const useAuthStore = create((set, get) => ({
  user: persisted.user || null,
  sessionChecked: false,

  setAuth: ({ user }) => {
    const next = { user };
    persist(next);
    set(next);
  },

  markSessionChecked: () => {
    set({ sessionChecked: true });
  },

  clearAuth: () => {
    clearPersisted();
    set({ user: null, sessionChecked: false });
  }
}));
