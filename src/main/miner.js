import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { platformArchDir, getBundledResourcesDir } from './miner-paths.js';
import { resolveMinerExecutablePath } from './miner-resolve.js';
import { restoreMinerFromManifest, minerBinaryMissingMessage } from './miner-restore.js';

function parseHashrateToHps(valueStr, unitStr) {
  let v = parseFloat(String(valueStr).replace(/,/g, ''));
  if (Number.isNaN(v)) return null;
  const u = String(unitStr).toLowerCase();
  if (u === 'khash') v *= 1e3;
  else if (u === 'mhash') v *= 1e6;
  else if (u === 'ghash') v *= 1e9;
  return v;
}

export class MinerProcess extends EventEmitter {
  constructor() {
    super();
    this.process = null;
    /** @type {Map<number, number>} thread id → H/s */
    this._threadRates = new Map();
    this.stats = {
      hashrate: 0,
      hashrate_unit: 'H/s',
      shares: { accepted: 0, rejected: 0 },
      /** @type {{ id: number, hashrate: number }[]} */
      threads: [],
      temperature: null,
      uptime: 0,
    };
    this._startTime = null;
    /** Last successful mining config (for tray resume). */
    this.lastMiningConfig = null;
  }

  isRunning() {
    return this.process != null;
  }

  getLastMiningConfig() {
    return this.lastMiningConfig;
  }

  /** Snapshot for renderer after tab switch / remount (main process is source of truth). */
  getStatusForRenderer() {
    return {
      running: this.isRunning(),
      stats: {
        hashrate: this.stats.hashrate,
        hashrate_unit: this.stats.hashrate_unit,
        shares: { ...this.stats.shares },
        threads: this.stats.threads.map((t) => ({ ...t })),
      },
    };
  }

  /** SIGKILL tracked child (e.g. before killing orphans). */
  forceStop() {
    if (this.process) {
      try {
        this.process.kill('SIGKILL');
      } catch {
        /* ignore */
      }
      this.process = null;
    }
    this._startTime = null;
    this._threadRates.clear();
    this.stats.threads = [];
    this.stats.hashrate = 0;
    this.stats.shares = { accepted: 0, rejected: 0 };
    this.emit('stats', { ...this.stats, threads: [] });
    this.emit('stopped');
  }

  getExecutablePath() {
    return resolveMinerExecutablePath();
  }

  bundledPath() {
    return getBundledResourcesDir();
  }

  isBinaryPresent() {
    const p = this.getExecutablePath();
    return !!p && fs.existsSync(p);
  }

