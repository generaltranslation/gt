import { beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import generate from '@babel/generator';
import { cliNextOutput } from './cli-oracle';
import { canonicalRuntime, isJsxPragmaComment, oracleCompiled } from './oracle';
import { resolveAutoJsxRuntime } from '../../../../cli/src/react/jsx/utils/jsxParsing/autoInsertion/projectRuntime';
import { createInlineUpdates } from '../../../../cli/src/react/parse/createInlineUpdates';
import { Libraries } from '../../../../cli/src/types/libraries';
import { ensureTAndVarImported } from '../../../../cli/src/react/jsx/utils/jsxParsing/autoInsertion';

const repository = fileURLToPath(new URL('../../../../../', import.meta.url));
const sourceApp = path.join(
  repository,
  'tests/apps/next-app-router/package.json'
);
const require = createRequire(sourceApp);
const loadJsConfig = require('next/dist/build/load-jsconfig').default;
const artifacts = mkdtempSync(
  path.join(tmpdir(), 'gt-auto-jsx-project-runtime-')
);
const input = 'export const Page = () => <p>Project selected runtime</p>;';

function write(directory: string, name: string, source: string) {
  const file = path.join(directory, name);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, source);
  return file;
}
function project(name: string, files: Record<string, string>) {
  const directory = path.join(artifacts, name);
  write(directory, 'src/Page.tsx', input);
  for (const [name, source] of Object.entries(files))
    write(directory, name, source);
  return directory;
}
const config = (source: unknown) =>
  JSON.stringify({ compilerOptions: { jsxImportSource: source } });
const hasInsertion = (source: string) =>
  source.includes('<GtInternalTranslateJsx');

const projects = [
  { name: 'no-config', files: {}, source: undefined },
  { name: 'empty-config', files: { 'tsconfig.json': '' }, source: undefined },
  {
    name: 'whitespace-config',
    files: { 'jsconfig.json': ' \n\t' },
    source: undefined,
  },
  {
    name: 'empty-import-source',
    files: { 'tsconfig.json': config('') },
    source: '',
  },
  {
    name: 'typescript-react',
    files: { 'tsconfig.json': config('react') },
    source: 'react',
  },
  {
    name: 'typescript-custom',
    files: { 'tsconfig.json': config('@parity/runtime') },
    source: '@parity/runtime',
  },
  {
    name: 'javascript-custom',
    files: { 'jsconfig.json': config('@parity/runtime') },
    source: '@parity/runtime',
  },
  {
    name: 'typescript-precedence',
    files: {
      'tsconfig.json': config('react'),
      'jsconfig.json': config('@parity/runtime'),
    },
    source: 'react',
  },
  {
    name: 'comments-bom-trailing-comma',
    files: {
      'tsconfig.json':
        '\ufeff{ // comment\n "compilerOptions": { "jsxImportSource": "@parity/runtime", }, }',
    },
    source: '@parity/runtime',
  },
  {
    name: 'relative-extends',
    files: {
      'base.json': config('@parity/runtime'),
      'tsconfig.json': '{"extends":"./base"}',
    },
    source: '@parity/runtime',
  },
  {
    name: 'javascript-extends',
    files: {
      'base.json': config('@parity/runtime'),
      'jsconfig.json': '{"extends":"./base.json"}',
    },
    source: '@parity/runtime',
  },
  {
    name: 'nested-extends',
    files: {
      'base.json': config('@parity/runtime'),
      'config/shared.json': '{"extends":"../base"}',
      'tsconfig.json': '{"extends":"./config/shared"}',
    },
    source: '@parity/runtime',
  },
  {
    name: 'local-override',
    files: {
      'base.json': config('@parity/runtime'),
      'tsconfig.json':
        '{"extends":"./base", "compilerOptions":{"jsxImportSource":"react"}}',
    },
    source: 'react',
  },
  {
    name: 'multiple-extends',
    files: {
      'first.json': config('react'),
      'second.json': config('@parity/runtime'),
      'tsconfig.json': '{"extends":["./first","./second"]}',
    },
    source: '@parity/runtime',
  },
  {
    name: 'diamond-extends',
    files: {
      'base.json': config('@parity/runtime'),
      'left.json':
        '{"extends":"./base", "compilerOptions":{"jsxImportSource":"react"}}',
      'right.json': '{"extends":"./base"}',
      'tsconfig.json': '{"extends":["./left","./right"]}',
    },
    source: '@parity/runtime',
  },
  {
    name: 'package-extends',
    files: {
      'node_modules/@parity/config/package.json':
        '{"name":"@parity/config","version":"1.0.0","tsconfig":"base.json"}',
      'node_modules/@parity/config/base.json': config('@parity/runtime'),
      'tsconfig.json': '{"extends":"@parity/config"}',
    },
    source: '@parity/runtime',
  },
  {
    name: 'package-subpath-extends',
    files: {
      'node_modules/@parity/config/package.json':
        '{"name":"@parity/config","version":"1.0.0"}',
      'node_modules/@parity/config/base.json': config('@parity/runtime'),
      'tsconfig.json': '{"extends":"@parity/config/base"}',
    },
    source: '@parity/runtime',
  },
  {
    name: 'nested-own-project',
    files: {
      'tsconfig.json': config('@parity/runtime'),
      'src/jsconfig.json': config('react'),
    },
    source: 'react',
  },
  {
    name: 'invalid-value-clears-inherited',
    files: {
      'base.json': config('@parity/runtime'),
      'tsconfig.json':
        '{"extends":"./base", "compilerOptions":{"jsxImportSource":null}}',
    },
    source: undefined,
  },
  {
    name: 'next-does-not-use-typescript-jsx-mode',
    files: { 'tsconfig.json': '{"compilerOptions":{"jsx":"react"}}' },
    source: undefined,
  },
].map((example) => ({
  ...example,
  directory: project(example.name, example.files),
}));

