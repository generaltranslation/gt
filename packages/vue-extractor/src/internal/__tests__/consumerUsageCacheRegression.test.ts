import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectVueProject } from '../../detect.js';
import { inspectVueProject } from '../../inspect.js';
import {
  createConsumerUsageCache,
  packageConsumesPublicGT,
} from '../project/consumerUsage.js';
import { parseScriptAst } from '../script/parser.js';
import {
  createProjectFixture,
  removeProjectFixture,
  writeProjectFiles,
} from './projectTestUtils.js';

vi.mock('../script/parser.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../script/parser.js')>();
  return {
    ...actual,
    parseScriptAst: vi.fn(actual.parseScriptAst),
  };
});

const temporaryDirectories: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  for (const directory of temporaryDirectories.splice(0)) {
    removeProjectFixture(directory);
  }
});

describe('consumer wrapper usage cache', () => {
  it('parses each shared consumer source at most once across five wrapper queries', () => {
    const root = createWrapperWorkspace(5);
    const consumerDirectory = fs.realpathSync(path.join(root, 'apps/docs'));
    const consumerSourceDirectory = path.join(consumerDirectory, 'src');
    const consumerImportsFile = path.join(
      consumerSourceDirectory,
      'wrappers.ts'
    );
    const consumerMarkers = [
      'consumer-cache-ordinary',
      'consumer-cache-wrapper-imports',
    ];
    const parseScript = vi.mocked(parseScriptAst);
    const readDirectory = vi.spyOn(fs, 'readdirSync');
    const readFile = vi.spyOn(fs, 'readFileSync');
    parseScript.mockClear();

    expect(inspectVueProject(root)).toMatchObject({
      hasVueScopes: true,
      rootOwnsVue: false,
    });

    for (const marker of consumerMarkers) {
      expect(
        countSourceParses(parseScript.mock.calls, marker),
        marker
      ).toBeLessThanOrEqual(1);
    }
    expect(
      countSourceParses(
        parseScript.mock.calls,
        'consumer-cache-wrapper-imports'
      )
    ).toBe(1);
    expect(
      countPathCalls(readDirectory.mock.calls, consumerSourceDirectory)
    ).toBe(1);
    expect(countPathCalls(readFile.mock.calls, consumerImportsFile)).toBe(1);
    for (let index = 0; index < 5; index += 1) {
      expect(
        countSourceParses(
          parseScript.mock.calls,
          `wrapper-cache-source-${index}`
        )
      ).toBe(1);
    }

    readDirectory.mockRestore();
    readFile.mockRestore();
  });

  it('reuses one consumer scan for selection and propagation queries', () => {
    const root = createWrapperWorkspace(1);
    const parseScript = vi.mocked(parseScriptAst);
    parseScript.mockClear();

    expect(inspectVueProject(root)).toMatchObject({
      hasVueScopes: true,
      rootOwnsVue: false,
    });

    expect(
      countSourceParses(
        parseScript.mock.calls,
        'consumer-cache-wrapper-imports'
      )
    ).toBe(1);
  });

  it('does not retain consumer usage across separate inspections', () => {
    const root = createLocalWrapperApp(false);

    expect(detectVueProject(root)).toBe(false);
    expect(inspectVueProject(root)).toMatchObject({
      hasVueScopes: false,
      rootOwnsVue: false,
    });

    writeProjectFiles(root, {
      'src/App.ts': `
        import { WrapperT } from '@fixture/local-wrapper';
        export const component = WrapperT;
      `,
    });

    expect(detectVueProject(root)).toBe(true);
    expect(inspectVueProject(root)).toMatchObject({
      hasVueScopes: true,
      rootOwnsVue: true,
    });

    writeProjectFiles(root, {
      'src/App.ts': "export const component = 'react-only-again';\n",
    });

    expect(detectVueProject(root)).toBe(false);
    expect(inspectVueProject(root)).toMatchObject({
      hasVueScopes: false,
      rootOwnsVue: false,
    });
  });

  it('does not retain wrapper provenance across separate inspections', () => {
    const root = createLocalWrapperApp(true);

    expect(detectVueProject(root)).toBe(true);
    expect(inspectVueProject(root)).toMatchObject({
      hasVueScopes: true,
      rootOwnsVue: true,
    });

    writeProjectFiles(root, {
      'vendor/local-wrapper/src/index.ts':
        "export const WrapperT = 'ordinary';\n",
    });

    expect(detectVueProject(root)).toBe(false);
    expect(inspectVueProject(root)).toMatchObject({
      hasVueScopes: false,
      rootOwnsVue: false,
    });

    writeProjectFiles(root, {
      'vendor/local-wrapper/src/index.ts':
        "export { T as WrapperT } from 'gt-vue';\n",
    });

    expect(detectVueProject(root)).toBe(true);
    expect(inspectVueProject(root)).toMatchObject({
      hasVueScopes: true,
      rootOwnsVue: true,
    });
  });

  it('resumes a partially scanned consumer for a later wrapper query', () => {
    const root = createFixture({
      'package.json': JSON.stringify({
        name: '@fixture/consumer',
        exports: './entry.ts',
      }),
      'entry.ts': `
        import { WrapperA } from '@fixture/wrapper-a';
        export const component = WrapperA;
        export const marker = 'consumer-cache-early';
      `,
      'src/later.ts': `
        import { WrapperB } from '@fixture/wrapper-b';
        export const component = WrapperB;
        export const marker = 'consumer-cache-later';
      `,
      ...createDirectWrapperFiles('a'),
      ...createDirectWrapperFiles('b'),
    });
    const cache = createConsumerUsageCache();
    const parseScript = vi.mocked(parseScriptAst);
    parseScript.mockClear();

    expect(queryDirectWrapper(root, 'a', cache)).toBe(true);
    expect(
      countSourceParses(parseScript.mock.calls, 'consumer-cache-early')
    ).toBe(1);
    expect(
      countSourceParses(parseScript.mock.calls, 'consumer-cache-later')
    ).toBe(0);

    expect(queryDirectWrapper(root, 'b', cache)).toBe(true);
    expect(
      countSourceParses(parseScript.mock.calls, 'consumer-cache-early')
    ).toBe(1);
    expect(
      countSourceParses(parseScript.mock.calls, 'consumer-cache-later')
    ).toBe(1);
  });

  it('returns order-independent results for used and unused wrappers', () => {
    const wrapperNames = ['a', 'b', 'c', 'd', 'e', 'f'];
    const root = createFixture({
      'package.json': JSON.stringify({
        name: '@fixture/consumer',
        exports: './entry.ts',
      }),
      'entry.ts': createRuntimeConsumerImport('a'),
      'src/middle.ts': createRuntimeConsumerImport('c'),
      'src/later.ts': createRuntimeConsumerImport('f'),
      ...Object.assign(
        {},
        ...wrapperNames.map((name) => createDirectWrapperFiles(name))
      ),
    });
    const expected = new Map(
      wrapperNames.map((name) => [
        name,
        queryDirectWrapper(root, name, createConsumerUsageCache()),
      ])
    );

    expect(Object.fromEntries(expected)).toEqual({
      a: true,
      b: false,
      c: true,
      d: false,
      e: false,
      f: true,
    });
    for (const order of [
      wrapperNames,
      [...wrapperNames].reverse(),
      ['b', 'a', 'd', 'c', 'e', 'f'],
    ]) {
      const cache = createConsumerUsageCache();
      const actual = new Map(
        order.map((name) => [name, queryDirectWrapper(root, name, cache)])
      );
      expect(actual).toEqual(
        new Map(order.map((name) => [name, expected.get(name)]))
      );
    }
  });
});

