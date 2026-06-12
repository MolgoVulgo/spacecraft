import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readSource(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('assembly entry still loads assembly_catalog.json only', async () => {
  const source = await readSource('src/main.js');

  assert.match(source, /data\/assembly_catalog\.json/);
  assert.doesNotMatch(source, /data\/editor_catalog\.json/);
});

test('editor entry loads editor_catalog.json and avoids legacy write route', async () => {
  const source = await readSource('src/editor.js');

  assert.match(source, /data\/editor_catalog\.json/);
  assert.match(source, /\/api\/editor-catalog\/write/);
  assert.doesNotMatch(source, /\/api\/catalog\/write/);
});
