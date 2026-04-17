import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { getBundledResourcesDir } from './miner-paths.js';
import { WIN_MINERD_ORDER, probeMinerHelp } from './miner-resolve.js';

/** KOTO stratum expects yescrypt; miner default is yespower — must match Mine tab / pool. */
const KOTO_ALGO = 'yescrypt';

function parseHashrateToHps(valueStr, unitStr) {
  let v = parseFloat(String(valueStr).replace(/,/g, ''));
  if (Number.isNaN(v)) return null;
  const u = String(unitStr).toLowerCase();
  if (u === 'khash') v *= 1e3;
  else if (u === 'mhash') v *= 1e6;
  else if (u === 'ghash') v *= 1e9;
  return v;
}

/**
 * One log line may contain Total:, pool accepted rate, or cpuminer-opt kH/s style.
 */
function parseLineForHps(line) {
  if (!line || !line.trim()) return null;

  const poolAccepted = line.match(
    /accepted:\s*\d+\s*\/\s*\d+[\s\S]*?,\s*([\d,.]+)\s*(khash|mhash|ghash|hash)\/s/i
  );
  if (poolAccepted) {
    return parseHashrateToHps(poolAccepted[1], poolAccepted[2]);
  }

  const totalK = line.match(/Total:\s+([\d,.]+)\s*(khash|mhash|ghash|hash)\/s/i);
  if (totalK) {
    return parseHashrateToHps(totalK[1], totalK[2]);
  }

  const totalAlt = line.match(/Total:\s+([\d,.]+)\s+([KMG]?)[Hh]\/s/i);
  if (totalAlt) {
    let v = parseFloat(totalAlt[1].replace(/,/g, ''));
    if (Number.isNaN(v)) return null;
    const prefix = (totalAlt[2] || '').toUpperCase();
    if (prefix === 'K') v *= 1e3;
    else if (prefix === 'M') v *= 1e6;
    else if (prefix === 'G') v *= 1e9;
    return v;
  }

  return null;
}

function explainWindowsExit(code) {
  if (code == null || code === 0) return null;
  const u = code >>> 0;
  if (u === 0xc0000005) return 'Process crashed (0xC0000005 access violation — often wrong CPU build).';
  if (u === 0xc000001d) return 'Illegal instruction (0xC000001D — CPU cannot run this build).';
  if (u >= 0xc0000000) {
    return `Windows error 0x${u.toString(16)} (crash or incompatible binary — try another minerd build).`;
  }
  return null;
}

/**
 * @param {import('child_process').ChildProcessWithoutNullStreams} proc
 */
function killProcessTree(proc) {
  if (!proc || proc.killed) return;
  try {
    proc.kill('SIGTERM');
  } catch {
    /* ignore */
  }
  setTimeout(() => {
    try {
      if (!proc.killed) proc.kill('SIGKILL');
    } catch {
      /* ignore */
    }
  }, 2500);
}

/**
 * Append chunk to a line buffer; invoke onLine for each complete line.
 * Call flush() on process exit so the last line without \n is still parsed.
 */
function createLineSplitter(onLine) {
  let buf = '';
  return {
    push(chunk) {
      buf += chunk.toString('utf8');
      const parts = buf.split(/\r?\n/);
      buf = parts.pop() ?? '';
      for (const line of parts) {
        onLine(line);
      }
    },
    flush() {
      if (buf.trim()) {
        onLine(buf);
      }
      buf = '';
    },
  };
}

/**
 * @param {{
 *   exePath: string,
 *   pool_url: string,
 *   wallet_address: string,
 *   threads: number,
 *   warmupSec: number,
 *   measureSec: number,
 *   send: (payload: object) => void,
 *   shouldAbort: () => boolean,
 * }} opts
 */
