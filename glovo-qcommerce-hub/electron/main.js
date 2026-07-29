// import { app, BrowserWindow, shell, ipcMain, net, session } from 'electron';
// import path from 'node:path';
// import { fileURLToPath } from 'node:url';

// const __dirname = path.dirname(fileURLToPath(import.meta.url));
// const isDev = process.env.NODE_ENV === 'development';

// let mainWindow = null;

// // ─────────────────────────────────────────────────────────
// // Window creation
// // ─────────────────────────────────────────────────────────
// function createWindow() {
//   mainWindow = new BrowserWindow({
//     width: 1440,
//     height: 900,
//     minWidth: 1024,
//     minHeight: 700,
//     backgroundColor: '#f9f9ff',
//     title: 'Glovo QCommerce Hub',
//     webPreferences: {
//       preload: path.join(__dirname, 'preload.cjs'),
//       contextIsolation: true,
//       nodeIntegration: false,
//       sandbox: true
//     },
//     show: false
//   });

//   mainWindow.once('ready-to-show', () => mainWindow.show());

//   // Open any target="_blank" / window.open links in the OS default browser
//   // instead of a new Electron window.
//   mainWindow.webContents.setWindowOpenHandler(({ url }) => {
//     shell.openExternal(url);
//     return { action: 'deny' };
//   });

//   if (isDev) {
//     mainWindow.loadURL('http://localhost:5173');
//     mainWindow.webContents.openDevTools({ mode: 'detach' });
//   } else {
//     mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
//   }
// }

// app.whenReady().then(createWindow);

// app.on('window-all-closed', () => {
//   if (process.platform !== 'darwin') app.quit();
// });

// app.on('activate', () => {
//   if (BrowserWindow.getAllWindows().length === 0) createWindow();
// });

// // ─────────────────────────────────────────────────────────
// // API Proxy IPC — Uses Electron net.fetch to bypass CORS & handle 302 redirects
// // ─────────────────────────────────────────────────────────
// ipcMain.handle('api:request', async (_event, { url, method = 'GET', body = null }) => {
//   const options = {
//     method,
//     credentials: 'include',
//     headers: {
//       'Content-Type': 'text/plain;charset=utf-8'
//     }
//   };
//   if (body) {
//     options.body = typeof body === 'string' ? body : JSON.stringify(body);
//   }

//   const matchingCookies = await session.defaultSession.cookies.get({ url });
//   console.log('[api:request]', url, '| cookies matching URL:', matchingCookies.length ? matchingCookies.map(c => c.name).join(', ') : 'NONE');

//   const response = await session.defaultSession.fetch(url, options);
//   if (!response.ok) {
//     throw new Error(`Request failed with status ${response.status}`);
//   }
//   const text = await response.text();
//   try {
//     const data = JSON.parse(text);
//     if (data && data.error) {
//       throw new Error(data.message || 'The request failed.');
//     }
//     return data;
//   } catch (err) {
//     if (err.message.includes('JSON')) {
//       return text;
//     }
//     throw err;
//   }
// });

// // ─────────────────────────────────────────────────────────
// // Google Workspace Session Login (No GCP Client ID required!)
// // ─────────────────────────────────────────────────────────
// ipcMain.handle('auth:open-google-login', async (_event, webAppUrl) => {
//   return new Promise((resolve) => {
//     const authWindow = new BrowserWindow({
//       width: 600,
//       height: 700,
//       title: 'Sign in to Glovo Workspace',
//       parent: mainWindow || undefined,
//       modal: true,
//       webPreferences: {
//         nodeIntegration: false,
//         contextIsolation: true
//       }
//     });

//     authWindow.loadURL(webAppUrl || 'https://accounts.google.com/ServiceLogin');

//     // Close on did-navigate (fires AFTER the page loads and cookies are set).
//     // will-navigate is intentionally NOT used — it fires before the response
//     // is received, so domain-wide cookies like SAPISID/APISID are never set.
//     // The post-login redirect always goes through googleusercontent.com.
//     authWindow.webContents.on('did-navigate', (_e, url) => {
//       if (url.includes('googleusercontent.com')) {
//         if (!authWindow.isDestroyed()) authWindow.close();
//         resolve({ success: true });
//       }
//     });