function createWrapperWorkspace(wrapperCount: number): string {
  const dependencies: Record<string, string> = {};
  const imports: string[] = [];
  const wrappers: Record<string, string> = {};
  for (let index = 0; index < wrapperCount; index += 1) {
    const packageName = `@fixture/vue-wrapper-${index}`;
    dependencies[packageName] = 'workspace:*';
    imports.push(`import { WrapperT${index} } from '${packageName}';`);
    wrappers[`packages/wrapper-${index}/package.json`] = JSON.stringify({
      name: packageName,
      version: '1.0.0',
      exports: './src/index.ts',
      dependencies: { 'gt-vue': '*' },
    });
    wrappers[`packages/wrapper-${index}/src/index.ts`] =
      `// wrapper-cache-source-${index}\nexport { T as WrapperT${index} } from 'gt-vue';\n`;
  }

  return createFixture({
    'package.json': JSON.stringify({
      name: '@fixture/root',
      private: true,
      workspaces: ['packages/*', 'apps/*'],
    }),
    ...wrappers,
    'apps/docs/package.json': JSON.stringify({
      name: '@fixture/docs',
      version: '1.0.0',
      dependencies,
    }),
    'apps/docs/src/ordinary.ts':
      "export const ordinary = 'consumer-cache-ordinary';\n",
    'apps/docs/src/wrappers.ts': `${imports.join('\n')}
export const marker = 'consumer-cache-wrapper-imports';
export const wrappers = [${Array.from(
      { length: wrapperCount },
      (_, index) => `WrapperT${index}`
    ).join(', ')}];
`,
  });
}

