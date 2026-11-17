import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from 'vitest';
import * as t from '@babel/types';
import type { UnpluginBuildContext, UnpluginContext } from 'unplugin';
import { defaultInlineTranslationsModulesDir } from 'generaltranslation/internal';
import gtUnplugin, { type GTUnpluginOptions } from '../index';
import { clearInlineTranslationsCache } from '../transform/injection/inline-translations/loadInlineTranslations';
import {
  INLINE_TRANSLATIONS_MODULE_HEADER,
  isInlineTranslationsModuleHash,
  renderInlineTranslationsModule,
  renderInlineTranslationsModules,
  resolveInlineTranslationsModulesDir,
  writeInlineTranslationsModules,
} from '../transform/injection/inline-translations/inlineTranslationsModules';

function createDir(): string {
  const root = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'gt-modules-'))
  );
  onTestFinished(() => fs.rmSync(root, { recursive: true, force: true }));
  return path.join(root, 'messages');
}

async function importModule(source: string) {
  const url = `data:text/javascript,${encodeURIComponent(source)}`;
  return ((await import(url)) as { default: (locale: string) => unknown })
    .default;
}

describe('isInlineTranslationsModuleHash', () => {
  it('accepts computed hashes', () => {
    expect(isInlineTranslationsModuleHash('05a87bce151d258b')).toBe(true);
    expect(isInlineTranslationsModuleHash('my_hash_2')).toBe(true);
  });

  it('rejects hashes that are unsafe as file names or identifiers', () => {
    for (const hash of ['', '../x', 'a.b', 'a/b', 'é', 'my-hash', 'AB12']) {
      expect(isInlineTranslationsModuleHash(hash)).toBe(false);
    }
  });
});

describe('renderInlineTranslationsModule', () => {
  it('renders the inline callback as the default export', () => {
    expect(
      renderInlineTranslationsModule(
        { fr: { abc: 'Bonjour' }, es: { abc: 'Hola' } },
        'abc'
      )
    ).toBe(
      `${INLINE_TRANSLATIONS_MODULE_HEADER}\n` +
        'export default (locale) => locale === "fr" ? "Bonjour" : locale === "es" ? "Hola" : undefined;\n'
    );
  });

  it('round-trips JSX children data and escapes strings', async () => {
    const children = [{ t: 'b', c: 'Gras' }, ' "et" </script> Chaîne '];
    const callback = await importModule(
      renderInlineTranslationsModule({ fr: { abc: children } }, 'abc')!
    );
    expect(callback('fr')).toEqual(children);
    expect(callback('de')).toBeUndefined();
  });

  it('keeps __proto__ keys as own properties', async () => {
    const tree = JSON.parse(
      '{"b":{"__proto__":"proto","other":"autre"},"t":"x \\",\\"__proto__\\":"}'
    );
    const callback = await importModule(
      renderInlineTranslationsModule({ fr: { abc: tree } }, 'abc')!
    );
    expect(callback('fr')).toEqual(tree);
    expect(Object.hasOwn(callback('fr').b, '__proto__')).toBe(true);
  });

  it('returns undefined when no locale translates the hash', () => {
    expect(
      renderInlineTranslationsModule({ fr: { other: 'x', abc: null } }, 'abc')
    ).toBeUndefined();
  });
});

describe('renderInlineTranslationsModules', () => {
  it('renders one module per module hash across locales', () => {
    const modules = renderInlineTranslationsModules({
      fr: { aaa: 'A', 'my-hash': 'X' },
      es: { aaa: 'A2', bbb: 'B' },
    });
    expect(Array.from(modules.keys())).toEqual(['aaa', 'bbb']);
    expect(modules.get('aaa')).toContain(
      'locale === "fr" ? "A" : locale === "es" ? "A2"'
    );
  });

  it('renders nothing without a table', () => {
    expect(renderInlineTranslationsModules(undefined).size).toBe(0);
  });
});

