import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const catalogPath = resolve(__dirname, 'public/data/4x3x1_catalog.json');

function readRequestBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
    req.on('error', rejectBody);
  });
}

function catalogFileApiPlugin() {
  return {
    name: 'spacecraft-catalog-file-api',
    configureServer(server) {
      server.middlewares.use('/api/catalog/write', async (req, res, next) => {
        if (req.method !== 'PUT' && req.method !== 'POST') return next();

        try {
          const raw = await readRequestBody(req);
          const catalog = JSON.parse(raw);

          if (!catalog || !Array.isArray(catalog.catalog_pieces) || !Array.isArray(catalog.shape_variants)) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: 'Invalid rich catalog payload.' }));
            return;
          }

          await fs.mkdir(dirname(catalogPath), { recursive: true });
          await fs.writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, path: 'public/data/4x3x1_catalog.json' }));
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
