import express from 'express';
import {
  getDefaultLocale,
  getGT,
  getLocale,
  getLocales,
  getMessages,
  initializeGT,
  msg,
  withGT,
} from 'gt-node';
import loadTranslations from './loadTranslations.js';

const defaultLocale = 'en';
const locales = ['en', 'fr', 'zh'];
const port = Number(process.env.PORT ?? 3001);

initializeGT({
  defaultLocale,
  locales,
  projectId: process.env.GT_PROJECT_ID,
  loadTranslations,
});

const STATUS_MESSAGE = msg('gt-node Express test app is running.');
const NOT_FOUND_MESSAGE = msg('Route not found.');

const app = express();

app.use((req, _res, next) => {
  const locale = getRequestedLocale(req.headers['accept-language']);
  withGT(locale, () => next());
});

app.get('/', async (_req, res) => {
  const gt = await getGT();
  const locale = getLocale();

  res.type('html').send(`<!doctype html>
<html lang="${escapeHtml(locale)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(gt('gt-node Express'))}</title>
    <style>
      body {
        margin: 0;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f6f8fb;
        color: #1f2937;
      }
      main {
        max-width: 760px;
        margin: 64px auto;
        padding: 0 24px;
      }
      h1 {
        margin: 0 0 12px;
        font-size: 32px;
        line-height: 1.1;
      }
      p {
        margin: 0 0 18px;
        font-size: 17px;
        line-height: 1.55;
      }
      code {
        border-radius: 4px;
        background: #e8edf4;
        padding: 2px 5px;
      }
      a {
        color: #075985;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(gt('Hello, world!'))}</h1>
      <p>${escapeHtml(gt('Welcome, {name}!', { name: 'Ada' }))}</p>
      <p>${escapeHtml(gt('Current locale: {locale}', { locale }))}</p>
      <p><a href="/api/greeting">${escapeHtml(gt('Open the JSON greeting endpoint.'))}</a></p>
      <p><code>curl -H "Accept-Language: fr" http://localhost:${port}/api/greeting</code></p>
    </main>
  </body>
</html>`);
});

app.get('/api/greeting', async (_req, res) => {
  const gt = await getGT();

  res.json({
    message: gt('Hello, world!'),
    welcome: gt('Welcome, {name}!', { name: 'Ada' }),
    locale: getLocale(),
    defaultLocale: getDefaultLocale(),
    supportedLocales: getLocales(),
  });
});

app.get('/api/status', async (_req, res) => {
  const messages = await getMessages();

  res.json({
    status: messages(STATUS_MESSAGE),
    locale: getLocale(),
  });
});

app.use(async (_req, res) => {
  const messages = await getMessages();

  res.status(404).json({
    error: messages(NOT_FOUND_MESSAGE),
    locale: getLocale(),
  });
});

app.listen(port, () => {
  // oxlint-disable-next-line no-console -- Report the local development URL.
  console.log(`gt-node Express app listening on http://localhost:${port}`);
});

function getRequestedLocale(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header;
  return value?.split(',')[0]?.trim() || defaultLocale;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char] ?? char
  );
}