describe('CLI project-scoped automatic JSX eligibility', () => {
  it.each(projects)(
    '$name resolves before insertion',
    ({ directory, source }) => {
      const context = { file: path.join(directory, 'src/Page.tsx') };
      expect(resolveAutoJsxRuntime(context).jsxImportSource).toBe(source);
      expect(hasInsertion(cliNextOutput(input, context))).toBe(
        source === undefined || source === 'react'
      );
    }
  );
  it.each([
    ['/** @jsxImportSource react */', true],
    ['/** @jsxImportSource @other/runtime */', false],
    ['/** @jsxRuntime automatic */', false],
    ['/** @jsxRuntime classic */', false],
  ])(
    'source directive overrides the appropriate project option: %s',
    (comment, expected) => {
      const directory = projects.find(
        ({ name }) => name === 'typescript-custom'
      )!.directory;
      expect(
        hasInsertion(
          cliNextOutput(`${comment}\n${input}`, {
            file: path.join(directory, 'src/Page.tsx'),
          })
        )
      ).toBe(expected);
    }
  );
  it('keeps explicitly authored React runtime calls eligible in custom-runtime projects', () => {
    const directory = projects.find(
      ({ name }) => name === 'typescript-custom'
    )!.directory;
    const output = cliNextOutput(
      `import {jsx} from 'react/jsx-runtime'; export const Page=()=>jsx('p',{children:'Explicit React call'});`,
      { file: path.join(directory, 'src/Page.tsx') }
    );
    expect(output).toContain('jsx(GtInternalTranslateJsx');
  });
  it('uses the explicitly selected config instead of the nearest project', () => {
    const directory = project('explicit-selection', {
      'tsconfig.json': config('react'),
      'config/build.json': config('@parity/runtime'),
    });
    const context = {
      file: path.join(directory, 'src/Page.tsx'),
      configFile: path.join(directory, 'config/build.json'),
    };
    expect(resolveAutoJsxRuntime(context).jsxImportSource).toBe(
      '@parity/runtime'
    );
    expect(hasInsertion(cliNextOutput(input, context))).toBe(false);
  });
  it('rereads changed configuration without leaking between scans', () => {
    const directory = project('changed-project', {
      'tsconfig.json': config('@parity/runtime'),
    });
    const context = { file: path.join(directory, 'src/Page.tsx') };
    expect(hasInsertion(cliNextOutput(input, context))).toBe(false);
    write(directory, 'tsconfig.json', config('react'));
    expect(hasInsertion(cliNextOutput(input, context))).toBe(true);
  });
  it.each([
    {
      name: 'cycle',
      files: {
        'tsconfig.json': '{"extends":"./base"}',
        'base.json': '{"extends":"./tsconfig"}',
      },
    },
    {
      name: 'missing-base',
      files: { 'tsconfig.json': '{"extends":"./missing"}' },
    },
    { name: 'malformed', files: { 'tsconfig.json': '{"compilerOptions":' } },
  ])(
    'reports $name rather than silently inserting with the wrong runtime',
    ({ name, files }) => {
      const directory = project(name, files);
      expect(() =>
        cliNextOutput(input, { file: path.join(directory, 'src/Page.tsx') })
      ).toThrow('The JSX import source could not be read');
    }
  );
  it('main extraction resolves each physical source and preserves manual T in custom projects', async () => {
    const directory = project('main-extraction', {
      'tsconfig.json': config('@parity/runtime'),
      'src/override.tsx': `/** @jsxImportSource react */\nexport const Override=()=> <p>Source override</p>;`,
      'src/manual.tsx': `import {T} from 'gt-next'; export const Manual=()=> <T>Authored translation</T>;`,
      'nested/jsconfig.json': config('react'),
      'nested/Page.tsx': 'export const Page=()=> <p>Nested project</p>;',
    });
    const result = await createInlineUpdates(
      Libraries.GT_NEXT,
      false,
      [path.join(directory, '**/*.tsx')],
      { enableAutoJsxInjection: true },
      { conditionNames: ['import', 'require'] }
    );
    expect(result.errors).toEqual([]);
    expect(result.updates.map(({ source }) => source)).toEqual(
      expect.arrayContaining([
        'Source override',
        'Authored translation',
        'Nested project',
      ])
    );
    expect(result.updates).toHaveLength(3);
  });
  it('main extraction honors --jsconfig context and the disabled flag remains inert', async () => {
    const directory = project('main-explicit', {
      'tsconfig.json': config('react'),
      'chosen.json': config('@parity/runtime'),
    });
    const selected = {
      conditionNames: ['import'],
      jsxProjectConfigPath: path.join(directory, 'chosen.json'),
    };
    const result = await createInlineUpdates(
      Libraries.GT_NEXT,
      false,
      [path.join(directory, 'src/Page.tsx')],
      { enableAutoJsxInjection: true },
      selected
    );
    expect(result.errors).toEqual([]);
    expect(result.updates).toEqual([]);
    write(directory, 'chosen.json', '{invalid');
    await expect(
      createInlineUpdates(
        Libraries.GT_NEXT,
        false,
        [path.join(directory, 'src/Page.tsx')],
        { enableAutoJsxInjection: false },
        selected
      )
    ).resolves.toMatchObject({ errors: [], updates: [] });
  });
  it('cross-file Derive uses its own project and refreshes the cache when that runtime changes', async () => {
    const directory = project('derive-project-cache', {
      'tsconfig.json': config('react'),
      'child/tsconfig.json': config('@parity/runtime'),
      'child/value.tsx': `const who = 'Ada'; export function first() { return <span>Hello {who}</span>; } export function fresh() { return <span>Hello {who}</span>; }`,
    });
    async function extract(name: string, filename: string) {
      const file = write(
        directory,
        filename,
        `import {Derive} from 'gt-next'; import {${name}} from './child/value'; export const Page=()=> <main>Before <Derive>{${name}()}</Derive> after</main>;`
      );
      const result = await createInlineUpdates(
        Libraries.GT_NEXT,
        false,
        [file],
        { enableAutoJsxInjection: true },
        { conditionNames: ['import', 'require'] }
      );
      expect(result.errors).toEqual([]);
      return result.updates.map(({ metadata }) => metadata.hash).sort();
    }
    const custom = await extract('first', 'first.tsx');
    write(directory, 'child/tsconfig.json', config('react'));
    const refreshed = await extract('first', 'second.tsx');
    const fresh = await extract('fresh', 'fresh.tsx');
    expect(custom.length).toBeGreaterThan(0);
    expect(refreshed).toEqual(fresh);
    expect(refreshed).not.toEqual(custom);
  });
});