function createLocalWrapperApp(usesWrapper: boolean): string {
  const root = createFixture({
    'package.json': JSON.stringify({
      name: '@fixture/app',
      dependencies: {
        '@fixture/local-wrapper': 'file:./vendor/local-wrapper',
      },
    }),
    'vendor/local-wrapper/package.json': JSON.stringify({
      name: '@fixture/local-wrapper',
      version: '1.0.0',
      exports: './src/index.ts',
      dependencies: { 'gt-vue': '*' },
    }),
    'vendor/local-wrapper/src/index.ts':
      "export { T as WrapperT } from 'gt-vue';\n",
    'src/App.ts': usesWrapper
      ? `
          import { WrapperT } from '@fixture/local-wrapper';
          export const component = WrapperT;
        `
      : "export const component = 'react-only';\n",
  });
  linkPackage(root, '', '@fixture/local-wrapper', 'vendor/local-wrapper');
  return root;
}

function countSourceParses(
  calls: Parameters<typeof parseScriptAst>[][],
  marker: string
): number {
  return calls.filter(([source]) => source.includes(marker)).length;
}

function countPathCalls(calls: unknown[][], expectedPath: string): number {
  return calls.filter(
    ([file]) =>
      typeof file === 'string' &&
      path.resolve(file) === path.resolve(expectedPath)
  ).length;
}

function createDirectWrapperFiles(name: string): Record<string, string> {
  const packageName = `@fixture/wrapper-${name}`;
  return {
    [`wrappers/${name}/package.json`]: JSON.stringify({
      name: packageName,
      version: '1.0.0',
      exports: './src/index.ts',
      dependencies: { 'gt-vue': '*' },
    }),
    [`wrappers/${name}/src/index.ts`]: `export { T as Wrapper${name.toUpperCase()} } from 'gt-vue';\n`,
  };
}

function queryDirectWrapper(
  root: string,
  name: string,
  cache: ReturnType<typeof createConsumerUsageCache>
): boolean {
  const packageName = `@fixture/wrapper-${name}`;
  const manifest = {
    name: packageName,
    version: '1.0.0',
    exports: './src/index.ts',
    dependencies: { 'gt-vue': '*' },
  };
  return packageConsumesPublicGT(
    root,
    packageName,
    path.join(root, 'wrappers', name),
    manifest,
    cache
  );
}

function createRuntimeConsumerImport(name: string): string {
  const component = `Wrapper${name.toUpperCase()}`;
  return `
    import { ${component} } from '@fixture/wrapper-${name}';
    export const component = ${component};
  `;
}

function createFixture(files: Record<string, string>): string {
  const root = createProjectFixture(files);
  temporaryDirectories.push(root);
  return root;
}

function linkPackage(
  root: string,
  consumerDirectory: string,
  bindingName: string,
  targetDirectory: string
): void {
  const destination = path.join(
    root,
    consumerDirectory,
    'node_modules',
    ...bindingName.split('/')
  );
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.symlinkSync(path.join(root, targetDirectory), destination, 'dir');
}
