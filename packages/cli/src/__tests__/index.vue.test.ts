import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Libraries } from '../types/libraries.js';

const mocks = vi.hoisted(() => ({
  additionalModules: ['i18next-icu'] as string[],
  constructors: {
    base: vi.fn(),
    next: vi.fn(),
    node: vi.fn(),
    python: vi.fn(),
    react: vi.fn(),
    mixedVue: vi.fn(),
    vue: vi.fn(),
  },
  detectedLibrary: 'gt-vue' as string,
  execute: vi.fn(),
  init: vi.fn(),
  planCalls: [] as Array<{ library: string; projectRoot: string }>,
}));

vi.mock('../fs/determineFramework/index.js', () => ({
  determineLibrary: () => ({
    library: mocks.detectedLibrary,
    additionalModules: mocks.additionalModules,
  }),
}));

vi.mock(
  '@generaltranslation/vue-extractor/integration',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@generaltranslation/vue-extractor/integration')
      >();
    return {
      ...actual,
      planVueExtraction: (options: {
        library: string;
        projectRoot: string;
      }) => {
        mocks.planCalls.push(options);
        return actual.planVueExtraction(options);
      },
    };
  }
);

vi.mock('../cli/base.js', () => ({
  BaseCLI: class {
    public constructor(...args: unknown[]) {
      mocks.constructors.base(...args);
    }

    public init(): void {
      mocks.init('base');
    }

    public execute(): void {
      mocks.execute('base');
    }
  },
}));

vi.mock('../cli/next.js', () => ({
  NextCLI: class {
    public constructor(...args: unknown[]) {
      mocks.constructors.next(...args);
    }

    public init(): void {
      mocks.init('next');
    }

    public execute(): void {
      mocks.execute('next');
    }
  },
}));

vi.mock('../cli/node.js', () => ({
  NodeCLI: class {
    public constructor(...args: unknown[]) {
      mocks.constructors.node(...args);
    }

    public init(): void {
      mocks.init('node');
    }

    public execute(): void {
      mocks.execute('node');
    }
  },
}));

vi.mock('../cli/python.js', () => ({
  PythonCLI: class {
    public constructor(...args: unknown[]) {
      mocks.constructors.python(...args);
    }

    public init(): void {
      mocks.init('python');
    }

    public execute(): void {
      mocks.execute('python');
    }
  },
}));

vi.mock('../cli/react.js', () => ({
  ReactCLI: class {
    public constructor(...args: unknown[]) {
      mocks.constructors.react(...args);
    }

    public init(): void {
      mocks.init('react');
    }

    public execute(): void {
      mocks.execute('react');
    }
  },
}));

vi.mock('../cli/vue.js', () => ({
  MixedVueCLI: class {
    public constructor(...args: unknown[]) {
      mocks.constructors.mixedVue(...args);
    }

    public init(): void {
      mocks.init('mixedVue');
    }

    public execute(): void {
      mocks.execute('mixedVue');
    }
  },
  VueCLI: class {
    public constructor(...args: unknown[]) {
      mocks.constructors.vue(...args);
    }

    public init(): void {
      mocks.init('vue');
    }

    public execute(): void {
      mocks.execute('vue');
    }
  },
}));

import { main } from '../index.js';

const initialCwd = process.cwd();
const temporaryDirectories: string[] = [];

function createProject(manifest: Record<string, unknown>): string {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-vue-route-'));
  temporaryDirectories.push(projectRoot);
  fs.writeFileSync(
    path.join(projectRoot, 'package.json'),
    JSON.stringify(manifest)
  );
  process.chdir(projectRoot);
  return fs.realpathSync(projectRoot);
}

function expectOnlyConstructor(
  selected: keyof typeof mocks.constructors
): void {
  for (const [name, constructor] of Object.entries(mocks.constructors)) {
    if (name === selected) {
      expect(constructor).toHaveBeenCalledOnce();
    } else {
      expect(constructor).not.toHaveBeenCalled();
    }
  }
  expect(mocks.init).toHaveBeenCalledOnce();
  expect(mocks.init).toHaveBeenCalledWith(selected);
  expect(mocks.execute).toHaveBeenCalledOnce();
  expect(mocks.execute).toHaveBeenCalledWith(selected);
}