const hostCases = projects.filter(
  ({ name }) => !['nested-own-project', 'javascript-extends'].includes(name)
);
function host(
  sources: string[],
  jsConfigs: unknown[],
  development: boolean,
  plugin = false
): string[] {
  return JSON.parse(
    execFileSync(
      process.execPath,
      [fileURLToPath(new URL('./host/next-transform.mjs', import.meta.url))],
      {
        input: JSON.stringify({
          sourceApp,
          filename: path.join(repository, 'input.tsx'),
          sources,
          jsConfigs,
          development,
          ...(plugin && {
            swcPlugin: path.join(
              repository,
              'packages/next/dist/gt_swc_plugin.wasm'
            ),
            cacheRoot: path.join(
              repository,
              'packages/next/swc-plugin/target/auto-jsx-next-project-cache'
            ),
          }),
        }),
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
        timeout: 30_000,
      }
    )
  );
}
const canonical = (source: string) =>
  canonicalRuntime(parse(source, { sourceType: 'module' }));

describe('finite project configuration host baselines', () => {
  it('Next Webpack ignores jsconfig inheritance while the CLI resolves it', async () => {
    const example = projects.find(({ name }) => name === 'javascript-extends')!;
    const resolved = await loadJsConfig(example.directory, {
      typescript: { tsconfigPath: 'tsconfig.json' },
    });
    expect(resolved.jsConfig).toEqual({ extends: './base.json' });
    expect(
      resolveAutoJsxRuntime({
        file: path.join(example.directory, 'src/Page.tsx'),
      }).jsxImportSource
    ).toBe('@parity/runtime');
    const [output] = host([input], [resolved.jsConfig], false);
    expect(output).toContain('from "react/jsx-runtime"');
  });
  it('Next uses its selected app config while ordinary CLI scans use each file scope', async () => {
    const example = projects.find(({ name }) => name === 'nested-own-project')!;
    mkdirSync(path.join(example.directory, 'node_modules'), {
      recursive: true,
    });
    symlinkSync(
      path.dirname(require.resolve('typescript/package.json')),
      path.join(example.directory, 'node_modules/typescript'),
      'junction'
    );
    const resolved = await loadJsConfig(example.directory, {
      typescript: { tsconfigPath: 'tsconfig.json' },
    });
    const file = path.join(example.directory, 'src/Page.tsx');
    expect(resolved.jsConfig.compilerOptions.jsxImportSource).toBe(
      '@parity/runtime'
    );
    expect(resolveAutoJsxRuntime({ file }).jsxImportSource).toBe('react');
    expect(
      resolveAutoJsxRuntime({
        file,
        configFile: path.join(example.directory, 'tsconfig.json'),
      }).jsxImportSource
    ).toBe('@parity/runtime');
    const [output] = host([input], [resolved.jsConfig], false);
    expect(output).toContain('from "@parity/runtime/jsx-runtime"');
  });
});