function runOnePoolBenchmark(opts) {
  const { exePath, pool_url, wallet_address, threads, warmupSec, measureSec, send, shouldAbort } = opts;
  const basename = path.basename(exePath);
  const cwd = path.dirname(exePath);

  return new Promise((resolve) => {
    let settled = false;
    let maxHps = 0;
    const started = Date.now();
    let abortPoll = null;
    let hardStop = null;
    /** Last lines for diagnostics if no rate captured */
    const tail = [];
    const pushTail = (line) => {
      const t = line.trim();
      if (!t) return;
      tail.push(t);
      if (tail.length > 12) tail.shift();
    };

    const finish = (payload) => {
      if (settled) return;
      settled = true;
      if (abortPoll) clearInterval(abortPoll);
      if (hardStop) clearTimeout(hardStop);
      resolve(payload);
    };

    let proc;
    try {
      proc = spawn(
        exePath,
        ['-a', KOTO_ALGO, '-o', pool_url, '-u', wallet_address, '-p', 'x', '-t', String(threads)],
        {
          cwd,
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      );
    } catch (e) {
      finish({ basename, hps: null, error: String(e.message || e) });
      return;
    }

    function handleLine(line) {
      pushTail(line);
      const hps = parseLineForHps(line);
      if (hps == null) return;
      const elapsedSec = (Date.now() - started) / 1000;
      if (elapsedSec < warmupSec) return;
      if (hps > maxHps) maxHps = hps;
      send({ phase: 'sample', basename, hps, maxHps });
    }

    const feedOut = createLineSplitter(handleLine);
    const feedErr = createLineSplitter(handleLine);

    proc.stdout.on('data', (c) => feedOut.push(c));
    proc.stderr.on('data', (c) => feedErr.push(c));

    proc.on('error', (err) => {
      finish({ basename, hps: maxHps || null, error: String(err.message || err) });
    });

    proc.on('close', (code) => {
      feedOut.flush();
      feedErr.flush();

      let err = null;
      if (maxHps > 0) {
        err = null;
      } else {
        const winHint = process.platform === 'win32' ? explainWindowsExit(code) : null;
        if (winHint) {
          err = winHint;
        } else if (code !== 0 && code !== null) {
          err = `Process exited (${code})`;
        } else {
          const hint = tail.length ? ` Last log: ${tail.slice(-3).join(' | ')}` : '';
          err = `No hashrate lines parsed (need Total or accepted … khash/s). Check pool URL, wallet.worker, and that the pool accepts yescrypt.${hint}`;
        }
      }
      finish({ basename, hps: maxHps || null, error: err });
    });

    const totalMs = (warmupSec + measureSec) * 1000;

    hardStop = setTimeout(() => {
      killProcessTree(proc);
    }, totalMs);

    abortPoll = setInterval(() => {
      if (!shouldAbort?.()) return;
      killProcessTree(proc);
      finish({ basename, hps: maxHps || null, error: 'Cancelled' });
    }, 250);
  });
}

/**
 * Run each bundled Windows minerd variant (or one Linux binary) against the pool for a timed sample.
 *
 * @param {{
 *   pool_url: string,
 *   wallet_address: string,
 *   threads: number,
 *   warmupSec?: number,
 *   measureSec?: number,
 *   send: (p: object) => void,
 *   shouldAbort: () => boolean,
 * }} opts
 */
export async function runPoolBenchmarkSuite(opts) {
  const {
    pool_url,
    wallet_address,
    threads,
    warmupSec = 12,
    measureSec = 35,
    send,
    shouldAbort,
  } = opts;

  const resourcesDir = getBundledResourcesDir();
  if (!fs.existsSync(resourcesDir)) {
    return { ok: false, error: 'Miner resources folder not found.', results: [] };
  }

  /** @type {{ basename: string, hps: number | null, error: string | null }[]} */
  const results = [];

  if (process.platform === 'win32') {
    for (const name of WIN_MINERD_ORDER) {
      if (shouldAbort?.()) break;
      const exePath = path.join(resourcesDir, name);
      if (!fs.existsSync(exePath)) continue;

      if (!probeMinerHelp(exePath)) {
        const row = { basename: name, hps: null, error: 'Does not run on this CPU (skipped).' };
        results.push(row);
        send({ phase: 'exe-start', basename: name });
        send({ phase: 'exe-done', result: row });
        continue;
      }

      send({ phase: 'exe-start', basename: name });
      const result = await runOnePoolBenchmark({
        exePath,
        pool_url,
        wallet_address,
        threads,
        warmupSec,
        measureSec,
        send,
        shouldAbort,
      });
      results.push(result);
      send({ phase: 'exe-done', result });
    }
    return { ok: true, results };
  }

  if (process.platform === 'linux') {
    const exePath = path.join(resourcesDir, 'cpuminer-koto');
    if (!fs.existsSync(exePath)) {
      return { ok: false, error: 'cpuminer-koto not found in resources.', results: [] };
    }
    send({ phase: 'exe-start', basename: 'cpuminer-koto' });
    const result = await runOnePoolBenchmark({
      exePath,
      pool_url,
      wallet_address,
      threads,
      warmupSec,
      measureSec,
      send,
      shouldAbort,
    });
    results.push(result);
    send({ phase: 'exe-done', result });
    return { ok: true, results };
  }

  return {
    ok: false,
    error: 'Pool benchmark is supported on Windows (minerd-*.exe) and Linux (cpuminer-koto).',
    results: [],
  };
}
