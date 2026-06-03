import { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';

const isDev = !app.isPackaged;

// Where the renderer loads from. In dev, point at the Next.js dev server.
// In production, set TEAMSLY_URL to your hosted instance, or bundle a Next.js
// standalone build and spawn it locally (see electron/README.md).
const TEAMSLY_URL =
  process.env.TEAMSLY_URL || (isDev ? 'http://localhost:3000' : 'https://teamsly.vercel.app');

// Windows requires the App User Model ID to be set before the app is ready so
// that renderer-side Notification shows the correct app name in Action Center.
if (process.platform === 'win32') {
  app.setAppUserModelId('co.shipthis.teamsly');
}

// Flag to distinguish user-requested quit (via tray menu) from window close.
let isQuitting = false;

// Whether a check was triggered by the user (vs. the silent startup check).
let userInitiatedCheck = false;

// macOS unsigned builds cannot auto-install — Gatekeeper rejects unsigned zips.
// On Linux (AppImage) and Windows (NSIS) auto-install works; user may have to
// click through SmartScreen on Windows but the install completes.
const AUTO_INSTALL_SUPPORTED = process.platform === 'linux' || process.platform === 'win32';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// ─── Unread indicators ────────────────────────────────────────────────────────

function updateUnreadIndicators(n: number): void {
  const label = n > 0 ? `Teamsly — ${n} unread` : 'Teamsly';
  tray?.setToolTip(label);

  if (process.platform === 'darwin') {
    app.dock?.setBadge(n > 0 ? String(n) : '');
  }
  // Windows overlay icon (e.g. a red dot) is deferred to a future release
  // because it requires an additional icon resource and signing infrastructure.
}

// ─── Auto-updater ─────────────────────────────────────────────────────────────

function setupAutoUpdater(): void {
  // Keep downloads automatic so the renderer progression goes:
  // update-available → downloading (with %) → update-downloaded.
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = AUTO_INSTALL_SUPPORTED;

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update-available', { version: info.version });
  });

  autoUpdater.on('update-not-available', () => {
    if (userInitiatedCheck) {
      mainWindow?.webContents.send('update-not-available', {});
    }
    userInitiatedCheck = false;
  });

  autoUpdater.on('error', (err: Error) => {
    console.error('[auto-updater] error:', err.message);
    if (userInitiatedCheck) {
      mainWindow?.webContents.send('update-error', { message: err.message });
    }
    userInitiatedCheck = false;
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update-download-progress', {
      percent: Math.round(progress.percent),
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('update-downloaded', { version: info.version });
    userInitiatedCheck = false;
  });
}

// ─── Tray ─────────────────────────────────────────────────────────────────────

