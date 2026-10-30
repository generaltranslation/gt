/**
 * Locale twins are reachable only from `@generaltranslation/compiler/experimental`;
 * the regular entry point loads no locale twin code.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageRoot = fileURLToPath(new URL('../../..', import.meta.url));

function node(script: string, args: string[] = []): void {
  execFileSync(process.execPath, [...args, '--eval', script], {
    cwd: packageRoot,
    stdio: 'pipe',
  });
}

/** Every dist module the CommonJS entry reaches through relative requires. */
function reachableModules(entry: string): string[] {
  const seen = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    const code = readFileSync(file, 'utf8');
    for (const [, specifier] of code.matchAll(/require\("(\.[^"]+)"\)/g)) {
      const target = resolve(dirname(file), specifier);
      visit(target.endsWith('.js') ? target : `${target}.js`);
    }
  };
  visit(join(packageRoot, entry));
  return [...seen].map((file) => file.slice(packageRoot.length));
}

describe('@generaltranslation/compiler/experimental', () => {
  it('exports the experimental Vite plugin (CJS)', () => {
    node(`
      const experimental = require('@generaltranslation/compiler/experimental');
      if (typeof experimental.vite !== 'function') throw new Error('vite');
      if (typeof experimental.unplugin.raw !== 'function') throw new Error('unplugin');
      const plugin = experimental.vite({ logLevel: 'silent', gtConfig: { experimental: { splitting: 'locale-twins' } } });
      if (typeof plugin.resolveId !== 'function') throw new Error('no locale twin Vite hooks');
    `);
  });

  it('exports the experimental Vite plugin (ESM)', () => {
    node(
      `
        const experimental = await import('@generaltranslation/compiler/experimental');
        if (typeof experimental.vite !== 'function') throw new Error('vite');
      `,
      ['--input-type=module']
    );
  });

  it('keeps the regular entry point free of locale twin code', () => {
    const modules = reachableModules('dist/index.js');
    expect(modules.filter((file) => file.includes('experimental'))).toEqual([]);
    for (const file of modules) {
      expect(readFileSync(join(packageRoot, file), 'utf8'), file).not.toMatch(
        /GtInternalRegisterLocaleTwin|__GT_LOCALE_TWIN__/
      );
    }
    node(`
      const regular = require('@generaltranslation/compiler');
      const plugin = regular.vite({ logLevel: 'silent' });
      if ('resolveId' in plugin) throw new Error('locale twin Vite hooks in the regular plugin');
    `);
  });

  it('publishes the virtual manifest module declaration', () => {
    const file = join(
      packageRoot,
      'dist/experimental/locale-twins-manifest.d.ts'
    );
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, 'utf8')).toContain(
      "declare module 'virtual:gt-locale-twins-manifest'"
    );
  });
});
