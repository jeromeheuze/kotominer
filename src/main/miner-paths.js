import path from 'path';
import fs from 'fs';
import { app } from 'electron';

/** Legacy single-file override in userData (restore / manual). */
const USER_OVERRIDE_WIN = 'cpuminer-koto.exe';
const USER_OVERRIDE_UNIX = 'cpuminer-koto';

function platformArchDir() {
  const platform = process.platform;
  const arch = process.arch;
  if (platform === 'win32' && arch === 'x64') return 'win32-x64';
  if (platform === 'win32' && arch === 'ia32') return 'win32-x86';
  if (platform === 'linux' && arch === 'x64') return 'linux-x64';
  if (platform === 'linux' && arch === 'arm64') return 'linux-arm64';
  return `${platform}-${arch}`;
}

/**
 * Directory containing platform-specific miner(s) and Windows DLLs.
 */
export function getBundledResourcesDir() {
  const dir = platformArchDir();
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'resources', dir);
  }
  return path.join(app.getAppPath(), 'resources', dir);
}

export function getUserDataMinerPath() {
  const name = process.platform === 'win32' ? USER_OVERRIDE_WIN : USER_OVERRIDE_UNIX;
  return path.join(app.getPath('userData'), 'bin', name);
}

/** @deprecated Use getBundledResourcesDir(); kept for error strings / IPC. */
export function getBundledMinerPath() {
  return path.join(
    getBundledResourcesDir(),
    process.platform === 'win32' ? USER_OVERRIDE_WIN : USER_OVERRIDE_UNIX
  );
}

export function minerFilename() {
  return process.platform === 'win32' ? USER_OVERRIDE_WIN : USER_OVERRIDE_UNIX;
}

export { platformArchDir };