function printedWithoutInsertion(source: string): string {
  const ast = parse(source, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });
  const before = new Set(ast.program.body);
  ensureTAndVarImported(ast, {});
  for (const statement of ast.program.body)
    if (statement.type === 'ImportDeclaration' && !before.has(statement))
      statement.source.value = 'gt-next';
  return generate(ast, {
    comments: false,
    shouldPrintComment: isJsxPragmaComment,
  }).code;
}

describe.each([false, true])(
  'actual Next project overrides, development=%s',
  (development) => {
    const headers = [
      { name: 'project default', source: '' },
      { name: 'explicit React', source: '/** @jsxImportSource react */' },
      {
        name: 'explicit classic',
        source:
          '/** @jsxRuntime classic */\nimport * as React from "react"; export const retainedReact = React;',
      },
      {
        name: 'explicit local custom',
        source: '/** @jsxImportSource ./custom-runtime */',
      },
    ];
    let compiled: string[];
    let wasm: string[];
    beforeAll(() => {
      const context = { jsxImportSource: '@parity/runtime' };
      const sources = headers.flatMap(({ source }) => {
        const original = `${source}\n${input}`;
        return [
          original,
          cliNextOutput(original, context),
          printedWithoutInsertion(original),
        ];
      });
      const jsConfigs = sources.map(() => ({
        compilerOptions: { jsxImportSource: '@parity/runtime' },
      }));
      compiled = host(sources, jsConfigs, development);
      wasm = host(
        sources.filter((_, index) => index % 3 === 0),
        jsConfigs.filter((_, index) => index % 3 === 0),
        development,
        true
      );
    });
    it.each(headers)(
      '$name retains its own runtime with a project source configured',
      (example) => {
        const index = headers.indexOf(example);
        expect(canonical(wasm[index])).toBe(
          canonicalRuntime(oracleCompiled(compiled[index * 3]))
        );
        expect(canonical(compiled[index * 3 + 1])).toBe(
          canonicalRuntime(oracleCompiled(compiled[index * 3 + 2]))
        );
      }
    );
  }
);

