const { contextBridge, ipcRenderer } = require('electron');

// Expose platform info
contextBridge.exposeInMainWorld('appInfo', {
  platform: process.platform
});

// Expose the auth & API IPC bridge so the renderer can trigger Google Workspace login
// and proxy requests through Electron's net.fetch (bypassing CORS & 302 redirects)
contextBridge.exposeInMainWorld('electronAuth', {
  /**
   * Opens an Electron login window to Google Workspace / Apps Script URL.
   * Prompts user for Google login if needed, saving domain cookies to session.
   * @param {string} webAppUrl
   * @returns {Promise<{success: boolean}>}
   */
  openGoogleLogin: (webAppUrl) =>
    ipcRenderer.invoke('auth:open-google-login', webAppUrl),

  /**
   * Proxies HTTP API requests through Electron's net.fetch to bypass CORS
   * and automatically handle Apps Script 302 redirects.
   */
  apiRequest: (url, method = 'GET', body = null) =>
    ipcRenderer.invoke('api:request', { url, method, body }),

  /**
   * Checks whether Google session cookies are still alive in Electron's
   * default session. Returns { valid: boolean }.
   */
  checkGoogleSession: () =>
    ipcRenderer.invoke('auth:check-session'),

  /**
   * Clears Google session cookies from Electron's default session.
   * Called during sign-out.
   */
  signOut: () =>
    ipcRenderer.invoke('auth:sign-out'),

  /**
   * Fetches the authenticated Google user's profile (email, name, picture)
   * using the session cookies established during Google login.
   * @returns {Promise<{email: string|null, name: string|null, picture: string|null}>}
   */
  getUserProfile: () =>
    ipcRenderer.invoke('auth:get-user-profile')
});

// Expose the auto-update bridge so the renderer can show update progress
// and let the user trigger the restart-and-install step.
contextBridge.exposeInMainWorld('electronUpdater', {
  /**
   * Subscribes to update lifecycle events pushed from the main process:
   * { status: 'available'|'not-available'|'downloading'|'downloaded'|'error', ... }.
   * Returns an unsubscribe function.
   */
  onStatus: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('updater:status', listener);
    return () => ipcRenderer.removeListener('updater:status', listener);
  },

  /** Quits the app and installs the already-downloaded update. */
  quitAndInstall: () => ipcRenderer.send('updater:quit-and-install')
});
