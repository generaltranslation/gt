/**
 * With locale twins, only the server loads whole locales: the generated
 * config module's loader returns nothing in the production client build, so
 * the client build drops every locale file. Without twins (another strategy,
 * or no compiler) the browser keeps loading them. Dictionary entries are never
 * twinned, so an app with a dictionary keeps loading them.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { Plugin, ResolvedConfig } from 'vite';
import {
  createConfigModule,
  RESOLVED_CONFIG_MODULE_ID,
} from '../../plugin/configModule';
import { gtTanstackStart, loadTranslationsOnlyOnServer } from '../plugin/vite';

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

/** The config module the experimental plugin serves for a production build. */
function loadConfigModule(
  splitting: string | undefined,
  compiler: 'babel' | 'none'
): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-tss-twins-'));
  roots.push(root);
  const configFile = path.join(root, 'gt.config.json');
  fs.writeFileSync(
    configFile,
    JSON.stringify({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      files: { gt: { output: 'src/_gt/[locale].json' } },
      ...(splitting && { experimental: { splitting } }),
    })
  );
  const [configPlugin] = gtTanstackStart({
    config: configFile,
    experimentalCompilerOptions: { type: compiler },
  });
  (configPlugin.configResolved as (config: ResolvedConfig) => void)({
    root,
    command: 'build',
    plugins: [] as Plugin[],
    logger: { warnOnce() {} },
  } as unknown as ResolvedConfig);
  return (configPlugin.load as (id: string) => string)(
    RESOLVED_CONFIG_MODULE_ID
  );
}

describe('the experimental gtTanstackStart() config module', () => {
  afterEach(() => {
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('loads locale files only on the server with locale twins', () => {
    expect(loadConfigModule('locale-twins', 'babel')).toContain(GUARD);
  });

  // Without twins, the browser has only the whole-locale loader
  it.each([
    ['experimental.splitting is "locale"', 'locale', 'babel'],
    ['experimental.splitting is unset', undefined, 'babel'],
    ['the compiler is off (no twins are built)', 'locale-twins', 'none'],
  ] as const)(
    'keeps loading locale files in the browser when %s',
    (_name, splitting, compiler) => {
      const code = loadConfigModule(splitting, compiler);

      expect(code).toContain('import.meta.glob');
      expect(code).not.toContain(GUARD);
    }
  );

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
