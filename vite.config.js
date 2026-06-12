import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';
import { validateCatalogData } from './src/catalog-validator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const editorCatalogPath = resolve(__dirname, 'public/data/editor_catalog.json');
const assemblyCatalogPath = resolve(__dirname, 'public/data/assembly_catalog.json');

function readRequestBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
    req.on('error', rejectBody);
  });
}

function catalogFileApiPlugin() {
  async function writeCatalogFile(req, res, path, { strictAssembly = false } = {}) {
    const raw = await readRequestBody(req);
    const catalog = JSON.parse(raw);

    if (
      !catalog
      || !Array.isArray(catalog.catalog_pieces)
      || !Array.isArray(catalog.shape_variants)
      || !Array.isArray(catalog.sizes)
      || !Array.isArray(catalog.families)
    ) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'Invalid rich catalog payload.' }));
      return;
    }

    if (strictAssembly) {
      const validation = validateCatalogData(catalog);
      if (!validation.valid) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: validation.errors.map((issue) => `${issue.path}: ${issue.message}`).join(' | ') }));
        return;
      }
      if ((catalog.catalog_pieces?.length ?? 0) === 0) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: 'Assembly catalog must contain at least one catalog piece.' }));
        return;
      }
      if ((catalog.shape_variants ?? []).some((shape) => shape?.status !== 'validated')) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: 'Assembly catalog accepts validated shapes only.' }));
        return;
      }
    }

    await fs.mkdir(dirname(path), { recursive: true });
    await fs.writeFile(path, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, path: path.endsWith('editor_catalog.json') ? 'public/data/editor_catalog.json' : 'public/data/assembly_catalog.json' }));
  }

  return {
    name: 'spacecraft-catalog-file-api',
    configureServer(server) {
      server.middlewares.use('/api/editor-catalog/write', async (req, res, next) => {
        if (req.method !== 'PUT' && req.method !== 'POST') return next();

        try {
          await writeCatalogFile(req, res, editorCatalogPath);
        } catch (error) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: error.message }));
        }
      });

      server.middlewares.use('/api/assembly-catalog/write', async (req, res, next) => {
        if (req.method !== 'PUT' && req.method !== 'POST') return next();

        try {
          await writeCatalogFile(req, res, assemblyCatalogPath, { strictAssembly: true });
        } catch (error) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: error.message }));
        }
      });
    },
  };
}

export default defineConfig({
  base: '/spacecraft/',
  plugins: [catalogFileApiPlugin()],
  build: {
    rollupOptions: {
      input: {
        assembly: resolve(__dirname, 'index.html'),
        editor: resolve(__dirname, 'editor.html'),
      },
    },
  },
});
