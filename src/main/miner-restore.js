import fs from 'fs';
import path from 'path';
import https from 'https';
import { createHash } from 'crypto';
import { getUserDataMinerPath, getBundledResourcesDir, minerFilename } from './miner-paths.js';

/**
 * Optional manifest URL (set via env for CI or ship a default in app updates).
 * Example manifest: { "version": "1.0", "assets": { "win32-x64": { "url": "...", "sha256": "..." } } }
 */
const DEFAULT_MANIFEST = process.env.KOTOMINER_MINER_MANIFEST_URL || '';

/**
 * Download miner into userData/bin after SHA256 verify. Stub when no manifest URL.
 * @returns {{ ok: true, path: string } | { ok: false, error: string }}
 */
export async function restoreMinerFromManifest(platformKey) {
  if (!DEFAULT_MANIFEST) {
    return {
      ok: false,
      error:
        'Remote restore is not configured (set KOTOMINER_MINER_MANIFEST_URL or embed a release URL in a future build). Copy cpuminer-koto manually into the bin folder.',
    };
  }

  const manifestJson = await fetchText(DEFAULT_MANIFEST);
  let manifest;
  try {
    manifest = JSON.parse(manifestJson);
  } catch {
    return { ok: false, error: 'Invalid manifest JSON' };
  }

  const asset = manifest.assets?.[platformKey];
  if (!asset?.url || !asset?.sha256) {
    return { ok: false, error: `No asset for ${platformKey} in manifest` };
  }

  const destDir = path.dirname(getUserDataMinerPath());
  fs.mkdirSync(destDir, { recursive: true });
  const tmp = path.join(destDir, `.${minerFilename()}.download`);

  await downloadToFile(asset.url, tmp);
  const hash = sha256File(tmp);
  if (hash.toLowerCase() !== String(asset.sha256).toLowerCase()) {
    fs.unlinkSync(tmp);
    return { ok: false, error: 'SHA256 mismatch — refusing to install' };
  }

  const finalPath = getUserDataMinerPath();
  fs.renameSync(tmp, finalPath);
  if (process.platform !== 'win32') {
    fs.chmodSync(finalPath, 0o755);
  }

  return { ok: true, path: finalPath };
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      })
      .on('error', reject);
  });
}

function downloadToFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https
      .get(url, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          const loc = res.headers.location;
          file.close();
          fs.unlink(destPath, () => {});
          if (!loc) {
            reject(new Error('Redirect without location'));
            return;
          }
          downloadToFile(loc, destPath).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode && res.statusCode >= 400) {
          file.close();
          fs.unlink(destPath, () => {});
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
      })
      .on('error', (err) => {
        file.close();
        fs.unlink(destPath, () => {});
        reject(err);
      });
  });
}

function sha256File(filePath) {
  const buf = fs.readFileSync(filePath);
  return createHash('sha256').update(buf).digest('hex');
}

export function minerBinaryMissingMessage() {
  const dir = getBundledResourcesDir();
  if (process.platform === 'win32') {
    return (
      `No working miner found in:\n${dir}\n\n` +
      `Unpack the KotoDevelopers Windows zip here:\n` +
      `https://github.com/KotoDevelopers/cpuminer-yescrypt/releases\n\n` +
      `Kotominer picks the fastest build your CPU can run, in order:\n` +
      `minerd-avx2-sha.exe → minerd-avx2.exe → minerd-xop.exe → minerd-avx.exe → minerd-aes-sse42.exe → minerd-sse2.exe\n` +
      `(see README.txt in the zip). Keep libcurl / pthread DLLs in the same folder.`
    );
  }
  return `Miner binary not found at:\n${path.join(dir, 'cpuminer-koto')}\n\nAdd a Linux cpuminer-koto build or use Restore (when configured).`;
}
