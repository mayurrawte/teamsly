import { app, BrowserWindow, shell } from 'electron';
import path from 'path';

const isDev = !app.isPackaged;

// Where the renderer loads from. In dev, point at the Next.js dev server.
// In production, set TEAMSLY_URL to your hosted instance, or bundle a Next.js
// standalone build and spawn it locally (TODO — see electron/README.md).
const TEAMSLY_URL =
  process.env.TEAMSLY_URL || (isDev ? 'http://localhost:3000' : 'https://teamsly.app');

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#1a1d21',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  void mainWindow.loadURL(TEAMSLY_URL);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

void app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