describe.each([false, true])(
  'actual Next project runtime, development=%s',
  (development) => {
    let compiled: string[];
    let wasm: string[];
    beforeAll(async () => {
      const jsConfigs = [];
      const sources = [];
      for (const example of hostCases) {
        mkdirSync(path.join(example.directory, 'node_modules'), {
          recursive: true,
        });
        if (
          !existsSync(path.join(example.directory, 'node_modules/typescript'))
        )
          symlinkSync(
            path.dirname(require.resolve('typescript/package.json')),
            path.join(example.directory, 'node_modules/typescript'),
            'junction'
          );
        const resolved = await loadJsConfig(example.directory, {
          typescript: { tsconfigPath: 'tsconfig.json' },
        });
        expect(resolved.jsConfig?.compilerOptions?.jsxImportSource).toBe(
          example.source
        );
        const original = input;
        sources.push(
          original,
          cliNextOutput(original, {
            file: path.join(example.directory, 'src/Page.tsx'),
          }),
          printedWithoutInsertion(original)
        );
        jsConfigs.push(
          resolved.jsConfig ?? {},
          resolved.jsConfig ?? {},
          resolved.jsConfig ?? {}
        );
      }
      compiled = host(sources, jsConfigs, development);
      wasm = host(
        sources.filter((_, index) => index % 3 === 0),
        jsConfigs.filter((_, index) => index % 3 === 0),
        development,
        true
      );
    });
    it.each(hostCases)(
      '$name matches compiler and distributed WASM after the same host',
      (example) => {
        // Locate by project identity instead of relying on Vitest's callback index.
        const index = hostCases.findIndex((item) => item.name === example.name);
        expect(canonical(wasm[index])).toBe(
          canonicalRuntime(oracleCompiled(compiled[index * 3]))
        );
        // Printing the CLI's eager import moves original JSX down one line.
        // Compare its printed baseline rather than erasing custom-runtime
        // jsxDEV source metadata, which is an observable helper argument.
        expect(canonical(compiled[index * 3 + 1])).toBe(
          canonicalRuntime(oracleCompiled(compiled[index * 3 + 2]))
        );
      }
    );
  }
);
