/**
 * With locale twins, only the server loads whole locales: the generated
 * config module's loader returns nothing in the production client build, so
 * the client build drops every locale file. Dictionary entries are never
 * twinned, so an app with a dictionary keeps loading them.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createConfigModule } from '../../plugin/configModule';
import { loadTranslationsOnlyOnServer } from '../plugin/vite';

const GUARD = 'if (import.meta.env.PROD && !import.meta.env.SSR) return {};';
const roots: string[] = [];

function generate(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-tss-twins-'));
  roots.push(root);
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  }
  return createConfigModule(root, root, path.join(root, 'gt.config.json'), {})
    .code;
}

const GT_CONFIG = JSON.stringify({
  defaultLocale: 'en',
  locales: ['en', 'fr'],
  files: { gt: { output: 'src/_gt/[locale].json' } },
  experimental: { splitting: 'locale-twins' },
});

describe('the experimental gtTanstackStart() config module', () => {
  afterEach(() => {
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('loads locale files only on the server and in dev', () => {
    const regular = generate({ 'gt.config.json': GT_CONFIG });
    const code = loadTranslationsOnlyOnServer(regular);

    expect(regular).not.toContain(GUARD);
    expect(code).toContain('import.meta.glob');
    expect(code).toMatch(
      /export async function loadTranslations\(locale\) \{\n {2}if \(import\.meta\.env\.PROD && !import\.meta\.env\.SSR\) return \{\};\n/
    );
  });

  it('keeps loading locale files in the browser for a dictionary', () => {
    const code = loadTranslationsOnlyOnServer(
      generate({
        'gt.config.json': GT_CONFIG,
        'src/dictionary.ts': 'export const dictionary = { greeting: "Hello" };',
      })
    );

    expect(code).toContain('import.meta.glob');
    expect(code).not.toContain(GUARD);
  });

  it('exposes experimental.splitting to the runtime', () => {
    expect(generate({ 'gt.config.json': GT_CONFIG })).toContain(
      '"experimental":{"splitting":"locale-twins"}'
    );
  });
});