describe('resolveInlineTranslationsModulesDir', () => {
  it('defaults to the canonical directory under the root', () => {
    expect(resolveInlineTranslationsModulesDir(undefined, '/app')).toBe(
      path.resolve('/app', defaultInlineTranslationsModulesDir)
    );
  });

  it('resolves a configured directory from the root', () => {
    expect(
      resolveInlineTranslationsModulesDir(
        { inlineTranslations: { locales: [], modulesDir: 'src/messages' } },
        '/app'
      )
    ).toBe(path.resolve('/app', 'src/messages'));
  });
});

describe('writeInlineTranslationsModules', () => {
  it('rewrites only changed modules and removes stale generated ones', () => {
    const dir = createDir();
    writeInlineTranslationsModules(
      dir,
      renderInlineTranslationsModules({ fr: { aaa: 'A', bbb: 'B', ccc: 'C' } })
    );
    const past = new Date(Date.now() - 60_000);
    for (const file of fs.readdirSync(dir)) {
      fs.utimesSync(path.join(dir, file), past, past);
    }
    fs.writeFileSync(path.join(dir, 'index.mjs'), 'export {};\n');

    expect(
      writeInlineTranslationsModules(
        dir,
        renderInlineTranslationsModules({ fr: { aaa: 'A', bbb: 'B2' } })
      )
    ).toEqual({ written: 1, removed: 1 });
    expect(fs.readdirSync(dir).sort()).toEqual([
      'aaa.mjs',
      'bbb.mjs',
      'index.mjs',
    ]);
    expect(
      Math.round(fs.statSync(path.join(dir, 'aaa.mjs')).mtimeMs / 1000)
    ).toBe(Math.round(past.getTime() / 1000));
    expect(fs.readFileSync(path.join(dir, 'bbb.mjs'), 'utf8')).toContain(
      '"B2"'
    );
  });

  it('refuses to overwrite a file it did not generate', () => {
    const dir = createDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.mjs'), 'export {};\n');
    expect(() =>
      writeInlineTranslationsModules(
        dir,
        renderInlineTranslationsModules({ fr: { index: 'Accueil' } })
      )
    ).toThrow('Did not overwrite');
    expect(fs.readFileSync(path.join(dir, 'index.mjs'), 'utf8')).toBe(
      'export {};\n'
    );
  });

  it('refuses to overwrite a file it cannot read', () => {
    const dir = createDir();
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'index.mjs');
    fs.writeFileSync(file, 'export {};\n');
    fs.chmodSync(file, 0o000);
    try {
      expect(() =>
        writeInlineTranslationsModules(
          dir,
          renderInlineTranslationsModules({ fr: { index: 'Accueil' } })
        )
      ).toThrow('EACCES');
    } finally {
      fs.chmodSync(file, 0o644);
    }
    expect(fs.readFileSync(file, 'utf8')).toBe('export {};\n');
  });

  it('removes every generated module once nothing is embedded', () => {
    const dir = createDir();
    writeInlineTranslationsModules(
      dir,
      renderInlineTranslationsModules({ fr: { aaa: 'A' } })
    );
    expect(writeInlineTranslationsModules(dir, new Map())).toEqual({
      written: 0,
      removed: 1,
    });
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it('removes temp files a dead writer left behind', () => {
    const dir = createDir();
    fs.mkdirSync(dir, { recursive: true });
    const fresh = path.join(dir, 'aaa.mjs.tmp-1-x');
    const stale = path.join(dir, 'bbb.mjs.tmp-2-y');
    fs.writeFileSync(fresh, INLINE_TRANSLATIONS_MODULE_HEADER);
    fs.writeFileSync(stale, INLINE_TRANSLATIONS_MODULE_HEADER);
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
    fs.utimesSync(stale, old, old);

    writeInlineTranslationsModules(dir, new Map());

    expect(fs.existsSync(fresh)).toBe(true);
    expect(fs.existsSync(stale)).toBe(false);
  });

  it('keeps old files that only look like its temp files', () => {
    const dir = createDir();
    fs.mkdirSync(dir, { recursive: true });
    const backup = path.join(dir, 'index.mjs.tmp-backup');
    const userFile = path.join(dir, 'index.mjs.tmp-1-x');
    fs.writeFileSync(backup, INLINE_TRANSLATIONS_MODULE_HEADER);
    fs.writeFileSync(userFile, 'export {};\n');
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
    fs.utimesSync(backup, old, old);
    fs.utimesSync(userFile, old, old);

    writeInlineTranslationsModules(dir, new Map());

    expect(fs.readdirSync(dir).sort()).toEqual([
      'index.mjs.tmp-1-x',
      'index.mjs.tmp-backup',
    ]);
  });
});
// Same hashes as inlineTranslations.test.ts
const HELLO_WORLD = '8ffa9649730810de';
const JSX_HELLO_WORLD = 'ebc5c5a5022c5050';
const OTHER_HASH = 'a0469ebdf8a22a0c';

const USEGT_CODE = `
  import { useGT } from 'gt-react/unstable';
  const gt = useGT();
  gt\`Hello world\`;
`;

const T_COMPONENT_CODE = `
  import { jsx } from 'react/jsx-runtime';
  import { T } from 'gt-react';
  export const el = jsx(T, { children: "Hello world" });
`;

type Plugin = ReturnType<typeof gtUnplugin.raw> & {
  buildStart(this: unknown): void;
  resolveId(this: unknown, id: string): string | null;
  loadInclude(id: string): boolean;
  load(
    this: unknown,
    id: string
  ): { code: string; moduleSideEffects: boolean } | null;
  transform(this: unknown, code: string, id: string): unknown;
  transformInclude(id: string): boolean;
};

function createContext(watched: string[] = []) {
  return {
    addWatchFile: (file: string) => watched.push(file),
    emitFile() {},
    getWatchFiles: () => [],
    parse() {
      throw new Error('not implemented');
    },
    warn() {},
    error(message: unknown) {
      throw new Error(String(message));
    },
  } as unknown as UnpluginBuildContext & UnpluginContext;
}

function createProject(
  translations: Record<string, Record<string, unknown>>
): string {
  const root = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'gt-modules-'))
  );
  onTestFinished(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'translations'));
  for (const [locale, entries] of Object.entries(translations)) {
    fs.writeFileSync(
      path.join(root, 'translations', `${locale}.json`),
      JSON.stringify(entries)
    );
  }
  return root;
}