function buildTrayIcon(): Tray {
  const resourcesDir = path.join(__dirname, '..', 'build-resources');

  let icon: Electron.NativeImage;
  if (process.platform === 'darwin') {
    // Electron auto-discovers tray@2x.png for HiDPI when placed alongside tray.png.
    icon = nativeImage.createFromPath(path.join(resourcesDir, 'tray.png'));
    icon.setTemplateImage(true); // macOS auto-inverts on dark/light menu bar
  } else {
    icon = nativeImage.createFromPath(path.join(resourcesDir, 'tray-color.png'));
  }

  const t = new Tray(icon);
  t.setToolTip('Teamsly');

  const menu = Menu.buildFromTemplate([
    {
      label: 'Open Teamsly',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Teamsly',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  t.setContextMenu(menu);

  // Left-click toggles window visibility on Windows / Linux.
  // On macOS the OS shows the context menu on left-click, no-op here.
  if (process.platform !== 'darwin') {
    t.on('click', () => {
      if (!mainWindow) return;
      if (mainWindow.isVisible() && mainWindow.isFocused()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  }

  return t;
}

// ─── App menu (macOS only) ────────────────────────────────────────────────────

function buildAppMenu(): void {
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null);
    return;
  }

  const viewSubmenu: Electron.MenuItemConstructorOptions[] = [
    { role: 'reload', accelerator: 'CmdOrCtrl+R' },
    { role: 'forceReload', accelerator: 'CmdOrCtrl+Shift+R' },
    { type: 'separator' },
    {
      label: 'Check for Updates…',
      click: () => {
        userInitiatedCheck = true;
        void autoUpdater.checkForUpdates();
      },
    },
  ];
  if (isDev) {
    viewSubmenu.push({ role: 'toggleDevTools', accelerator: 'CmdOrCtrl+Alt+I' });
  }

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Teamsly',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        {
          label: 'Quit Teamsly',
          accelerator: 'Cmd+Q',
          click: () => {
            isQuitting = true;
            app.quit();
          },
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: viewSubmenu,
    },
    {
      label: 'Help',
      submenu: [
        {
          // Opens GitHub's template chooser so the user picks bug vs feature
          // on GitHub's own UI — simpler than routing through the in-app modal.
          label: 'Send feedback…',
          click: () => {
            void shell.openExternal(
              'https://github.com/mayurrawte/teamsly/issues/new/choose'
            );
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── Main window ──────────────────────────────────────────────────────────────

// Branded offline page (as a data: URL) shown when the renderer can't reach the
// app. The Retry button re-navigates to the real app URL; if it's still
// unreachable, did-fail-load fires again and brings the user back here.
function offlineFallbackUrl(targetUrl: string): string {
  const safeUrl = targetUrl.replace(/'/g, '%27');
  const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  html,body{height:100%;margin:0}
  body{display:flex;align-items:center;justify-content:center;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    background:#0B0F1A;color:#d1d2d3}
  .box{text-align:center;max-width:340px;padding:24px}
  h1{font-size:16px;font-weight:600;margin:0 0 8px}
  p{font-size:13px;color:#6c6f75;margin:0 0 20px;line-height:1.5}
  button{font:inherit;font-size:13px;font-weight:600;color:#fff;background:#6366F1;
    border:0;border-radius:6px;padding:9px 20px;cursor:pointer}
  button:hover{background:#4F46E5}
</style></head><body><div class="box">
  <h1>Can&rsquo;t reach Teamsly</h1>
  <p>Check your internet connection and try again.</p>
  <button onclick="location.href='${safeUrl}'">Retry</button>
</div></body></html>`;
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
}

function createWindow(): void {
  const appIcon = nativeImage.createFromPath(
    path.join(__dirname, '..', 'build-resources', 'icon.png')
  );

  // macOS: set dock icon in dev (packaged builds get it from the .app bundle).
  if (process.platform === 'darwin' && isDev) {
    app.dock?.setIcon(appIcon);
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#1a1d21',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    // icon is used by Windows/Linux; macOS reads it from the .app bundle
    icon: appIcon,
    // Start hidden and reveal on first paint so launch shows the rendered app
    // instead of an empty window while the renderer loads (no startup flash).
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Keep timers/notifications alive when the window is backgrounded (e.g.
      // hidden to tray) so realtime updates and unread counts don't stall.
      backgroundThrottling: false,
    },
  });

  // Reveal once the first frame is painted — the no-flash launch.
  mainWindow.once('ready-to-show', () => mainWindow?.show());

  // If the app URL can't be reached (offline / host down), show a branded retry
  // page instead of a raw Chromium error, and make sure the window is visible
  // (ready-to-show may never fire when the very first load fails).
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, _desc, _url, isMainFrame) => {
    // ERR_ABORTED (-3) fires on ordinary in-app navigations; ignore it + subframes.
    if (!isMainFrame || errorCode === -3) return;
    void mainWindow?.loadURL(offlineFallbackUrl(TEAMSLY_URL));
    mainWindow?.show();
  });

  void mainWindow.loadURL(TEAMSLY_URL);

  // Suppress the default Chromium context menu in production so users don't
  // see "Inspect Element" and other devtools options in a packaged build.
  if (!isDev) {
    mainWindow.webContents.on('context-menu', (event) => {
      event.preventDefault();
    });
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Hide instead of quit on close — the tray is the way back.
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── IPC ──────────────────────────────────────────────────────────────────────

ipcMain.on('unread-count', (_event, n: number) => {
  updateUnreadIndicators(n);
});

ipcMain.on('update-check', () => {
  userInitiatedCheck = true;
  void autoUpdater.checkForUpdates();
});

ipcMain.on('update-install', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.on('update-open-releases', () => {
  void shell.openExternal('https://github.com/mayurrawte/teamsly/releases/latest');
});

// Sync handler — the notification de-dupe guard in the renderer needs
// a "is the BrowserWindow actually focused right now?" answer before deciding
// to skip a ding. Using ipcRenderer.sendSync stays cheap (single boolean) and
// avoids racing against an async resolution in the hot notification path.
ipcMain.on('window-is-focused', (event) => {
  event.returnValue = mainWindow?.isFocused() ?? false;
});

// ─── App lifecycle ────────────────────────────────────────────────────────────

void app.whenReady().then(() => {
  buildAppMenu();
  tray = buildTrayIcon();
  createWindow();
  setupAutoUpdater();

  // Silent startup check — do not block the window from loading.
  if (!isDev) {
    void autoUpdater.checkForUpdates().catch((err: Error) => {
      console.error('[auto-updater] startup check failed:', err.message);
    });
  }
});

// Keep the process alive even when all windows are closed (they're just hidden).
// The only exit path is the "Quit Teamsly" tray item (or Cmd+Q on macOS).
app.on('window-all-closed', () => {
  // Intentionally empty — do not quit when the window is hidden.
});

app.on('activate', () => {
  // macOS: re-show the window if the user clicks the dock icon.
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  } else {
    createWindow();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});
