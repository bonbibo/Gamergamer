import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { startPythonService, stopPythonService } from './pythonBridge';
import { registerIpcHandlers } from './ipcHandlers';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0f0f13',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function getOrCreateUserId(): string {
  const userDataPath = app.getPath('userData');
  const idFile = path.join(userDataPath, 'user_id.txt');
  try {
    if (fs.existsSync(idFile)) {
      const stored = fs.readFileSync(idFile, 'utf-8').trim();
      if (stored.length === 36) return stored;  // valid UUID
    }
  } catch { /* fall through */ }
  const newId = crypto.randomUUID();
  try { fs.writeFileSync(idFile, newId, 'utf-8'); } catch { /* ignore */ }
  return newId;
}

app.whenReady().then(async () => {
  // Register userId IPC before handlers so renderer can get stable ID on load
  const storedUserId = getOrCreateUserId();
  ipcMain.handle('userId:get', () => storedUserId);

  registerIpcHandlers();

  try {
    await startPythonService();
  } catch (err) {
    console.error('Failed to start Python service:', err);
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopPythonService();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopPythonService();
});
