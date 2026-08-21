import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  resolveVueProjectAliasConfiguration,
  resolveVueProjectAliases,
} from '../project/viteAliases.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

describe('resolveVueProjectAliases', () => {
  it('distinguishes definitely absent aliases from incomplete analysis', () => {
    const withoutConfig = createProject({});
    const withoutAliases = createProject({
      'vite.config.ts': `export default defineConfig({ server: { port: 3000 } });`,
    });
    const explicitlyAbsent = createProject({
      'vite.config.ts': `export default defineConfig({ resolve: { alias: undefined } });`,
    });
    const absentResolve = createProject({
      'vite.config.ts': `export default defineConfig({ resolve: null });`,
    });
    const malformed = createProject({
      'vite.config.ts': `export default defineConfig({ resolve: { alias:`,
    });
    const dynamicRoot = createProject({
      'vite.config.ts': `export default defineConfig(getConfig());`,
    });
    const knownAliases = createProject({
      'vite.config.ts': `export default { resolve: { alias: { '@': './src' } } };`,
    });

    expect(resolveVueProjectAliasConfiguration(withoutConfig)).toEqual({
      aliases: new Map(),
      complete: true,
    });
    expect(resolveVueProjectAliasConfiguration(withoutAliases)).toEqual({
      aliases: new Map(),
      complete: true,
    });
    expect(resolveVueProjectAliasConfiguration(explicitlyAbsent)).toEqual({
      aliases: new Map(),
      complete: true,
    });
    expect(resolveVueProjectAliasConfiguration(absentResolve)).toEqual({
      aliases: new Map(),
      complete: true,
    });
    expect(resolveVueProjectAliasConfiguration(malformed)).toEqual({
      aliases: new Map(),
      complete: false,
    });
    expect(resolveVueProjectAliasConfiguration(dynamicRoot)).toEqual({
      aliases: new Map(),
      complete: false,
    });
    expect(resolveVueProjectAliasConfiguration(knownAliases)).toEqual({
      aliases: new Map([['@', './src']]),
      complete: true,
    });
  });

  it('marks unreadable-shaped and escaping active config incomplete', () => {
    const directoryConfig = createProject({});
    fs.mkdirSync(path.join(directoryConfig, 'vite.config.js'));
    const dynamicSpread = createProject({
      'vite.config.ts': `
        const shared = getConfig();
        export default { ...shared, resolve: { alias: { '@': './src' } } };
      `,
    });
    const escapedRoot = createProject({
      'vite.config.ts': `
        const config = { resolve: { alias: { '@': './src' } } };
        consume(config);
        export default config;
      `,
    });

    for (const root of [directoryConfig, dynamicSpread, escapedRoot]) {
      expect(resolveVueProjectAliasConfiguration(root)).toEqual({
        aliases: new Map(),
        complete: false,
      });
    }
  });

  it('preserves relative replacements while evaluating explicit path expressions', () => {
    const root = createProject({
      'vite.config.ts': `
        import path from 'node:path';
        import { defineConfig } from 'vite';
        const source = path.resolve(__dirname, 'src');
        const shared = {
          '@': source,
          '#literal': './literal',
        } as const;
        const aliases = {
          ...shared,
          '@feature': path.resolve(__dirname, 'features'),
        } satisfies Record<string, string>;
        const resolve = { alias: aliases };
        const config = { resolve };
        export default defineConfig(config);
      `,
    });

    expect(Object.fromEntries(resolveVueProjectAliases(root))).toEqual({
      '#literal': './literal',
      '@': path.join(root, 'src'),
      '@feature': path.join(root, 'features'),
    });
  });

  it('retains callback-local scope for aliases and URL expressions', () => {
    const root = createProject({
      'vite.config.mts': `
        import { defineConfig } from 'vite';
        import { fileURLToPath as toPath } from 'node:url';
        export default defineConfig(() => {
          const source = toPath(new URL('./src', import.meta.url));
          const shared = [{ find: '@first', replacement: './first' }] as const;
          const aliases = [
            ...shared,
            { find: '@', replacement: source },
          ];
          return { resolve: { alias: aliases } };
        });
      `,
    });

    expect([...resolveVueProjectAliases(root)]).toEqual([
      ['@first', './first'],
      ['@', path.join(root, 'src')],
    ]);
  });

  it('resolves the URL constructor imported by the standard Vite scaffold', () => {
    const root = createProject({
      'vite.config.ts': `
        import { fileURLToPath, URL } from 'node:url';
        import { defineConfig } from 'vite';
        export default defineConfig({
          resolve: {
            alias: {
              '@': fileURLToPath(new URL('./src', import.meta.url)),
            },
          },
        });
      `,
    });

    expect([...resolveVueProjectAliases(root)]).toEqual([
      ['@', path.join(root, 'src')],
    ]);
  });

  it('does not resolve a helper shadowed by a callback parameter', () => {
    const root = createProject({
      'vite.config.ts': `
        import path from 'node:path';
        import { defineConfig } from 'vite';
        export default defineConfig((path) => ({
          resolve: { alias: { '@': path.resolve(__dirname, 'wrong') } },
        }));
      `,
    });

    expect(resolveVueProjectAliasConfiguration(root)).toEqual({
      aliases: new Map(),
      complete: false,
      potentialAliasKeys: new Set(['@']),
    });
  });

  it('does not trust a mutated path helper', () => {
    const root = createProject({
      'vite.config.cjs': `
        const nodePath = require('node:path');
        nodePath.resolve = () => '/wrong';
        module.exports = {
          resolve: { alias: { '@': nodePath.resolve(__dirname, 'src') } },
        };
      `,
    });

    expect(resolveVueProjectAliasConfiguration(root)).toEqual({
      aliases: new Map(),
      complete: false,
      potentialAliasKeys: new Set(['@']),
    });
  });

  it('reads only resolve.alias from a Vite config', () => {
    const root = createProject({
      'vite.config.ts': `
        export default defineConfig({
          alias: { '@top-level': './ignored-top-level' },
          resolve: { alias: { '@vite': './vite' } },
          vite: { resolve: { alias: { '@nested': './ignored-nested' } } },
        });
      `,
    });

    expect([...resolveVueProjectAliases(root)]).toEqual([['@vite', './vite']]);
  });

  it('preserves configured array order and the first duplicate', () => {
    const root = createProject({
      'vite.config.ts': `
        export default {
          resolve: {
            alias: [
              { find: '@wide/specific', replacement: './specific' },
              { find: '@wide', replacement: './wide-first' },
              { find: '@wide', replacement: './wide-second' },
            ],
          },
        };
      `,
    });

    expect([...resolveVueProjectAliases(root)]).toEqual([
      ['@wide/specific', './specific'],
      ['@wide', './wide-first'],
    ]);
  });

  it('synthesizes Nuxt aliases and applies object-form override precedence', () => {
    const root = createProject({
      'nuxt.config.ts': `
        import { fileURLToPath } from 'node:url';
        import { defineNuxtConfig as define } from 'nuxt';
        const src = fileURLToPath(new URL('./src', import.meta.url));
        export default define({
          alias: {
            '#shared': './shared',
            '@': './nuxt-source',
          },
          vite: {
            resolve: {
              alias: {
                '@': src,
                '@client': './client',
              },
            },
          },
        });
      `,
    });

    expect([
      ...resolveVueProjectAliases(root, { nuxtMajorVersion: 3 }),
    ]).toEqual([
      ['~', trailingSlash(root)],
      ['@', path.join(root, 'src')],
      ['~~', trailingSlash(root)],
      ['@@', trailingSlash(root)],
      ['#shared', './shared'],
      ['@client', './client'],
    ]);
  });

  it('prepends nested Vite arrays when Nuxt merges unlike alias forms', () => {
    const root = createProject({
      'nuxt.config.ts': `
        export default defineNuxtConfig({
          alias: {
            '@wide': './nuxt-wide',
            '#shared': './shared',
          },
          vite: {
            resolve: {
              alias: [
                { find: '@wide/specific', replacement: './specific' },
                { find: '@wide', replacement: './vite-wide' },
              ],
            },
          },
        });
      `,
    });

    expect([
      ...resolveVueProjectAliases(root, { nuxtMajorVersion: 3 }),
    ]).toEqual([
      ['@wide/specific', './specific'],
      ['@wide', './vite-wide'],
      ['~', trailingSlash(root)],
      ['@', trailingSlash(root)],
      ['~~', trailingSlash(root)],
      ['@@', trailingSlash(root)],
      ['#shared', './shared'],
    ]);
  });

  it('uses Nuxt 3, Nuxt 4, compatibility, and explicit srcDir semantics', () => {
    const nuxt3 = createProject({
      'app/App.vue': '<template />',
      'nuxt.config.ts': 'export default defineNuxtConfig({});',
    });
    const nuxt4 = createProject({
      'app/App.vue': '<template />',
      'nuxt.config.ts': 'export default defineNuxtConfig({});',
    });
    const compatibility = createProject({
      'app/App.vue': '<template />',
      'nuxt.config.ts': `export default defineNuxtConfig({ future: { compatibilityVersion: 4 } });`,
    });
    const explicit = createProject({
      'nuxt.config.ts': `export default defineNuxtConfig({ srcDir: 'src' });`,
    });
    const emptySource = createProject({
      'app/App.vue': '<template />',
      'nuxt.config.ts': `export default defineNuxtConfig({ srcDir: '' });`,
    });

    expect(
      resolveVueProjectAliases(nuxt3, { nuxtMajorVersion: 3 }).get('@')
    ).toBe(trailingSlash(nuxt3));
    expect(
      resolveVueProjectAliases(nuxt4, { nuxtMajorVersion: 4 }).get('@')
    ).toBe(trailingSlash(path.join(nuxt4, 'app')));
    expect(
      resolveVueProjectAliases(compatibility, { nuxtMajorVersion: 3 }).get('@')
    ).toBe(trailingSlash(path.join(compatibility, 'app')));
    expect(
      resolveVueProjectAliases(explicit, { nuxtMajorVersion: 3 }).get('@')
    ).toBe(trailingSlash(path.join(explicit, 'src')));
    expect(
      resolveVueProjectAliases(emptySource, { nuxtMajorVersion: 4 }).get('@')
    ).toBe(trailingSlash(path.join(emptySource, 'app')));
  });

  it('requires a known Nuxt generation when srcDir uses versioned defaults', () => {
    const unknownDefault = createProject({
      'nuxt.config.ts': `export default defineNuxtConfig({});`,
    });
    const explicitSource = createProject({
      'nuxt.config.ts': `export default defineNuxtConfig({ srcDir: 'src' });`,
    });

    expect(resolveVueProjectAliasConfiguration(unknownDefault)).toEqual({
      aliases: new Map(),
      complete: false,
    });
    expect(resolveVueProjectAliasConfiguration(explicitSource).complete).toBe(
      true
    );
  });

  it('uses the Nuxt 4 legacy-layout fallback when app is effectively empty', () => {
    const root = createProject({
      'app/router.options.ts': 'export default {}',
      'nuxt.config.ts': 'export default defineNuxtConfig({});',
      'pages/index.vue': '<template />',
    });

    expect(
      resolveVueProjectAliases(root, { nuxtMajorVersion: 4 }).get('@')
    ).toBe(trailingSlash(root));
  });

  it.each([
    `srcDir: '../outside'`,
    `rootDir: '../outside'`,
    `srcDir: getSourceDirectory()`,
    `future: getFutureOptions()`,
  ])('fails closed for an unsafe Nuxt directory configuration: %s', (entry) => {
    const root = createProject({
      'nuxt.config.ts': `export default defineNuxtConfig({ ${entry}, alias: { '@safe': './safe' } });`,
    });

    expect(resolveVueProjectAliases(root, { nuxtMajorVersion: 4 })).toEqual(
      new Map()
    );
  });

  it('rejects a Nuxt srcDir beneath a symlink that escapes the package', () => {
    const outside = createProject({});
    const root = createProject({
      'nuxt.config.ts': `export default defineNuxtConfig({ srcDir: 'linked/src' });`,
    });
    fs.symlinkSync(outside, path.join(root, 'linked'), 'dir');

    expect(resolveVueProjectAliases(root, { nuxtMajorVersion: 4 })).toEqual(
      new Map()
    );
  });

  it('uses the same filename precedence and ambiguity policy as compiler config', () => {
    const vite = createProject({
      'vite.config.js': `export default { resolve: { alias: { '@': './js' } } };`,
      'vite.config.mjs': `export default { resolve: { alias: { '@': './mjs' } } };`,
      'vite.config.ts': `export default { resolve: { alias: { '@': './ts' } } };`,
    });
    const nuxt = createProject({
      'nuxt.config.mjs': `export default defineNuxtConfig({ alias: { '#which': './mjs' } });`,
      'nuxt.config.ts': `export default defineNuxtConfig({ alias: { '#which': './ts' } });`,
    });
    const ambiguous = createProject({
      'nuxt.config.ts': `export default defineNuxtConfig({ alias: { '@': './nuxt' } });`,
      'vite.config.ts': `export default { resolve: { alias: { '@': './vite' } } };`,
    });

    expect(resolveVueProjectAliases(vite).get('@')).toBe('./js');
    expect(
      resolveVueProjectAliases(nuxt, { nuxtMajorVersion: 3 }).get('#which')
    ).toBe('./ts');
    expect(resolveVueProjectAliasConfiguration(ambiguous)).toEqual({
      aliases: new Map(),
      complete: false,
    });
  });

  it('supports CommonJS helper aliases and config exports', () => {
    const root = createProject({
      'vite.config.cjs': `
        const vite = require('vite');
        const nodePath = require('node:path');
        const { resolve: resolvePath } = require('path');
        const aliases = {
          '@': nodePath.resolve(__dirname, 'src'),
          '@server': resolvePath(__dirname, 'server'),
        };
        module.exports = vite.defineConfig({ resolve: { alias: aliases } });
      `,
    });

    expect(Object.fromEntries(resolveVueProjectAliases(root))).toEqual({
      '@': path.join(root, 'src'),
      '@server': path.join(root, 'server'),
    });
  });

  it('never executes config code', () => {
    const root = createProject({});
    const marker = path.join(root, 'executed.txt');
    writeFiles(root, {
      'vite.config.js': `
        import fs from 'node:fs';
        fs.writeFileSync(${JSON.stringify(marker)}, 'executed');
        throw new Error('config execution is forbidden');
        export default defineConfig({
          resolve: { alias: { '@': './src' } },
        });
      `,
    });

    expect(resolveVueProjectAliases(root).get('@')).toBe('./src');
    expect(fs.existsSync(marker)).toBe(false);
  });

  it('marks a dynamic replacement incomplete without returning partial aliases', () => {
    const root = createProject({
      'vite.config.ts': `
        export default {
          resolve: {
            alias: {
              '@static': './static',
              '@dynamic': getReplacement(),
            },
          },
        };
      `,
    });

    expect(resolveVueProjectAliasConfiguration(root)).toEqual({
      aliases: new Map(),
      complete: false,
      potentialAliasKeys: new Set(['@static', '@dynamic']),
      potentialAliases: new Map([['@static', new Set(['./static'])]]),
    });
    expect(resolveVueProjectAliases(root)).toEqual(new Map());
  });

  it.each([
    [`aliases['@'] = './after';`, false],
    [`aliases.extra = './extra';`, false],
    [`delete aliases['@'];`, false],
    [`Object.assign(aliases, { '@': './after' });`, true],
    [`consume(aliases);`, true],
    [`const escaped = aliases; consume(escaped);`, true],
    [`consume({ alias: aliases });`, true],
    [`const holder = { alias: aliases }; consume(holder);`, true],
    [`const registry = [aliases]; consume(registry);`, true],
  ])(
    'fails closed when an alias binding mutates or escapes: %s',
    (escape, hasKey) => {
      const root = createProject({
        'vite.config.ts': `
        const aliases = { '@': './before' };
        ${escape}
        export default { resolve: { alias: aliases } };
      `,
      });

      expect(resolveVueProjectAliasConfiguration(root)).toEqual({
        aliases: new Map(),
        complete: false,
        ...(hasKey && {
          potentialAliases: new Map([['@', new Set(['./before'])]]),
        }),
        ...(hasKey && { potentialAliasKeys: new Set(['@']) }),
      });
    }
  );

  it.each([
    [
      'before a dynamic override',
      `{ '@i18n': './base', ...getAliases() }`,
      './base',
    ],
    [
      'after a dynamic spread',
      `{ ...getAliases(), '@i18n': './fixed' }`,
      './fixed',
    ],
    [
      'beside a dynamic array spread',
      `[{ find: '@i18n', replacement: './fixed' }, ...getAliases()]`,
      './fixed',
    ],
  ])('retains a static alias key %s', (_label, aliases, replacement) => {
    const root = createProject({
      'vite.config.ts': `
        export default { resolve: { alias: ${aliases} } };
      `,
    });

    expect(resolveVueProjectAliasConfiguration(root)).toEqual({
      aliases: new Map(),
      complete: false,
      potentialAliasKeys: new Set(['@i18n']),
      potentialAliases: new Map([['@i18n', new Set([replacement])]]),
    });
    expect(resolveVueProjectAliases(root)).toEqual(new Map());
  });

  it('fails closed when a dynamic spread can change alias precedence', () => {
    const root = createProject({
      'vite.config.ts': `
        const dynamic = getAliases();
        const aliases = { '@static': './static', ...dynamic };
        export default { resolve: { alias: aliases } };
      `,
    });

    expect(resolveVueProjectAliasConfiguration(root)).toEqual({
      aliases: new Map(),
      complete: false,
      potentialAliasKeys: new Set(['@static']),
      potentialAliases: new Map([['@static', new Set(['./static'])]]),
    });
  });

  it('preserves every static candidate for a duplicated incomplete alias', () => {
    const root = createProject({
      'vite.config.ts': `
        export default {
          resolve: {
            alias: [
              { find: '@i18n', replacement: './first' },
              ...getAliases(),
              { find: '@i18n', replacement: './second' },
            ],
          },
        };
      `,
    });

    expect(resolveVueProjectAliasConfiguration(root)).toEqual({
      aliases: new Map(),
      complete: false,
      potentialAliasKeys: new Set(['@i18n']),
      potentialAliases: new Map([['@i18n', new Set(['./first', './second'])]]),
    });
    expect(resolveVueProjectAliases(root)).toEqual(new Map());
  });

  it.each([
    [`{ find: '@', replacement: './src', customResolver() {} }`, true],
    [`{ find: '@', replacement: './src', customResolver: undefined }`, true],
    [`{ find: /^@/, replacement: './src' }`, false],
  ])(
    'fails closed for alias behavior that string mappings cannot model: %s',
    (alias, hasKey) => {
      const root = createProject({
        'vite.config.ts': `export default { resolve: { alias: [${alias}] } };`,
      });

      expect(resolveVueProjectAliasConfiguration(root)).toEqual({
        aliases: new Map(),
        complete: false,
        ...(hasKey && {
          potentialAliases: new Map([['@', new Set(['./src'])]]),
        }),
        ...(hasKey && { potentialAliasKeys: new Set(['@']) }),
      });
    }
  );

  it('uses only an explicit in-package Vite config when supplied', () => {
    const root = createProject({
      'vite.config.ts': `export default { resolve: { alias: { '@': './default' } } };`,
      'config/preview.config.ts': `export default { resolve: { alias: { '@': '../preview' } } };`,
    });
    const outside = createProject({
      'vite.config.ts': `export default { resolve: { alias: { '@': './outside' } } };`,
    });

    expect(
      resolveVueProjectAliases(root, {
        viteConfigPath: 'config/preview.config.ts',
      }).get('@')
    ).toBe('../preview');
    expect(
      resolveVueProjectAliasConfiguration(root, {
        viteConfigPath: path.join(outside, 'vite.config.ts'),
      })
    ).toEqual({ aliases: new Map(), complete: false });
    expect(
      resolveVueProjectAliasConfiguration(root, { viteConfigPath: '' })
    ).toEqual({ aliases: new Map(), complete: false });
  });
});

function createProject(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-vue-aliases-'));
  temporaryDirectories.push(root);
  writeFiles(root, files);
  return root;
}

function writeFiles(root: string, files: Record<string, string>): void {
  for (const [relativePath, contents] of Object.entries(files)) {
    const file = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents);
  }
}

function trailingSlash(directory: string): string {
  return `${directory.replaceAll(path.sep, '/')}/`;
}