//     authWindow.on('closed', () => {
//       resolve({ success: true });
//     });
//   });
// });

// // ─────────────────────────────────────────────────────────
// // Session Cookie Check — verifies Google session is still valid
// // ─────────────────────────────────────────────────────────
// const GOOGLE_SESSION_COOKIES = ['SAPISID', 'APISID', 'SSID', 'HSID', 'OSID', '__Host-GAPS'];

// ipcMain.handle('auth:check-session', async () => {
//   const cookies = await session.defaultSession.cookies.get({});
//   const hasValidGoogleCookie = cookies.some(
//     (c) =>
//       GOOGLE_SESSION_COOKIES.includes(c.name) &&
//       (c.session || !c.expirationDate || c.expirationDate * 1000 > Date.now())
//   );
//   return { valid: hasValidGoogleCookie };
// });

// // ─────────────────────────────────────────────────────────
// // Sign Out — clears Google session cookies and storage so the
// // account picker is shown on next login
// // ─────────────────────────────────────────────────────────
// ipcMain.handle('auth:sign-out', async () => {
//   // 1. Clear all session cookies, IndexedDB, service workers, and cache
//   //    storage across ALL origins. The app only uses localStorage (Zustand
//   //    persists to localStorage), so IndexedDB, service workers, caches,
//   //    and cookies are exclusively Google's auth data.
//   await session.defaultSession.clearStorageData({
//     storages: ['cookies', 'indexeddb', 'serviceworkers', 'cachestorage', 'caches']
//   });

//   // 2. Clear the HTTP disk cache (Google's auth flow may cache responses here)
//   await session.defaultSession.clearCache();

//   // 3. Extra safety: also explicitly remove known Google auth cookies
//   const GOOGLE_SESSION_COOKIES = ['SAPISID', 'APISID', 'SSID', 'HSID', 'OSID', '__Host-GAPS'];
//   const cookies = await session.defaultSession.cookies.get({});
//   const toRemove = cookies.filter((c) => GOOGLE_SESSION_COOKIES.includes(c.name));
//   for (const c of toRemove) {
//     try {
//       await session.defaultSession.cookies.remove(c.domain || '', c.name);
//     } catch {
//       // per-cookie removal may fail for some — not fatal
//     }
//   }

//   return { success: true };
// });










import { app, BrowserWindow, shell, ipcMain, net, session } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === 'development';

let mainWindow = null;

// ─────────────────────────────────────────────────────────
// Window creation
// ─────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#f9f9ff',
    title: 'Glovo QCommerce Hub',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    },
    show: false
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Open any target="_blank" / window.open links in the OS default browser
  // instead of a new Electron window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// ─────────────────────────────────────────────────────────
// Auto-update — checks the GitHub Releases feed (configured via
// package.json's build.publish) for a newer published version, downloads
// it silently in the background, and waits for the renderer to tell the
// user to restart. Disabled outside packaged builds since electron-updater
// has no dev-server update feed to check against.
// ─────────────────────────────────────────────────────────
function initAutoUpdater() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;

  const send = (status, data = {}) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:status', { status, ...data });
    }
  };

  autoUpdater.on('update-available', (info) => send('available', { version: info.version }));
  autoUpdater.on('update-not-available', () => send('not-available'));
  autoUpdater.on('download-progress', (progress) => send('downloading', { percent: progress.percent }));
  autoUpdater.on('update-downloaded', (info) => send('downloaded', { version: info.version }));
  autoUpdater.on('error', (err) => send('error', { message: err?.message || String(err) }));

  autoUpdater.checkForUpdates().catch((err) => send('error', { message: err?.message || String(err) }));
}

ipcMain.on('updater:quit-and-install', () => {
  autoUpdater.quitAndInstall();
});

