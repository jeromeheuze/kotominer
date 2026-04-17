import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { createAppTray } from './tray.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Store from 'electron-store';
import { MinerProcess, tryRestoreMiner } from './miner.js';
import { getCPUInfo, getCPUTemp } from './hardware.js';
import { getMinerSelectionMeta, clearMinerSelectionCache, setSelectedMinerFromBenchmark } from './miner-resolve.js';
import { killOrphanMinerProcesses } from './miner-kill-orphans.js';
import { runPoolBenchmarkSuite } from './miner-benchmark.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Repo root (kotominer/) in dev; inside asar the packaged app may not include build/ — window icon still set by installer on Windows. */
const projectRoot = path.join(__dirname, '../..');

function resolveWindowIcon() {
  const ico = path.join(projectRoot, 'build', 'icon.ico');
  const png = path.join(projectRoot, 'build', 'icon.png');
  if (process.platform === 'win32' && fs.existsSync(ico)) return ico;
  if (fs.existsSync(png)) return png;
  if (fs.existsSync(ico)) return ico;
  return undefined;
}

const store = new Store({
  defaults: {
    wallet_address: '',
    pool_url: 'stratum+tcp://koto.isekai-pool.com:3301',
    threads: null,
    cpu_priority: 2,
    auto_start: false,
    minimize_to_tray: true,
    temp_warning: 80,
    theme: 'dark',
    language: 'en',
  },
});

let mainWindow = null;
const miner = new MinerProcess();
let appTray = { refresh: () => {}, destroy: () => {} };
let allowQuit = false;
let benchmarkAbort = false;
/** When false, first `before-quit` cleans up miner/orphans then calls `app.quit()` again. */
let isQuitting = false;

function createWindow() {
  const preloadPath = path.join(__dirname, '../preload/preload.cjs');

  const iconPath = resolveWindowIcon();
  mainWindow = new BrowserWindow({
    ...(iconPath ? { icon: iconPath } : {}),
    width: 1080,
    height: 720,
    minWidth: 880,
    minHeight: 600,
    backgroundColor: '#0d0f14',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
    },
    title: 'Kotominer',
    show: false,
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('close', (e) => {
    if (!allowQuit && store.get('minimize_to_tray')) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function wireMinerEvents(bumpTray) {
  miner.on('stats', (s) => {
    bumpTray?.();
    mainWindow?.webContents.send('miner:stats', s);
  });
  miner.on('log', (line) => {
    mainWindow?.webContents.send('miner:log', line);
  });
  miner.on('error', (err) => {
    mainWindow?.webContents.send('miner:error', err.message || String(err));
  });
  miner.on('close', (code) => {
    appTray.refresh();
    mainWindow?.webContents.send('miner:close', code);
  });
  miner.on('started', () => {
    appTray.refresh();
    mainWindow?.webContents.send('miner:started');
  });
  miner.on('stopped', () => {
    appTray.refresh();
    mainWindow?.webContents.send('miner:stopped');
  });
}

function registerIpc() {
  ipcMain.handle('settings:get', () => store.store);

  ipcMain.handle('settings:set', (_e, partial) => {
    for (const [k, v] of Object.entries(partial || {})) {
      store.set(k, v);
    }
    return store.store;
  });

  ipcMain.handle('hardware:cpu', () => getCPUInfo());

  ipcMain.handle('hardware:temp', () => getCPUTemp());

  ipcMain.handle('miner:paths', () => getMinerSelectionMeta());

  ipcMain.handle('miner:clearSelectionCache', () => {
    clearMinerSelectionCache();
    return { ok: true };
  });

  ipcMain.handle('miner:setBenchmarkWinner', (_e, payload) => {
    const basename = payload?.basename;
    return setSelectedMinerFromBenchmark(basename);
  });

  ipcMain.handle('miner:restore', async () => tryRestoreMiner());

  ipcMain.handle('miner:start', (_e, cfg) => {
    return miner.start(cfg);
  });

  ipcMain.handle('miner:stop', () => {
    miner.stop();
    return { ok: true };
  });

  ipcMain.handle('miner:status', () => miner.getStatusForRenderer());

  ipcMain.handle('miner:killAll', async () => {
    try {
      miner.forceStop();
      await killOrphanMinerProcesses();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('miner:benchmarkCancel', () => {
    benchmarkAbort = true;
    return { ok: true };
  });

  ipcMain.handle('miner:benchmarkRun', async (_e, payload) => {
    if (miner.isRunning()) {
      return { ok: false, error: 'Stop mining before running a benchmark.' };
    }
    benchmarkAbort = false;
    const wc = mainWindow?.webContents;
    if (!wc) {
      return { ok: false, error: 'Window not ready.' };
    }

    const {
      pool_url,
      wallet_address,
      threads,
      warmupSec = 12,
      measureSec = 35,
    } = payload || {};

    if (!pool_url || !wallet_address || typeof threads !== 'number' || threads < 1) {
      return { ok: false, error: 'Pool URL, wallet, and thread count are required.' };
    }

    const send = (msg) => {
      try {
        wc.send('miner:benchmark-progress', msg);
      } catch {
        /* window gone */
      }
    };

    return runPoolBenchmarkSuite({
      pool_url: String(pool_url).trim(),
      wallet_address: String(wallet_address).trim(),
      threads,
      warmupSec: Math.min(120, Math.max(5, Number(warmupSec) || 12)),
      measureSec: Math.min(180, Math.max(15, Number(measureSec) || 35)),
      send,
      shouldAbort: () => benchmarkAbort,
    });
  });

  ipcMain.handle('shell:openExternal', (_e, url) => {
    shell.openExternal(url);
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
  const cpu = getCPUInfo();
  if (store.get('threads') == null) {
    store.set('threads', cpu.recommended_threads);
  }

  function onTrayQuit() {
    allowQuit = true;
    app.quit();
  }

  const iconPath = resolveWindowIcon();
  appTray = createAppTray({
    iconPath,
    getWindow: () => mainWindow,
    miner,
    onQuit: onTrayQuit,
  });
  let trayDebounce = null;
  const bumpTray = () => {
    clearTimeout(trayDebounce);
    trayDebounce = setTimeout(() => appTray.refresh(), 400);
  };

  wireMinerEvents(bumpTray);
  registerIpc();

  createWindow();

  mainWindow?.webContents.once('did-finish-load', () => {
    if (!store.get('auto_start')) return;
    const w = store.get('wallet_address');
    const pool = store.get('pool_url');
    const threads = store.get('threads');
    if (!w || typeof threads !== 'number' || threads < 1) return;
    if (!miner.isBinaryPresent()) return;
    miner.start({ pool_url: pool, wallet_address: w, threads, solo: false });
  });

  bumpTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (!store.get('minimize_to_tray')) {
      app.quit();
    }
  }
});

app.on('before-quit', (e) => {
  if (isQuitting) return;
  e.preventDefault();
  isQuitting = true;
  (async () => {
    try {
      miner.forceStop();
      await killOrphanMinerProcesses({ timeout: 8000 });
    } catch {
      /* ignore */
    } finally {
      try {
        appTray.destroy();
      } catch {
        /* ignore */
      }
      app.quit();
    }
  })();
});
