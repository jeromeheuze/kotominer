import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * CPU model, logical cores, and a conservative thread recommendation (75% of cores).
 */
export function getCPUInfo() {
  const cpus = os.cpus();
  const cores = cpus.length;
  return {
    model: cpus[0]?.model || 'Unknown CPU',
    cores,
    recommended_threads: Math.max(1, Math.floor(cores * 0.75)),
  };
}

/**
 * Best-effort CPU temperature (°C). Windows / Linux vary; returns null if unknown.
 */
export async function getCPUTemp() {
  const platform = process.platform;
  try {
    if (platform === 'win32') {
      const { stdout } = await execFileAsync(
        'wmic',
        ['path', 'Win32_PerfFormattedData_Counters_ThermalZoneInformation', 'get', 'Temperature', '/value'],
        { windowsHide: true, timeout: 5000 }
      );
      const m = stdout.match(/Temperature=(\d+)/);
      if (m) {
        const t = parseInt(m[1], 10);
        if (!Number.isNaN(t) && t > 0) return Math.round(t / 10);
      }
    }
    if (platform === 'linux') {
      const fs = await import('fs/promises');
      const zones = await fs.readdir('/sys/class/thermal').catch(() => []);
      for (const z of zones) {
        if (!z.startsWith('thermal_zone')) continue;
        try {
          const raw = await fs.readFile(`/sys/class/thermal/${z}/temp`, 'utf8');
          const milli = parseInt(raw.trim(), 10);
          if (!Number.isNaN(milli)) return Math.round(milli / 1000);
        } catch {
          /* continue */
        }
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}
