import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import Store from 'electron-store';
import { getBundledResourcesDir, getUserDataMinerPath, platformArchDir } from './miner-paths.js';

/**
 * Order: fastest / newest ISA first (see resources/win32-x64/README.txt from KotoDevelopers zip).
 * Probing falls through on illegal-instruction crashes or failed help.
 */
/** Exported for pool benchmark (run each build against stratum). */
export const WIN_MINERD_ORDER = [
  'minerd-avx2-sha.exe',
  'minerd-avx2.exe',
  'minerd-xop.exe',
  'minerd-avx.exe',
  'minerd-aes-sse42.exe',
  'minerd-sse2.exe',
];

const store = new Store();
const CACHE_KEY = 'miner.selectedExecutable';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Run miner with -h; cwd must be exe dir so Windows loads libcurl next to the exe.
 */
export function probeMinerHelp(exePath) {
  const cwd = path.dirname(exePath);
  if (!fs.existsSync(exePath)) return false;

  let r;
  try {
    r = spawnSync(exePath, ['-h'], {
      cwd,
      encoding: 'utf8',
      timeout: 10_000,
      windowsHide: true,
      maxBuffer: 2_000_000,
    });
  } catch {
    return false;
  }

  if (r.error) return false;

  // Windows: illegal instruction / crash → large NTSTATUS-style exit codes
  if (typeof r.status === 'number' && r.status > 255 && r.status !== 0) {
    return false;
  }

  const out = `${r.stdout || ''}${r.stderr || ''}`;
  if (/usage|help|algorithm|yescrypt|yespower|options/i.test(out)) {
    return true;
  }
  if (r.status === 0) return true;
  return false;
}

function listWindowsCandidates(resourcesDir) {
  const found = [];
  for (const name of WIN_MINERD_ORDER) {
    const p = path.join(resourcesDir, name);
    if (fs.existsSync(p)) found.push(p);
  }
  return found;
}

function resolveWindows(resourcesDir) {
  const cached = store.get(CACHE_KEY);
  const now = Date.now();
  if (cached && typeof cached === 'object' && cached.path && cached.dir === resourcesDir) {
    if (now - (cached.ts || 0) < CACHE_TTL_MS && fs.existsSync(cached.path) && probeMinerHelp(cached.path)) {
      return cached.path;
    }
  }

  const candidates = listWindowsCandidates(resourcesDir);
  for (const exe of candidates) {
    if (probeMinerHelp(exe)) {
      store.set(CACHE_KEY, { path: exe, dir: resourcesDir, ts: now, basename: path.basename(exe) });
      return exe;
    }
  }

  store.delete(CACHE_KEY);
  return null;
}

function resolveLinux(resourcesDir) {
  const single = path.join(resourcesDir, 'cpuminer-koto');
  if (fs.existsSync(single)) return single;
  return null;
}

/**
 * Manual override: single binary in userData/bin (restore flow).
 */
function tryUserOverride() {
  const p = getUserDataMinerPath();
  if (!fs.existsSync(p)) return null;
  if (process.platform === 'win32') {
    if (probeMinerHelp(p)) return p;
    return p;
  }
  try {
    fs.accessSync(p, fs.constants.X_OK);
    return p;
  } catch {
    return null;
  }
}

/**
 * Resolve absolute path to the miner executable for this machine.
 */
export function resolveMinerExecutablePath() {
  const user = tryUserOverride();
  if (user) return user;

  const resourcesDir = getBundledResourcesDir();
  if (!fs.existsSync(resourcesDir)) {
    return null;
  }

  if (process.platform === 'win32') {
    return resolveWindows(resourcesDir);
  }

  if (process.platform === 'linux') {
    return resolveLinux(resourcesDir);
  }

  const fallback = path.join(resourcesDir, 'cpuminer-koto');
  return fs.existsSync(fallback) ? fallback : null;
}

export function getMinerSelectionMeta() {
  const resourcesDir = getBundledResourcesDir();
  const resolved = resolveMinerExecutablePath();
  const cached = store.get(CACHE_KEY);
  return {
    platformDir: platformArchDir(),
    resourcesDir,
    resolved,
    present: !!resolved,
    selectedBasename: resolved ? path.basename(resolved) : null,
    cachedBasename: cached?.basename || null,
    windowsCandidates: process.platform === 'win32' ? WIN_MINERD_ORDER : [],
  };
}

export function clearMinerSelectionCache() {
  store.delete(CACHE_KEY);
}

/**
 * After a pool benchmark, pin the chosen Windows minerd-*.exe (must exist and pass -h probe).
 * Ignores userData override — that still wins in resolveMinerExecutablePath().
 */
export function setSelectedMinerFromBenchmark(basename) {
  if (process.platform !== 'win32') {
    return { ok: false, error: 'Build selection applies to Windows minerd-*.exe only.' };
  }
  if (!basename || typeof basename !== 'string') {
    return { ok: false, error: 'Invalid build name.' };
  }
  const safe = path.basename(basename.trim());
  if (!WIN_MINERD_ORDER.includes(safe)) {
    return { ok: false, error: 'Unknown build.' };
  }
  const resourcesDir = getBundledResourcesDir();
  const exePath = path.join(resourcesDir, safe);
  if (!fs.existsSync(exePath)) {
    return { ok: false, error: `Not found: ${safe}` };
  }
  if (!probeMinerHelp(exePath)) {
    return { ok: false, error: `${safe} does not run on this CPU (probe failed).` };
  }
  const now = Date.now();
  store.set(CACHE_KEY, { path: exePath, dir: resourcesDir, basename: safe, ts: now });
  return { ok: true, basename: safe };
}