function moduleOptions(
  root: string,
  locales: string[],
  inline: { modules?: 'physical' | 'virtual'; modulesDir?: string }
): GTUnpluginOptions {
  return {
    gtConfig: {
      files: {
        gt: {
          output: path.join(root, 'translations', '[locale].json'),
          inlineTranslations: { locales, ...inline },
        },
      },
    },
  };
}

function createPlugin(
  root: string,
  options: GTUnpluginOptions,
  framework: 'vite' | 'webpack' = 'vite'
): Plugin {
  vi.spyOn(process, 'cwd').mockReturnValue(root);
  return gtUnplugin.raw(options, { framework } as never) as Plugin;
}

async function transform(
  plugin: Plugin,
  root: string,
  code: string,
  file = 'src/App.tsx'
): Promise<string> {
  const result = (await plugin.transform.call(
    createContext(),
    code,
    path.join(root, file)
  )) as { code: string } | string | null;
  if (!result) return '';
  return typeof result === 'string' ? result : result.code;
}

describe('inlineTranslations.modules', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    clearInlineTranslationsCache();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('call sites', () => {
    it('imports the physical module for unstable gt templates', async () => {
      const root = createProject({ fr: { [HELLO_WORLD]: 'Bonjour' } });
      const plugin = createPlugin(
        root,
        moduleOptions(root, ['fr'], { modules: 'physical' })
      );
      const output = await transform(plugin, root, USEGT_CODE);
      expect(output).toContain(
        `import __gt_inline_${HELLO_WORLD} from "../.gt/messages/${HELLO_WORLD}.mjs";`
      );
      expect(output).toMatch(
        new RegExp(
          `\\$_hash: "${HELLO_WORLD}",\\s*\\$_tree: "Hello world",\\s*inline: __gt_inline_${HELLO_WORLD}\\s*}`
        )
      );
      expect(output).not.toContain('locale =>');
    });

    it('imports the virtual module for <T>', async () => {
      const root = createProject({ fr: { [JSX_HELLO_WORLD]: 'Bonjour' } });
      const plugin = createPlugin(
        root,
        moduleOptions(root, ['fr'], { modules: 'virtual' })
      );
      const output = await transform(plugin, root, T_COMPONENT_CODE);
      expect(output).toContain(
        `import __gt_inline_${JSX_HELLO_WORLD} from "virtual:gt/messages/${JSX_HELLO_WORLD}.mjs";`
      );
      expect(output).toContain(`inline: __gt_inline_${JSX_HELLO_WORLD}`);
    });

    it('imports physical modules relative to a custom modulesDir', async () => {
      const root = createProject({ fr: { [HELLO_WORLD]: 'Bonjour' } });
      const plugin = createPlugin(
        root,
        moduleOptions(root, ['fr'], {
          modules: 'physical',
          modulesDir: 'generated/messages',
        })
      );
      const output = await transform(
        plugin,
        root,
        USEGT_CODE,
        'src/pages/deep/Page.tsx'
      );
      expect(output).toContain(
        `from "../../../generated/messages/${HELLO_WORLD}.mjs"`
      );
    });

    it('imports a module once for call sites sharing a hash', async () => {
      const root = createProject({ fr: { [HELLO_WORLD]: 'Bonjour' } });
      const plugin = createPlugin(
        root,
        moduleOptions(root, ['fr'], { modules: 'physical' })
      );
      const output = await transform(
        plugin,
        root,
        `${USEGT_CODE}\n  gt\`Hello world\`;\n`
      );
      expect(output.match(/^import __gt_inline_/gm)).toHaveLength(1);
      // Both call sites read the one precomputed message.
      expect(output.match(/inline: __gt_inline_/g)).toHaveLength(1);
      expect(output.match(/gt\(_gt\)/g)).toHaveLength(2);
    });

    it('inlines the callback for hashes that cannot name a module', async () => {
      const root = createProject({ fr: { Custom: 'Perso' } });
      const plugin = createPlugin(
        root,
        moduleOptions(root, ['fr'], { modules: 'physical' })
      );
      const output = await transform(
        plugin,
        root,
        `
          import { jsx } from 'react/jsx-runtime';
          import { T } from 'gt-react';
          export const el = jsx(T, { _hash: "Custom", children: "Hello world" });
        `
      );
      expect(output).not.toContain('__gt_inline_');
      expect(output).toContain('locale === "fr" ? "Perso" : void 0');
    });

    it('inlines the callback in CommonJS files', async () => {
      const root = createProject({ fr: { [JSX_HELLO_WORLD]: 'Bonjour' } });
      const plugin = createPlugin(
        root,
        moduleOptions(root, ['fr'], { modules: 'physical' })
      );
      const output = await transform(
        plugin,
        root,
        `
          const { jsx } = require('react/jsx-runtime');
          const { T } = require('gt-react');
          module.exports = jsx(T, { children: "Hello world" });
        `,
        'src/legacy.js'
      );
      expect(output).not.toContain('import __gt_inline_');
    });

    it('does nothing outside production builds', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      const root = createProject({ fr: { [HELLO_WORLD]: 'Bonjour' } });
      const plugin = createPlugin(
        root,
        moduleOptions(root, ['fr'], { modules: 'physical' })
      );
      plugin.buildStart.call(createContext());
      const output = await transform(plugin, root, USEGT_CODE);
      expect(output).not.toContain('__gt_inline_');
      expect(fs.existsSync(path.join(root, '.gt'))).toBe(false);
    });

    it.each(['physical', 'virtual'] as const)(
      'embeds %s modules when NODE_ENV becomes production after the plugin is created',
      async (modules) => {
        vi.stubEnv('NODE_ENV', undefined);
        const root = createProject({ fr: { [HELLO_WORLD]: 'Bonjour' } });
        const plugin = createPlugin(
          root,
          moduleOptions(root, ['fr'], { modules })
        );
        vi.stubEnv('NODE_ENV', 'production');
        plugin.buildStart.call(createContext());
        const output = await transform(plugin, root, USEGT_CODE);
        expect(output).toContain(`inline: __gt_inline_${HELLO_WORLD}`);
        const source =
          modules === 'physical'
            ? fs.readFileSync(
                path.join(root, '.gt/messages', `${HELLO_WORLD}.mjs`),
                'utf8'
              )
            : plugin.load.call(
                createContext(),
                `\0virtual:gt/messages/${HELLO_WORLD}.mjs`
              )?.code;
        expect(source).toBe(
          renderInlineTranslationsModule(
            { fr: { [HELLO_WORLD]: 'Bonjour' } },
            HELLO_WORLD
          )
        );
      }
    );

    it('imports a module by absolute path from another Windows drive', async () => {
      vi.resetModules();
      vi.doMock('node:path', async () => {
        const actual =
          await vi.importActual<typeof import('node:path')>('node:path');
        return { ...actual.win32, default: actual.win32 };
      });
      onTestFinished(() => {
        vi.doUnmock('node:path');
        vi.resetModules();
      });
      const { addInlineTranslationsImports } =
        await import('../transform/injection/inline-translations/addInlineTranslationsImports');
      const program = t.program([]);
      const imports = new Map([[HELLO_WORLD, 'm']]);
      const sources = (importer: string) => {
        program.body = [];
        addInlineTranslationsImports(
          program,
          imports,
          { mode: 'physical', dir: 'C:\\app\\.gt\\messages' },
          importer
        );
        return (program.body[0] as t.ImportDeclaration).source.value;
      };
      expect(sources('D:\\src\\App.tsx')).toBe(
        `C:/app/.gt/messages/${HELLO_WORLD}.mjs`
      );
      expect(sources('C:\\app\\src\\App.tsx')).toBe(
        `../.gt/messages/${HELLO_WORLD}.mjs`
      );
    });

    it('does not transform message modules', () => {
      const root = createProject({ fr: { [HELLO_WORLD]: 'Bonjour' } });
      const plugin = createPlugin(
        root,
        moduleOptions(root, ['fr'], { modules: 'physical' })
      );
      plugin.buildStart.call(createContext());
      expect(
        plugin.transformInclude(
          path.join(root, '.gt/messages', `${HELLO_WORLD}.mjs`)
        )
      ).toBe(false);
      expect(
        plugin.transformInclude(`\0virtual:gt/messages/${HELLO_WORLD}.mjs`)
      ).toBe(false);
      expect(plugin.transformInclude(path.join(root, 'src/abc.js'))).toBe(true);
    });

    it('transforms source files inside modulesDir', () => {
      const root = createProject({ fr: { [HELLO_WORLD]: 'Bonjour' } });
      const plugin = createPlugin(
        root,
        moduleOptions(root, ['fr'], { modules: 'physical', modulesDir: '.' })
      );
      plugin.buildStart.call(createContext());
      expect(
        plugin.transformInclude(path.join(root, `${HELLO_WORLD}.mjs`))
      ).toBe(false);
      expect(plugin.transformInclude(path.join(root, 'index.js'))).toBe(true);
      expect(plugin.transformInclude(path.join(root, 'App.tsx'))).toBe(true);
    });

    it('inlines the callback in files that use the generated import prefix', async () => {
      const root = createProject({ fr: { custom: 'Perso' } });
      const plugin = createPlugin(
        root,
        moduleOptions(root, ['fr'], { modules: 'physical' })
      );
      const output = await transform(
        plugin,
        root,
        `
          import { jsx } from 'react/jsx-runtime';
          import { T } from 'gt-react';
          const __gt_inline_custom = 1;
          export const el = jsx(T, { _hash: "custom", children: "Hello world" });
        `
      );
      expect(output).not.toContain('import __gt_inline_custom');
      expect(output).toContain('locale === "fr" ? "Perso" : void 0');
    });

    it('fails production builds that embed translations without compileTimeHash', () => {
      const root = createProject({ fr: { [HELLO_WORLD]: 'Bonjour' } });
      const plugin = createPlugin(root, {
        ...moduleOptions(root, ['fr'], {}),
        compileTimeHash: false,
      });
      expect(() => plugin.buildStart.call(createContext())).toThrow(
        'files.gt.inlineTranslations is set, but compileTimeHash is false'
      );
      vi.stubEnv('NODE_ENV', 'development');
      expect(() => plugin.buildStart.call(createContext())).not.toThrow();
    });
  });

  describe('physical modules', () => {
    it('writes one module per hash at build start', () => {
      const root = createProject({
        fr: { [HELLO_WORLD]: 'Bonjour', [OTHER_HASH]: 'Étape' },
        es: { [HELLO_WORLD]: 'Hola' },
      });
      const plugin = createPlugin(
        root,
        moduleOptions(root, ['fr', 'es'], { modules: 'physical' })
      );
      plugin.buildStart.call(createContext());
      const dir = path.join(root, '.gt/messages');
      expect(fs.readdirSync(dir).sort()).toEqual(
        [`${HELLO_WORLD}.mjs`, `${OTHER_HASH}.mjs`].sort()
      );
      expect(
        fs.readFileSync(path.join(dir, `${HELLO_WORLD}.mjs`), 'utf8')
      ).toContain('locale === "fr" ? "Bonjour" : locale === "es" ? "Hola"');
    });

    it('names a locale file that is not valid JSON', () => {
      const root = createProject({});
      const file = path.join(root, 'translations', 'fr.json');
      fs.writeFileSync(file, '{ "abc": ');
      const plugin = createPlugin(
        root,
        moduleOptions(root, ['fr'], { modules: 'physical' })
      );
      expect(() => plugin.buildStart.call(createContext())).toThrow(
        `Could not read the embedded translations in ${file}`
      );
    });

    it('falls back to physical modules with a warning where virtual modules are unsupported', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const root = createProject({ fr: { [HELLO_WORLD]: 'Bonjour' } });
      const plugin = createPlugin(
        root,
        moduleOptions(root, ['fr'], { modules: 'virtual' }),
        'webpack'
      );
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Virtual modules for embedded translations are not supported with webpack'
        )
      );
      plugin.buildStart.call(createContext());
      expect(
        fs.existsSync(path.join(root, '.gt/messages', `${HELLO_WORLD}.mjs`))
      ).toBe(true);
      const output = await transform(plugin, root, USEGT_CODE);
      expect(output).toContain(`from "../.gt/messages/${HELLO_WORLD}.mjs"`);
    });
  });

  describe('virtual modules', () => {
    it('resolves message ids to \\0-prefixed ids', () => {
      const root = createProject({});
      const plugin = createPlugin(
        root,
        moduleOptions(root, ['fr'], { modules: 'virtual' })
      );
      const id = `virtual:gt/messages/${HELLO_WORLD}.mjs`;
      expect(plugin.resolveId.call(createContext(), id)).toBe(`\0${id}`);
      expect(plugin.resolveId.call(createContext(), `\0${id}`)).toBeNull();
      expect(
        plugin.resolveId.call(createContext(), 'virtual:gt/messages/../x.js')
      ).toBeNull();
      expect(plugin.resolveId.call(createContext(), './App.tsx')).toBeNull();
    });

    it('loads a message module from the translation files', () => {
      const root = createProject({
        fr: { [HELLO_WORLD]: 'Bonjour' },
        es: { [HELLO_WORLD]: 'Hola' },
      });
      const plugin = createPlugin(
        root,
        moduleOptions(root, ['fr', 'es'], { modules: 'virtual' })
      );
      const watched: string[] = [];
      const id = `\0virtual:gt/messages/${HELLO_WORLD}.mjs`;
      expect(plugin.loadInclude(id)).toBe(true);
      const result = plugin.load.call(createContext(watched), id);
      expect(result).toEqual({
        code: renderInlineTranslationsModule(
          { fr: { [HELLO_WORLD]: 'Bonjour' }, es: { [HELLO_WORLD]: 'Hola' } },
          HELLO_WORLD
        ),
        moduleSideEffects: false,
      });
      expect(watched.sort()).toEqual(
        [
          path.join(root, 'translations', 'es.json'),
          path.join(root, 'translations', 'fr.json'),
        ].sort()
      );
    });

    it('loads a module returning undefined for an unknown hash', () => {
      const root = createProject({ fr: {} });
      const plugin = createPlugin(
        root,
        moduleOptions(root, ['fr'], { modules: 'virtual' })
      );
      expect(
        plugin.load.call(
          createContext(),
          `\0virtual:gt/messages/${OTHER_HASH}.mjs`
        )
      ).toEqual({
        code: 'export default () => undefined;\n',
        moduleSideEffects: false,
      });
    });

    it('ignores other ids and physical mode', () => {
      const root = createProject({});
      const physical = createPlugin(
        root,
        moduleOptions(root, ['fr'], { modules: 'physical' })
      );
      const id = `\0virtual:gt/messages/${HELLO_WORLD}.mjs`;
      expect(physical.loadInclude(id)).toBe(false);
      expect(physical.load.call(createContext(), id)).toBeNull();
      expect(physical.resolveId.call(createContext(), id.slice(1))).toBeNull();
    });
  });
});

