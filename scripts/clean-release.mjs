import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'release');

try {
  fs.rmSync(target, { recursive: true, force: true });
  console.log('Removed release/');
} catch (e) {
  console.error(
    'Could not remove release/ (another program may have files open).\n' +
      'Close Kotominer / Electron if running from release\\win-unpacked, close Explorer windows on that folder, then retry.\n',
    e.message
  );
  process.exit(1);
}
