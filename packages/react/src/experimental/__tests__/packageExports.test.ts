/**
 * `gt-react/experimental` publishes every gt-react export plus the locale
 * twin versions, under every condition gt-react publishes, and the regular
 * entry points carry no locale twin API.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageRoot = fileURLToPath(new URL('../../..', import.meta.url));

const TWIN_ONLY_EXPORTS = [
  'GtInternalRegisterLocaleTwin',
  'markNavigatingReload',
  'createLocaleTwinDocument',
  'resolveLocaleTwinLocale',
  'getLocaleTwinAssetHeaders',
  'getLocaleTwinDocumentHeaders',
  'applyLocaleTwinDocumentHeaders',
];

// Regular gt-react exports the experimental entry passes through or replaces
const SHARED_EXPORTS = [
  'GTProvider',
  'T',
  'useGT',
  'useMessages',
  'msg',
  't',
  'initializeGT',
  'initializeGTSPA',
  'LocaleSelector',
  'useLocale',
  'Var',
];

function node(conditions: string[], format: 'esm' | 'cjs', body: string) {
  const load =
    format === 'esm'
      ? `const experimental = await import('gt-react/experimental'); const regular = await import('gt-react');`
      : `const experimental = require('gt-react/experimental'); const regular = require('gt-react');`;
  const script = `(async () => { ${load} ${body} })().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });`;
  execFileSync(
    process.execPath,
    [
      ...conditions.map((condition) => `--conditions=${condition}`),
      ...(format === 'esm' ? ['--input-type=module'] : []),
      '--eval',
      script,
    ],
    { cwd: packageRoot, stdio: 'pipe' }
  );
}

const CHECK_EXPORTS = `
  const names = ${JSON.stringify([...TWIN_ONLY_EXPORTS, ...SHARED_EXPORTS])};
  const missing = names.filter((name) => typeof experimental[name] !== 'function');
  if (missing.length) throw new Error('missing: ' + missing.join(', '));
  const leaked = ${JSON.stringify(TWIN_ONLY_EXPORTS)}.filter((name) => name in regular);
  if (leaked.length) throw new Error('gt-react leaked: ' + leaked.join(', '));
  for (const name of ['T', 'useGT', 'useMessages', 't', 'msg', 'GTProvider', 'initializeGT']) {
    if (experimental[name] === regular[name]) throw new Error(name + ' is the regular one');
  }
  if (experimental.LocaleSelector !== regular.LocaleSelector) {
    throw new Error('LocaleSelector is not the regular one');
  }
`;

describe('gt-react/experimental', () => {
  it.each([
    ['default', []],
    ['browser', ['browser']],
    ['worker', ['worker']],
    ['workerd', ['workerd']],
  ])('exports the locale twin API (ESM, %s condition)', (_name, conditions) => {
    node(conditions, 'esm', CHECK_EXPORTS);
  });

  it.each([
    ['default', []],
    ['browser', ['browser']],
  ])('exports the locale twin API (CJS, %s condition)', (_name, conditions) => {
    node(conditions, 'cjs', CHECK_EXPORTS);
  });

  // React Server Components keep the regular components; only the exports
  // that need no hooks are added
  it.each(['esm', 'cjs'] as const)(
    'exports the hook-free locale twin API (%s, react-server condition)',
    (format) => {
      node(
        ['react-server'],
        format,
        `
          const names = ${JSON.stringify(TWIN_ONLY_EXPORTS)};
          const missing = names.filter((name) => typeof experimental[name] !== 'function');
          if (missing.length) throw new Error('missing: ' + missing.join(', '));
          if (experimental.T !== regular.T) throw new Error('T is not the RSC one');
        `
      );
    }
  );

  it('serves locale twin documents', () => {
    node(
      [],
      'esm',
      `
        const html =
          '<!doctype html><html lang="en"><head>' +
          '<script type="application/json" id="gt-locale-twins-data">' +
          JSON.stringify({
            version: 1,
            defaultLocale: 'en',
            locales: ['en', 'fr'],
            localeCookieName: 'generaltranslation.locale',
            tags: [{ tag: 'script', attributes: { type: 'module' }, urls: { en: '/a.en.js', fr: '/a.fr.js' } }],
          }) +
          '</script><script data-gt-locale-twins-bootstrap src="/b.js"></script></head></html>';
        const document = experimental.createLocaleTwinDocument({ html });
        const response = document.respond(
          new Request('https://example.com/', { headers: { 'accept-language': 'fr' } })
        );
        if (response.headers.get('vary') !== 'Cookie, Accept-Language') throw new Error('vary');
        const body = await response.text();
        if (!body.includes('<html lang="fr">') || !body.includes('/a.fr.js')) throw new Error(body);
      `
    );
  });

  it('reuses the regular entry point instead of bundling a copy', () => {
    for (const [file, specifier] of [
      ['dist/experimental/index.client.mjs', '../index.client.mjs'],
      ['dist/experimental/index.server.mjs', '../index.server.mjs'],
      ['dist/experimental/index.client.cjs', '../index.client.cjs'],
      ['dist/experimental/index.server.cjs', '../index.server.cjs'],
    ]) {
      expect(readFileSync(join(packageRoot, file), 'utf8'), file).toContain(
        specifier
      );
    }
  });

  it('publishes declarations for both module formats', () => {
    for (const file of [
      'dist/experimental/index.types.d.cts',
      'dist/experimental/index.types.d.mts',
    ]) {
      expect(existsSync(join(packageRoot, file)), file).toBe(true);
    }
  });

  it('no longer publishes gt-react/locale-twins', () => {
    expect(() =>
      execFileSync(
        process.execPath,
        ['--eval', `require('gt-react/locale-twins')`],
        { cwd: packageRoot, stdio: 'pipe' }
      )
    ).toThrow();
  });
});
