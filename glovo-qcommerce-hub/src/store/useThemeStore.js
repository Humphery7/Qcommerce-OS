import { create } from 'zustand';

const STORAGE_KEY = 'qcommerce-hub.theme.v1';

function getSystemPrefersDark() {
  return Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

function loadPersisted() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';
  } catch {
    return 'system';
  }
}

function persist(theme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // localStorage unavailable — theme just won't survive a restart.
  }
}

/** Adds/removes the `.dark` class Tailwind's `darkMode: 'class'` reads. */
function applyThemeClass(theme) {
  const isDark = theme === 'dark' || (theme === 'system' && getSystemPrefersDark());
  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.classList.toggle('light', !isDark);
}

const initialTheme = loadPersisted();
// Apply immediately on module load (before React mounts) to avoid a
// flash of the wrong theme. main.jsx imports this store for its
// side effect before rendering.
applyThemeClass(initialTheme);

export const useThemeStore = create((set) => ({
  theme: initialTheme,
  setTheme: (theme) => {
    persist(theme);
    applyThemeClass(theme);
    set({ theme });
  }
}));

if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (useThemeStore.getState().theme === 'system') applyThemeClass('system');
  });
}
