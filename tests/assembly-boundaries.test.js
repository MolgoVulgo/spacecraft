import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const ASSEMBLY_DIR = new URL('../src/3d/assembly/', import.meta.url);

async function listJavaScriptFiles(dirUrl) {
  const entries = await readdir(dirUrl, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      files.push(...await listJavaScriptFiles(new URL(`${entry.name}/`, dirUrl)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.js')) files.push(new URL(entry.name, dirUrl));
  }
  return files;
}

test('3d assembly does not import 3d editor', async () => {
  const files = await listJavaScriptFiles(ASSEMBLY_DIR);

  for (const fileUrl of files) {
    const source = await readFile(fileUrl, 'utf8');
    assert.ok(!/from\s+['"][^'"]*3d\/editor[^'"]*['"]/.test(source), `Editor import found in ${fileUrl.pathname}`);
  }
});
