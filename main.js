'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, 'build', 'icon.ico')
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function initAutoUpdater() {
  if (process.env.NODE_ENV === 'development') {
    console.log('[autoUpdater] Développement détecté, pas de check de mise à jour.');
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('[autoUpdater] Vérification de mise à jour...');
  });

  autoUpdater.on('update-available', info => {
    console.log('[autoUpdater] Mise à jour disponible :', info && info.version ? info.version : '?');
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[autoUpdater] Aucune mise à jour disponible.');
  });

  autoUpdater.on('error', err => {
    console.error('[autoUpdater] Erreur :', err == null ? 'inconnue' : (err.stack || err.toString()));
  });

  autoUpdater.on('download-progress', progress => {
    try {
      const p = progress.percent != null ? progress.percent.toFixed(1) : '?';
      console.log(`[autoUpdater] Téléchargement : ${p}% (${progress.transferred}/${progress.total})`);
    } catch (e) {
      console.log('[autoUpdater] Progress:', progress);
    }
  });

  autoUpdater.on('update-downloaded', info => {
    console.log('[autoUpdater] Mise à jour téléchargée, installation au prochain redémarrage.', info && info.version ? info.version : '');
    // Si tu veux forcer l'installation immédiate au lieu d'attendre la fermeture :
    // autoUpdater.quitAndInstall();
  });

  autoUpdater.checkForUpdatesAndNotify();
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.docovg.minecraft2d');
  }

  createWindow();
  initAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.on('toggle-fullscreen', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return;
  win.setFullScreen(!win.isFullScreen());
});
