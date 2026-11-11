import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parse } from '@babel/parser';
import generateModule from '@babel/generator';
import fs from 'node:fs';
import { updateViteConfig } from '../updateViteConfig.js';
import { addCompilerImport } from '../utils/addCompilerImport.js';
import { addPluginInvocation } from '../utils/addPluginInvocation.js';
import { checkCompilerImport } from '../utils/checkCompilerImport.js';
import { checkPluginInvocation } from '../utils/checkPluginInvocation.js';
import { exitSync } from '../../../../console/logging.js';

vi.mock('node:fs', () => ({
  default: { promises: { readFile: vi.fn(), writeFile: vi.fn() } },
}));
vi.mock('../../../../console/logging.js', () => ({ exitSync: vi.fn() }));
vi.mock('../../../../console/logger.js', () => ({
  logger: {
    createSpinner: () => ({ start: vi.fn(), stop: vi.fn() }),
    error: vi.fn(),
  },
}));

const generate = generateModule.default || generateModule;

const COMPILER = '@generaltranslation/compiler';
const ESM_IMPORT = `import { vite as gtCompiler } from "${COMPILER}";`;
const CJS_REQUIRE = `const gtCompiler = require("${COMPILER}").vite;`;

const parseCode = (code: string) =>
  parse(code, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
/** Collapses whitespace so expectations do not depend on code layout. */
const squash = (code: string) => code.replace(/\s+/g, ' ').trim();
const print = (ast: ReturnType<typeof parseCode>) => squash(generate(ast).code);

describe('updateViteConfig', () => {
  const readFile = vi.mocked(fs.promises.readFile);
  const writeFile = vi.mocked(fs.promises.writeFile);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  async function update(code: string, viteConfigPath = '/app/vite.config.ts') {
    readFile.mockResolvedValue(code);
    const warnings: string[] = [];
    const filesUpdated: string[] = [];
    await updateViteConfig({
      errors: [],
      warnings,
      filesUpdated,
      viteConfigPath,
    });
    expect(writeFile).toHaveBeenCalledOnce();
    expect(writeFile.mock.calls[0][0]).toBe(viteConfigPath);
    expect(filesUpdated).toEqual([viteConfigPath]);
    return { code: squash(String(writeFile.mock.calls[0][1])), warnings };
  }

  it.each([
    [
      'adds the import and the plugin to an ESM config',
      `import { defineConfig } from 'vite';
       import react from '@vitejs/plugin-react';
       export default defineConfig({ plugins: [react()] });`,
      `${ESM_IMPORT}import { defineConfig } from 'vite'; import react from '@vitejs/plugin-react'; export default defineConfig({ plugins: [react(), gtCompiler()] });`,
    ],
    [
      'adds the require and the plugin to a CJS config',
      `const { defineConfig } = require('vite');
       const react = require('@vitejs/plugin-react');
       module.exports = defineConfig({ plugins: [react()] });`,
      `${CJS_REQUIRE}const { defineConfig } = require('vite'); const react = require('@vitejs/plugin-react'); module.exports = defineConfig({ plugins: [react(), gtCompiler()] });`,
    ],
    [
      'leaves a config that already uses the plugin unchanged',
      `import { defineConfig } from 'vite';
       import { vite as myCompiler } from '${COMPILER}';
       export default defineConfig({ plugins: [myCompiler()] });`,
      `import { defineConfig } from 'vite'; import { vite as myCompiler } from '${COMPILER}'; export default defineConfig({ plugins: [myCompiler()] });`,
    ],
    [
      'reuses an aliased named import',
      `import { vite as myCompiler } from '${COMPILER}';
       export default defineConfig({ plugins: [react()] });`,
      `import { vite as myCompiler } from '${COMPILER}'; export default defineConfig({ plugins: [react(), myCompiler()] });`,
    ],
    [
      'reuses a namespace import',
      `import * as gt from '${COMPILER}';
       export default defineConfig({ plugins: [react()] });`,
      `import * as gt from '${COMPILER}'; export default defineConfig({ plugins: [react(), gt.vite()] });`,
    ],
    [
      'reuses a default import',
      `import gtDefault from '${COMPILER}';
       export default defineConfig({ plugins: [react()] });`,
      `import gtDefault from '${COMPILER}'; export default defineConfig({ plugins: [react(), gtDefault.vite()] });`,
    ],
    [
      'reuses a destructured require',
      `const { vite: myCompiler } = require('${COMPILER}');
       module.exports = defineConfig({ plugins: [react()] });`,
      `const { vite: myCompiler } = require('${COMPILER}'); module.exports = defineConfig({ plugins: [react(), myCompiler()] });`,
    ],
    [
      'reuses a namespace require',
      `const gt = require('${COMPILER}');
       module.exports = defineConfig({ plugins: [react()] });`,
      `const gt = require('${COMPILER}'); module.exports = defineConfig({ plugins: [react(), gt.vite()] });`,
    ],
    [
      'only touches the top-level plugins of the config',
      `import { defineConfig } from 'vite';
       export default defineConfig({
         plugins: [react({ babel: { plugins: ['@babel/plugin-syntax-jsx'] } })],
         esbuild: { jsxFactory: 'React.createElement' }
       });`,
      `${ESM_IMPORT}import { defineConfig } from 'vite'; export default defineConfig({ plugins: [react({ babel: { plugins: ['@babel/plugin-syntax-jsx'] } }), gtCompiler()], esbuild: { jsxFactory: 'React.createElement' } });`,
    ],
  ])('%s', async (_name, input, expected) => {
    const result = await update(input, '/app/vite.config.js');

    expect(result.code).toBe(expected);
    expect(result.warnings).toEqual([]);
  });

  it('uses an ESM import and warns when the config mixes import and require', async () => {
    const result = await update(
      `import { defineConfig } from 'vite';
       const react = require('@vitejs/plugin-react');
       export default defineConfig({ plugins: [react()] });`
    );

    expect(result.code).toBe(
      `${ESM_IMPORT}import { defineConfig } from 'vite'; const react = require('@vitejs/plugin-react'); export default defineConfig({ plugins: [react(), gtCompiler()] });`
    );
    expect(result.warnings).toEqual([
      expect.stringContaining('Mixed ES6 imports and CommonJS require'),
    ]);
  });

  // The import is still added; the user has to add the plugin by hand
  it.each([
    [
      'a config without plugins',
      `import { defineConfig } from 'vite';
       export default defineConfig({ server: { port: 3000 } });`,
      `${ESM_IMPORT}import { defineConfig } from 'vite'; export default defineConfig({ server: { port: 3000 } });`,
    ],
    [
      'a config function',
      `import { defineConfig } from 'vite';
       export default defineConfig(({ mode }) => ({ plugins: [react()] }));`,
      `${ESM_IMPORT}import { defineConfig } from 'vite'; export default defineConfig(({ mode }) => ({ plugins: [react()] }));`,
    ],
    [
      'a config passed as a variable',
      `import { defineConfig } from 'vite';
       const config: UserConfig = { plugins: [react()] };
       export default defineConfig(config);`,
      `${ESM_IMPORT}import { defineConfig } from 'vite'; const config: UserConfig = { plugins: [react()] }; export default defineConfig(config);`,
    ],
    ['an empty file', '', ESM_IMPORT],
  ])(
    'warns when it cannot add the plugin to %s',
    async (_name, input, expected) => {
      const result = await update(input);

      expect(result.code).toBe(expected);
      expect(result.warnings).toEqual([
        expect.stringMatching(
          /^Failed to add gt compiler plugin to \/app\/vite\.config\.ts\. Add the plugin manually:/
        ),
      ]);
    }
  );

  describe('failures', () => {
    const run = () =>
      updateViteConfig({
        errors: [],
        warnings: [],
        filesUpdated: [],
        viteConfigPath: '/app/vite.config.ts',
      });

    beforeEach(() => {
      vi.mocked(exitSync).mockImplementation(() => {
        throw new Error('Process exited');
      });
    });

    it('exits when the config cannot be read', async () => {
      readFile.mockRejectedValue(new Error('File not found'));

      await expect(run()).rejects.toThrow('Process exited');
      expect(exitSync).toHaveBeenCalledWith(1);
      expect(writeFile).not.toHaveBeenCalled();
    });

    it('exits when the config cannot be parsed', async () => {
      readFile.mockResolvedValue(
        'export default defineConfig({ plugins: [ }] });'
      );

      await expect(run()).rejects.toThrow('Process exited');
      expect(exitSync).toHaveBeenCalledWith(1);
      expect(writeFile).not.toHaveBeenCalled();
    });

    it('exits when the config cannot be written', async () => {
      readFile.mockResolvedValue(
        'export default defineConfig({ plugins: [] });'
      );
      writeFile.mockRejectedValue(new Error('Permission denied'));

      await expect(run()).rejects.toThrow('Process exited');
      expect(exitSync).toHaveBeenCalledWith(1);
    });
  });
});

describe('addCompilerImport', () => {
  const config = `// Vite configuration
    import { defineConfig } from 'vite';
    export default defineConfig({});`;

  it.each([
    ['an ESM import', false, ESM_IMPORT],
    ['a CJS require', true, CJS_REQUIRE],
  ])('prepends %s', (_name, cjsEnabled, statement) => {
    const ast = parseCode(config);
    addCompilerImport({ ast, cjsEnabled });
    const empty = parseCode('');
    addCompilerImport({ ast: empty, cjsEnabled });

    expect(print(ast)).toBe(
      `${statement} // Vite configuration import { defineConfig } from 'vite'; export default defineConfig({});`
    );
    expect(print(empty)).toBe(statement);
  });
});

describe('addPluginInvocation', () => {
  function add(code: string, alias: string | null, namespaces: string[] = []) {
    const ast = parseCode(code);
    const added = addPluginInvocation({ ast, alias, namespaces });
    return { added, code: print(ast) };
  }

  it.each<[string, string, string | null, string[], string]>([
    [
      'the alias to a plugins array',
      'export default defineConfig({ plugins: [react()] });',
      'gtCompiler',
      [],
      'export default defineConfig({ plugins: [react(), gtCompiler()] });',
    ],
    [
      'the alias to an empty plugins array',
      'export default defineConfig({ plugins: [] });',
      'myPlugin',
      [],
      'export default defineConfig({ plugins: [myPlugin()] });',
    ],
    [
      'the alias even when namespaces are known',
      'export default defineConfig({ plugins: [] });',
      'gtCompiler',
      ['gt'],
      'export default defineConfig({ plugins: [gtCompiler()] });',
    ],
    [
      'the first namespace when there is no alias',
      'export default defineConfig({ plugins: [react()] });',
      null,
      ['firstNamespace', 'secondNamespace'],
      'export default defineConfig({ plugins: [react(), firstNamespace.vite()] });',
    ],
    [
      'a spread of plugins given as a variable',
      'export default defineConfig({ plugins: basePlugins });',
      'gtCompiler',
      [],
      'export default defineConfig({ plugins: [...basePlugins, gtCompiler()] });',
    ],
    [
      'a spread of plugins given as a call',
      'export default defineConfig({ plugins: getPlugins() });',
      null,
      ['gt'],
      'export default defineConfig({ plugins: [...getPlugins(), gt.vite()] });',
    ],
    [
      'a spread of plugins given as a conditional',
      'export default defineConfig({ plugins: isDev ? devPlugins : prodPlugins });',
      'gtCompiler',
      [],
      'export default defineConfig({ plugins: [...(isDev ? devPlugins : prodPlugins), gtCompiler()] });',
    ],
    [
      'the plugin to a string-keyed plugins property',
      'export default defineConfig({ "plugins": [react()] });',
      'gtCompiler',
      [],
      'export default defineConfig({ "plugins": [react(), gtCompiler()] });',
    ],
    [
      'the plugin to the top-level plugins only',
      'export default defineConfig({ plugins: [react()], build: { rollupOptions: { plugins: [other()] } } });',
      'gtCompiler',
      [],
      'export default defineConfig({ plugins: [react(), gtCompiler()], build: { rollupOptions: { plugins: [other()] } } });',
    ],
    [
      'the plugin to a module.exports config',
      'module.exports = defineConfig({ plugins: [react()] });',
      'gtCompiler',
      [],
      'module.exports = defineConfig({ plugins: [react(), gtCompiler()] });',
    ],
  ])('adds %s', (_name, code, alias, namespaces, expected) => {
    expect(add(code, alias, namespaces)).toEqual({
      added: true,
      code: expected,
    });
  });

  it.each<[string, string, string | null, string[]]>([
    [
      'without an alias or namespace',
      'export default defineConfig({ plugins: [react()] });',
      null,
      [],
    ],
    [
      'with an empty alias',
      'export default defineConfig({ plugins: [react()] });',
      '',
      [],
    ],
    [
      'to a config without plugins',
      'export default defineConfig({ server: { port: 3000 } });',
      'gtCompiler',
      [],
    ],
    [
      'to a computed plugins key',
      'export default defineConfig({ [key]: [react()] });',
      'gtCompiler',
      [],
    ],
    [
      'to a config function',
      'export default defineConfig(() => ({ plugins: [react()] }));',
      'gtCompiler',
      [],
    ],
    ['to an empty file', '', 'gtCompiler', []],
  ])('adds nothing %s', (_name, code, alias, namespaces) => {
    expect(add(code, alias, namespaces)).toEqual({ added: false, code });
  });
});

describe('checkCompilerImport', () => {
  const found = (alias: string | null, namespaces: string[] = []) => ({
    hasCompilerImport: true,
    alias,
    namespaces,
  });
  const notFound = { hasCompilerImport: false, alias: null, namespaces: [] };

  it.each([
    // import declarations
    [`import { vite } from '${COMPILER}';`, found('vite')],
    [`import { vite as gtCompiler } from '${COMPILER}';`, found('gtCompiler')],
    [
      `import { other, vite as gtCompiler, another } from '${COMPILER}';`,
      found('gtCompiler'),
    ],
    [`import gt from '${COMPILER}';`, found(null, ['gt'])],
    [`import * as gt from '${COMPILER}';`, found(null, ['gt'])],
    [
      `import gt, { vite as compiler } from '${COMPILER}';`,
      found('compiler', ['gt']),
    ],
    [`import gt, { other } from '${COMPILER}';`, found(null, ['gt'])],
    [`import { other, something } from '${COMPILER}';`, notFound],
    [`import { vite } from '@different/package';`, notFound],
    [`import { vite } from '${COMPILER}-different';`, notFound],

    // require
    [`const gt = require('${COMPILER}');`, found(null, ['gt'])],
    [`var gt = require('${COMPILER}');`, found(null, ['gt'])],
    [`const a = 1, gt = require('${COMPILER}'), b = 2;`, found(null, ['gt'])],
    [`const { vite } = require('${COMPILER}');`, found('vite')],
    [
      `const { other, vite: compiler, another } = require('${COMPILER}');`,
      found('compiler'),
    ],
    [`const a = 1, { vite } = require('${COMPILER}'), b = 2;`, found('vite')],
    [
      `const { ...everything } = require('${COMPILER}');`,
      found(null, ['everything']),
    ],
    [
      `const { other, ...rest } = require('${COMPILER}');`,
      found(null, ['rest']),
    ],
    [
      `const { vite: compiler, ...rest } = require('${COMPILER}');`,
      found('compiler'),
    ],
    [`const gtCompiler = require('${COMPILER}').vite;`, found('gtCompiler')],
    [`const { other, something } = require('${COMPILER}');`, notFound],
    [`const something = require('${COMPILER}').otherProperty;`, notFound],
    [`const { vite } = require('@different/package');`, notFound],
    [`const gt = require('${COMPILER}-different');`, notFound],

    // patterns that are not recognized
    [`const { a: { b: { vite } } } = require('${COMPILER}');`, notFound],
    [`const [vite] = require('${COMPILER}');`, notFound],
    [`const compiler = require('${COMPILER}')['vite'];`, notFound],
    [`const name = '${COMPILER}'; const gt = require(name);`, notFound],
    ['', notFound],

    // several statements
    [
      `import { other } from '${COMPILER}';
       const { vite } = require('${COMPILER}');`,
      found('vite'),
    ],
    [
      `import * as gtImport from '${COMPILER}';
       import gtDefault from '${COMPILER}';
       const gtRequire = require('${COMPILER}');
       const { ...rest } = require('${COMPILER}');
       const { vite: compiler } = require('${COMPILER}');`,
      found('compiler', ['gtImport', 'gtDefault', 'gtRequire', 'rest']),
    ],
  ])('%s', (code, expected) => {
    expect(checkCompilerImport(parseCode(code))).toEqual(expected);
  });
});

describe('checkPluginInvocation', () => {
  it.each<[string, string | null, string[], boolean]>([
    [
      'export default defineConfig({ plugins: [react(), gtCompiler()] });',
      'gtCompiler',
      [],
      true,
    ],
    [
      'export default defineConfig({ plugins: [react(), gt.vite()] });',
      null,
      ['gt'],
      true,
    ],
    [
      'export default defineConfig({ plugins: [second.vite()] });',
      null,
      ['first', 'second'],
      true,
    ],
    [
      'export default defineConfig({ plugins: [gt.vite()] });',
      'gtCompiler',
      ['gt'],
      true,
    ],
    [
      'export default defineConfig({ plugins: [gtCompiler()] });',
      'gtCompiler',
      ['gt'],
      true,
    ],
    // An invocation anywhere in the file counts
    [
      'function getPlugins() { return [gtCompiler()]; }',
      'gtCompiler',
      [],
      true,
    ],
    ['const plugins = isDev ? [gt.vite()] : [];', null, ['gt'], true],

    [
      'export default defineConfig({ plugins: [otherPlugin()] });',
      'gtCompiler',
      [],
      false,
    ],
    [
      'export default defineConfig({ plugins: [wrong.vite()] });',
      null,
      ['gt'],
      false,
    ],
    [
      'export default defineConfig({ plugins: [gt.webpack()] });',
      null,
      ['gt'],
      false,
    ],
    [
      'export default defineConfig({ plugins: [gt.vitePlugin()] });',
      null,
      ['gt'],
      false,
    ],
    [
      'export default defineConfig({ plugins: [gtCompilerPlugin()] });',
      'gtCompiler',
      [],
      false,
    ],
    ['const plugin = gtCompiler;', 'gtCompiler', [], false],
    ['const plugin = gt.vite;', null, ['gt'], false],
    [
      'export default defineConfig({ plugins: [gtCompiler()] });',
      null,
      [],
      false,
    ],
    ['', 'gtCompiler', ['gt'], false],
  ])(
    '%s with alias %j and namespaces %j -> %s',
    (code, alias, namespaces, expected) => {
      expect(
        checkPluginInvocation({ ast: parseCode(code), alias, namespaces })
      ).toBe(expected);
    }
  );
});
