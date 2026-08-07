import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express from 'express';
import { createServer as createViteServer, type ViteDevServer } from 'vite';

interface RenderResult {
  html: string;
  locale: string;
  teleports: string;
}

type RenderApplication = (url: string) => Promise<RenderResult>;

const root = path.dirname(fileURLToPath(import.meta.url));
const production = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT ?? 5181);
const server = express();
let vite: ViteDevServer | undefined;
let productionTemplate = '';
let developmentTemplate = '';
let productionRender: RenderApplication | undefined;

if (production) {
  const clientDirectory = path.join(root, 'dist/client');
  productionTemplate = await fs.readFile(
    path.join(clientDirectory, 'index.html'),
    'utf8'
  );
  productionRender = (
    await import(
      pathToFileURL(path.join(root, 'dist/server/entry-server.js')).href
    )
  ).render;
  server.use(express.static(clientDirectory, { index: false }));
} else {
  developmentTemplate = await fs.readFile(
    path.join(root, 'index.html'),
    'utf8'
  );
  vite = await createViteServer({
    appType: 'custom',
    root,
    server: { middlewareMode: true },
  });
  server.use(vite.middlewares);
}

server.use(async (request, response, next) => {
  const url = request.originalUrl;

  try {
    const template = production
      ? productionTemplate
      : await vite!.transformIndexHtml(url, developmentTemplate);
    const render = production
      ? productionRender!
      : (await vite!.ssrLoadModule('/src/entry-server.ts')).render;
    const result = await render(url);
    const html = template
      .replace('<!--app-locale-->', escapeHtml(result.locale))
      .replace('<!--app-html-->', result.html)
      .replace('<!--app-teleports-->', result.teleports)
      .replace(
        '<!--app-state-->',
        escapeJson(JSON.stringify({ locale: result.locale }))
      );

    response
      .status(200)
      .set({ 'Content-Type': 'text/html; charset=utf-8' })
      .end(html);
  } catch (error) {
    vite?.ssrFixStacktrace(error as Error);
    next(error);
  }
});

server.listen(port, () => {
  process.stdout.write(
    `gt-vue SSR example running at http://localhost:${port}\n`
  );
});

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeJson(value: string): string {
  return value.replaceAll('<', '\\u003c');
}
