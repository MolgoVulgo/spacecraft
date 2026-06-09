import { rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist');
await rm(join(dist, 'editor.html'), { force: true });
const assets = join(dist, 'assets');
try {
  for (const name of await readdir(assets)) {
    if (/^editor[-.].*\.(js|css|map)$/.test(name)) {
      await rm(join(assets, name), { force: true });
    }
  }
} catch {
  // assets folder may not exist in failed or partial builds.
}
console.log('Assembly distribution pruned: editor.html and editor assets removed.');