describe('webpack cache version', () => {
  type WebpackPlugin = { webpack(compiler: unknown): void };

  function cacheVersion(
    gtConfig: GTUnpluginOptions['gtConfig'],
    staticLocale?: string,
    experimentalReplaceSource?: boolean
  ): string | undefined {
    const plugin = gtUnplugin.raw(
      {
        gtConfig,
        ...(staticLocale && { experimentalStaticLocale: staticLocale }),
        experimentalReplaceSource,
      },
      { framework: 'webpack' } as never
    ) as unknown as WebpackPlugin;
    const options = {
      cache: { type: 'filesystem', version: 'next' },
      module: { rules: [] },
    };
    plugin.webpack({ options });
    return options.cache.version;
  }

  const embedding = (inline: Record<string, unknown> = {}) => ({
    defaultLocale: 'en',
    locales: ['fr', 'es'],
    files: {
      gt: {
        output: 'translations/[locale].json',
        inlineTranslations: { locales: ['fr', 'es'], ...inline },
      },
    },
  });

  beforeEach(() => vi.stubEnv('NODE_ENV', 'production'));
  afterEach(() => vi.unstubAllEnvs());

  it('changes with the embedded translations settings', () => {
    const versions = new Set([
      cacheVersion(embedding()),
      cacheVersion(embedding({ modules: 'physical' })),
      cacheVersion(embedding({ locales: ['fr'] })),
      cacheVersion(embedding({ modulesDir: 'generated/messages' })),
    ]);
    expect(versions.size).toBe(4);
    for (const version of versions) {
      expect(version).toMatch(/^next\|gt-inline-translations:[0-9a-f]{16}$/);
    }
  });

  it('changes when a locale file is created or edited', () => {
    const root = createProject({});
    const file = path.join(root, 'translations', 'fr.json');
    const config = {
      files: {
        gt: {
          output: path.join(root, 'translations', '[locale].json'),
          inlineTranslations: { locales: ['fr'] },
        },
      },
    };
    const versions = [cacheVersion(config)];
    fs.writeFileSync(file, '{}');
    versions.push(cacheVersion(config));
    fs.writeFileSync(file, '{"abc":"Bonjour"}');
    versions.push(cacheVersion(config));
    expect(new Set(versions).size).toBe(3);
  });

  it('changes with the static locale', () => {
    const versions = new Set([
      cacheVersion(embedding()),
      cacheVersion(embedding(), 'fr'),
      cacheVersion(embedding(), 'es'),
      cacheVersion(embedding(), 'en'),
    ]);
    expect(versions.size).toBe(4);
  });

  it('changes when a per-locale build replaces source content', () => {
    expect(cacheVersion(embedding(), 'fr', true)).not.toBe(
      cacheVersion(embedding(), 'fr', false)
    );
  });

  it('changes when a per-locale build moves physical modules', () => {
    const singleLocale = {
      files: {
        gt: {
          output: 'translations/[locale].json',
          inlineTranslations: {
            locales: ['fr'],
            modules: 'physical' as const,
          },
        },
      },
    };
    expect(cacheVersion(singleLocale, 'fr')).not.toBe(
      cacheVersion(singleLocale)
    );
  });

  it('is left alone without embedded translations or outside production', () => {
    expect(cacheVersion({ files: { gt: {} } })).toBe('next');
    vi.stubEnv('NODE_ENV', 'development');
    expect(cacheVersion(embedding())).toBe('next');
  });
});