app.whenReady().then(() => {
  createWindow();
  initAutoUpdater();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ─────────────────────────────────────────────────────────
// API Proxy IPC — Uses Electron net.fetch to bypass CORS & handle 302 redirects
// ─────────────────────────────────────────────────────────
ipcMain.handle('api:request', async (_event, { url, method = 'GET', body = null }) => {
  const options = {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    }
  };
  if (body) {
    options.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const matchingCookies = await session.defaultSession.cookies.get({ url });
  console.log('[api:request]', url, '| cookies matching URL:', matchingCookies.length ? matchingCookies.map(c => c.name).join(', ') : 'NONE');

  const response = await session.defaultSession.fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  const text = await response.text();
  try {
    const data = JSON.parse(text);
    if (data && data.error) {
      throw new Error(data.message || 'The request failed.');
    }
    return data;
  } catch (err) {
    if (err.message.includes('JSON')) {
      return text;
    }
    throw err;
  }
});

// ─────────────────────────────────────────────────────────
// Loading cover for the Google auth popup.
// The final leg of the SSO handoff (OneLogin SAML ACS -> Google's
// v3/signin/continue connectivity checks -> googleusercontent.com) is
// entirely automated — no user interaction happens in it — but Google's
// own page renders blank for several seconds while it runs, and that
// page reloads itself internally multiple times in that window. Rather
// than inject content into a page we don't control (which raced against
// those internal reloads and got torn down), we place our OWN small
// window on top of the popup for exactly that stretch. It never touches
// Google's DOM, so nothing there can block or race it.
// ─────────────────────────────────────────────────────────
const COVER_HTML = `data:text/html,${encodeURIComponent(`
<html><head><style>
  html,body{margin:0;height:100%;background:#ffffff;display:flex;flex-direction:column;
    align-items:center;justify-content:center;gap:16px;
    font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;}
  .spin{width:40px;height:40px;border-radius:50%;border:3px solid #dfe3ee;
    border-top-color:#0b2545;animation:sp .8s linear infinite;}
  @keyframes sp{to{transform:rotate(360deg)}}
  .t{color:#0b2545;font-size:14px;font-weight:600;}
  .s{color:#6b7280;font-size:12px;}
</style></head><body>
  <div class="spin"></div>
  <div class="t">Finishing sign-in&hellip;</div>
  <div class="s">Please don't close this window</div>
</body></html>
`)}`;

function createCoverWindow(authWindow) {
  const bounds = authWindow.getContentBounds();
  const cover = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    parent: authWindow,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#ffffff',
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  cover.loadURL(COVER_HTML);

  const resync = () => {
    if (cover.isDestroyed() || authWindow.isDestroyed()) return;
    cover.setBounds(authWindow.getContentBounds());
  };
  authWindow.on('move', resync);
  authWindow.on('resize', resync);

  return cover;
}

// ─────────────────────────────────────────────────────────
// DEBUG — safe to leave in, prints to the terminal only.
// ─────────────────────────────────────────────────────────
console.log('[GLOVO DEBUG BUILD] auth cover v6 loaded at', new Date().toISOString());

// ─────────────────────────────────────────────────────────
// Google Workspace Session Login (No GCP Client ID required!)
// ─────────────────────────────────────────────────────────
ipcMain.handle('auth:open-google-login', async (_event, webAppUrl) => {
  return new Promise((resolve) => {
    const authWindow = new BrowserWindow({
      width: 600,
      height: 700,
      title: 'Sign in to Glovo Workspace',
      parent: mainWindow || undefined,
      modal: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    authWindow.loadURL(webAppUrl || 'https://accounts.google.com/ServiceLogin');

    let coverWindow = null;
    const showCover = () => {
      if (authWindow.isDestroyed()) return;
      if (!coverWindow || coverWindow.isDestroyed()) coverWindow = createCoverWindow(authWindow);
      if (!coverWindow.isVisible()) coverWindow.showInactive();
    };
    const hideCover = () => {
      if (coverWindow && !coverWindow.isDestroyed()) coverWindow.destroy();
      coverWindow = null;
    };

    // The ACS (Assertion Consumer Service) hit is where OneLogin hands
    // the completed login back to Google — from here on it's pure
    // automated redirects with no further user interaction, so it's
    // safe to fully cover until the final googleusercontent.com landing.
    authWindow.webContents.on('did-navigate', (_e, url) => {
      if (url.includes('/acs')) showCover();
      if (url.includes('googleusercontent.com')) {
        hideCover();
        if (!authWindow.isDestroyed()) authWindow.close();
        resolve({ success: true });
      }
    });

    // Failsafe: never leave the user stuck behind the cover if something
    // goes wrong (auth error, unexpected redirect target, etc).
    authWindow.webContents.on('did-fail-load', hideCover);

    authWindow.on('closed', () => {
      hideCover();
      resolve({ success: true });
    });
  });
});

// ─────────────────────────────────────────────────────────
// Session Cookie Check — verifies Google session is still valid
// ─────────────────────────────────────────────────────────
const GOOGLE_SESSION_COOKIES = ['SAPISID', 'APISID', 'SSID', 'HSID', 'OSID', '__Host-GAPS'];

ipcMain.handle('auth:check-session', async () => {
  const cookies = await session.defaultSession.cookies.get({});
  const hasValidGoogleCookie = cookies.some(
    (c) =>
      GOOGLE_SESSION_COOKIES.includes(c.name) &&
      (c.session || !c.expirationDate || c.expirationDate * 1000 > Date.now())
  );
  return { valid: hasValidGoogleCookie };
});

// ─────────────────────────────────────────────────────────
// Google User Profile — fetches email/name/picture using the
// authenticated Google session cookies (no OAuth scopes needed).
// Uses the legacy AccountInfo endpoint which returns XML with
// the user's email, displayName, and photoUrl.
// ─────────────────────────────────────────────────────────
ipcMain.handle('auth:get-user-profile', async () => {
  try {
    const response = await session.defaultSession.fetch(
      'https://www.google.com/accounts/AccountInfo',
      { method: 'GET', credentials: 'include' }
    );
    if (!response.ok) throw new Error(`AccountInfo returned status ${response.status}`);
    const text = await response.text();
    const email = text.match(/<email>([^<]+)<\/email>/)?.[1] || null;
    const name = text.match(/<displayName>([^<]+)<\/displayName>/)?.[1] || null;
    const picture = text.match(/<photoUrl>([^<]+)<\/photoUrl>/)?.[1] || null;
    return { email, name, picture };
  } catch (err) {
    console.warn('[auth:get-user-profile] error:', err);
    return { email: null, name: null, picture: null };
  }
});

// ─────────────────────────────────────────────────────────
// Sign Out — clears Google session cookies and storage so the
// account picker is shown on next login
// ─────────────────────────────────────────────────────────
ipcMain.handle('auth:sign-out', async () => {
  // 1. Clear all session cookies, IndexedDB, service workers, and cache
  //    storage across ALL origins. The app only uses localStorage (Zustand
  //    persists to localStorage), so IndexedDB, service workers, caches,
  //    and cookies are exclusively Google's auth data.
  await session.defaultSession.clearStorageData({
    storages: ['cookies', 'indexeddb', 'serviceworkers', 'cachestorage', 'caches']
  });

  // 2. Clear the HTTP disk cache (Google's auth flow may cache responses here)
  await session.defaultSession.clearCache();

  // 3. Extra safety: also explicitly remove known Google auth cookies
  const GOOGLE_SESSION_COOKIES = ['SAPISID', 'APISID', 'SSID', 'HSID', 'OSID', '__Host-GAPS'];
  const cookies = await session.defaultSession.cookies.get({});
  const toRemove = cookies.filter((c) => GOOGLE_SESSION_COOKIES.includes(c.name));
  for (const c of toRemove) {
    try {
      await session.defaultSession.cookies.remove(c.domain || '', c.name);
    } catch {
      // per-cookie removal may fail for some — not fatal
    }
  }

  return { success: true };
});