  /**
   * @param {{ pool_url: string, wallet_address: string, threads: number, solo?: boolean }} config
   */
  /**
   * @returns {{ ok: true } | { ok: false, error: string }}
   */
  start(config) {
    if (this.process) {
      const err = 'Miner already running';
      this.emit('error', new Error(err));
      return { ok: false, error: err };
    }

    const exe = this.getExecutablePath();
    if (!exe || !fs.existsSync(exe)) {
      const msg = minerBinaryMissingMessage();
      this.emit('error', new Error(msg));
      return { ok: false, error: msg };
    }

    // cpuminer-yescrypt (minerd-*.exe): KOTO uses yescrypt (not default yespower). See resources/win32-x64/start.bat
    const args = [
      '-a',
      'yescrypt',
      '-o',
      config.pool_url,
      '-u',
      config.wallet_address,
      '-p',
      'x',
      '-t',
      String(config.threads),
    ];

    if (config.solo) {
      args.push(`--coinbase-addr=${config.wallet_address}`);
    }

    this._threadRates.clear();
    this.stats.threads = [];
    this.stats.hashrate = 0;
    this.stats.shares = { accepted: 0, rejected: 0 };

    this._startTime = Date.now();
    const cwd = path.dirname(exe);
    this.process = spawn(exe, args, {
      cwd,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.process.stdout.on('data', (data) => this.parseOutput(data.toString()));
    this.process.stderr.on('data', (data) => this.parseOutput(data.toString()));

    this.lastMiningConfig = {
      pool_url: config.pool_url,
      wallet_address: config.wallet_address,
      threads: config.threads,
      solo: !!config.solo,
    };

    this.process.on('error', (err) => {
      this.emit('error', err);
      this.process = null;
    });

    this.process.on('close', (code) => {
      this.emit('close', code);
      this.process = null;
    });

    this.emit('started');
    this.emit('stats', { ...this.stats, threads: [] });
    return { ok: true };
  }

  parseOutput(chunk) {
    const lines = chunk.split(/\r?\n/);
    for (const line of lines) {
      if (!line.trim()) continue;

      // Per-thread: "thread 5: 14305 hashes, 0.77 khash/s"
      const threadM = line.match(
        /\bthread\s+(\d+):\s*\d+\s+hashes,\s*([\d,.]+)\s*(khash|mhash|ghash|hash)\/s/i
      );
      if (threadM) {
        const id = parseInt(threadM[1], 10);
        const hps = parseHashrateToHps(threadM[2], threadM[3]);
        if (hps != null) {
          this._threadRates.set(id, hps);
          this.stats.threads = [...this._threadRates.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([tid, hashrate]) => ({ id: tid, hashrate }));
        }
      }

      // Koto minerd (cpuminer-yescrypt): "Total: 1.74 khash/s" — no HTTP API; stats are stdout only.
      const totalK = line.match(/Total:\s+([\d,.]+)\s*(khash|mhash|ghash|hash)\/s/i);
      if (totalK) {
        const v = parseHashrateToHps(totalK[1], totalK[2]);
        if (v != null) {
          this.stats.hashrate = v;
          this.stats.hashrate_unit = 'H/s';
        }
      } else {
        // cpuminer-opt style: "Total: 1.5 kH/s" / "MH/s"
        const totalHash = line.match(/Total:\s+([\d,.]+)\s+([KMG]?)[Hh]\/s/i);
        if (totalHash) {
          let v = parseFloat(totalHash[1].replace(/,/g, ''));
          const prefix = (totalHash[2] || '').toUpperCase();
          if (prefix === 'K') v *= 1e3;
          else if (prefix === 'M') v *= 1e6;
          else if (prefix === 'G') v *= 1e9;
          this.stats.hashrate = v;
          this.stats.hashrate_unit = 'H/s';
        }
      }

      const share = line.match(/accepted:\s*(\d+)\s*\/\s*(\d+)/i);
      if (share) {
        this.stats.shares.accepted = parseInt(share[1], 10);
        this.stats.shares.rejected = parseInt(share[2], 10);
        // "accepted: 27/27 (100.00%), 11.81 khash/s (yay!!!)"
        const poolRate = line.match(
          /accepted:\s*\d+\s*\/\s*\d+\s*(?:\([^)]*\))?\s*,\s*([\d,.]+)\s*(khash|mhash|ghash|hash)\/s/i
        );
        if (poolRate) {
          const v = parseHashrateToHps(poolRate[1], poolRate[2]);
          if (v != null) {
            this.stats.hashrate = v;
            this.stats.hashrate_unit = 'H/s';
          }
        }
      }

      if (this._startTime) {
        this.stats.uptime = Math.floor((Date.now() - this._startTime) / 1000);
      }

      this.emit('stats', {
        ...this.stats,
        threads: this.stats.threads.map((t) => ({ ...t })),
      });
      this.emit('log', line.trim());
    }
  }

  stop() {
    if (this.process) {
      try {
        // Windows: SIGTERM is unreliable for some native miners; ensure the process dies.
        this.process.kill(process.platform === 'win32' ? 'SIGKILL' : 'SIGTERM');
      } catch {
        /* ignore */
      }
      this.process = null;
    }
    this._startTime = null;
    this._threadRates.clear();
    this.stats.threads = [];
    this.stats.hashrate = 0;
    this.emit('stats', {
      ...this.stats,
      threads: [],
    });
    this.emit('stopped');
  }
}

export async function tryRestoreMiner() {
  const key = platformArchDir();
  return restoreMinerFromManifest(key);
}