describe('Vue CLI routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.additionalModules = ['i18next-icu'];
    mocks.detectedLibrary = Libraries.GT_VUE;
    mocks.planCalls.length = 0;
  });

  afterEach(() => {
    process.chdir(initialCwd);
    for (const directory of temporaryDirectories.splice(0)) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('routes an explicitly detected gt-vue project without replanning it', () => {
    const program = new Command();

    main(program);

    expectOnlyConstructor('vue');
    expect(mocks.constructors.vue).toHaveBeenCalledWith(program, [
      'i18next-icu',
    ]);
    expect(mocks.planCalls).toEqual([]);
  });

  it.each([
    [Libraries.GT_NEXT, 'next'],
    [Libraries.GT_REACT, 'react'],
    [Libraries.GT_REACT_NATIVE, 'react'],
    [Libraries.GT_TANSTACK_START, 'react'],
    [Libraries.GT_NODE, 'node'],
    [Libraries.GT_FLASK, 'python'],
    [Libraries.GT_FASTAPI, 'python'],
  ] as const)(
    'preserves the historical %s CLI branch without Vue planning',
    (library, expectedCli) => {
      mocks.detectedLibrary = library;
      const program = new Command();

      main(program);

      expectOnlyConstructor(expectedCli);
      expect(mocks.constructors[expectedCli]).toHaveBeenCalledWith(
        program,
        library,
        ['i18next-icu']
      );
      expect(mocks.planCalls).toEqual([]);
    }
  );

  it.each([
    [Libraries.GT_NEXT, 'next'],
    [Libraries.GT_REACT, 'react'],
    [Libraries.GT_REACT_NATIVE, 'react'],
    [Libraries.GT_TANSTACK_START, 'react'],
    [Libraries.GT_NODE, 'node'],
    [Libraries.GT_FLASK, 'python'],
    [Libraries.GT_FASTAPI, 'python'],
  ] as const)(
    'keeps a direct gt-vue dependency on the historical %s CLI branch',
    (library, expectedCli) => {
      mocks.detectedLibrary = library;
      createProject({
        dependencies: {
          [library]: '*',
          'gt-vue': '*',
        },
      });
      const program = new Command();

      main(program);

      expectOnlyConstructor(expectedCli);
      expect(mocks.constructors[expectedCli]).toHaveBeenCalledWith(
        program,
        library,
        ['i18next-icu']
      );
      expect(mocks.planCalls).toEqual([]);
    }
  );

  it.each([
    ['dependencies', 'i18next'],
    ['dependencies', 'next-intl'],
    ['devDependencies', 'i18next'],
    ['devDependencies', 'next-intl'],
  ] as const)(
    'adds Vue commands to a %s gt-vue root while preserving %s detection',
    (vueField, fileLibrary) => {
      mocks.detectedLibrary = fileLibrary;
      const projectRoot = createProject(
        vueField === 'dependencies'
          ? { dependencies: { [fileLibrary]: '*', 'gt-vue': '*' } }
          : {
              dependencies: { [fileLibrary]: '*' },
              devDependencies: { 'gt-vue': '*' },
            }
      );
      const program = new Command();

      main(program);

      expectOnlyConstructor('mixedVue');
      expect(mocks.constructors.mixedVue).toHaveBeenCalledWith(program, [
        'i18next-icu',
      ]);
      expect(mocks.planCalls).toEqual([{ library: fileLibrary, projectRoot }]);
    }
  );

  it.each(
    (['i18next', 'next-intl'] as const).flatMap((fileLibrary) => [
      [fileLibrary, 'without gt-vue', { dependencies: { [fileLibrary]: '*' } }],
      [
        fileLibrary,
        'with only a gt-vue peer',
        {
          dependencies: { [fileLibrary]: '*' },
          peerDependencies: { 'gt-vue': '*' },
        },
      ],
      [
        fileLibrary,
        'with only an optional gt-vue dependency',
        {
          dependencies: { [fileLibrary]: '*' },
          optionalDependencies: { 'gt-vue': '*' },
        },
      ],
      [
        fileLibrary,
        'with a dependency overridden by optional gt-vue',
        {
          dependencies: { [fileLibrary]: '*', 'gt-vue': '*' },
          optionalDependencies: { 'gt-vue': '*' },
        },
      ],
      [
        fileLibrary,
        'with a devDependency overridden by optional gt-vue',
        {
          dependencies: { [fileLibrary]: '*' },
          devDependencies: { 'gt-vue': '*' },
          optionalDependencies: { 'gt-vue': '*' },
        },
      ],
    ])
  )(
    'keeps the %s project on BaseCLI %s',
    (fileLibrary, _scenario, manifest) => {
      mocks.detectedLibrary = fileLibrary;
      const projectRoot = createProject(manifest);
      const program = new Command();

      main(program);

      expectOnlyConstructor('base');
      expect(mocks.constructors.base).toHaveBeenCalledWith(
        program,
        fileLibrary,
        ['i18next-icu']
      );
      expect(mocks.planCalls).toEqual([{ library: fileLibrary, projectRoot }]);
    }
  );
});
