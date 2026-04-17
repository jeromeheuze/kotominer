import { Tray, Menu, nativeImage } from 'electron';
import fs from 'fs';

function fmtTooltipHr(h) {
  if (h >= 1e6) return `${(h / 1e6).toFixed(2)} MH/s`;
  if (h >= 1e3) return `${(h / 1e3).toFixed(2)} kH/s`;
  return `${Math.round(h)} H/s`;
}

/**
 * @param {{
 *   iconPath: string | undefined,
 *   getWindow: () => import('electron').BrowserWindow | null,
 *   miner: import('./miner.js').MinerProcess,
 *   onQuit: () => void,
 * }} opts
 */
export function createAppTray(opts) {
  const { getWindow, miner, onQuit } = opts;
  let iconPath = opts.iconPath;
  if (!iconPath || !fs.existsSync(iconPath)) {
    return { refresh: () => {}, destroy: () => {} };
  }

  let img = nativeImage.createFromPath(iconPath);
  if (img.isEmpty()) {
    return { refresh: () => {}, destroy: () => {} };
  }
  img = img.resize({ width: 16, height: 16 });

  const tray = new Tray(img);
  tray.setIgnoreDoubleClickEvents(true);

  function buildMenu() {
    const running = miner.isRunning();
    const last = miner.getLastMiningConfig();
    return Menu.buildFromTemplate([
      {
        label: 'Show window',
        click: () => {
          const w = getWindow();
          w?.show();
          w?.focus();
        },
      },
      { type: 'separator' },
      running
        ? {
            label: 'Pause mining',
            click: () => miner.stop(),
          }
        : {
            label: 'Resume mining',
            enabled: !!last,
            click: () => {
              if (last) miner.start(last);
            },
          },
      { type: 'separator' },
      {
        label: 'Quit',
        click: onQuit,
      },
    ]);
  }

  function refresh() {
    const s = miner.stats;
    const hr = s.hashrate || 0;
    const acc = s.shares?.accepted ?? 0;
    const active = miner.isRunning();
    const line = active ? `${fmtTooltipHr(hr)} · ${acc} accepted` : 'Idle';
    tray.setToolTip(`Kotominer · ${line}`);
    tray.setContextMenu(buildMenu());
  }

  tray.setToolTip('Kotominer');
  tray.setContextMenu(buildMenu());

  tray.on('click', () => {
    const w = getWindow();
    if (w?.isVisible()) {
      w.focus();
    } else {
      w?.show();
      w?.focus();
    }
  });

  return {
    refresh,
    destroy: () => {
      try {
        tray.destroy();
      } catch {
        /* ignore */
      }
    },
  };
}
