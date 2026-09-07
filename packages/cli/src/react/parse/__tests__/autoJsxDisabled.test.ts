import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import generateModule from '@babel/generator';
import { createInlineUpdates } from '../createInlineUpdates.js';
import { createUpdates } from '../../../translation/parse.js';
import { getValidateJson } from '../../../translation/validate.js';
import { GT_LIBRARIES_UPSTREAM, Libraries } from '../../../types/libraries.js';
import type {
  GTParsingFlags,
  ParsingConfigOptions,
} from '../../../types/parsing.js';
import { getPathsAndAliases } from '../../jsx/utils/getPathsAndAliases.js';
import { parseTranslationComponent } from '../../jsx/utils/jsxParsing/parseJsx.js';
import * as insertion from '../../jsx/utils/jsxParsing/autoInsertion.js';
import * as projection from '../../jsx/utils/jsxParsing/autoInsertion/extractionView.js';
import * as projectRuntime from '../../jsx/utils/jsxParsing/autoInsertion/projectRuntime.js';

const generate = generateModule.default || generateModule;
const repository = fileURLToPath(
  new URL('../../../../../../', import.meta.url)
);
const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), 'gt-cli-auto-jsx-disabled-')
);
type Result = Awaited<ReturnType<typeof createInlineUpdates>>;
const seeds: {
  revision: string;
  cases: { file: string; sourceSha256: string; expected: Result }[];
} = JSON.parse(
  fs.readFileSync(
    new URL('./fixtures/autoJsxDisabledSeeds.json', import.meta.url),
    'utf8'
  )
);
const edges: {
  revision: string;
  cases: {
    name: string;
    input: string;
    sourceSha256: string;
    expected: Result;
  }[];
} = JSON.parse(
  fs.readFileSync(
    new URL('./fixtures/autoJsxDisabledEdges.json', import.meta.url),
    'utf8'
  )
);
const parsingOptions: ParsingConfigOptions = {
  conditionNames: ['browser', 'module', 'import', 'require', 'default'],
};
const beforeFeature = '36d34236db34458b6301e06be1eed62f3e3e608b';

function write(relative: string, source: string): string {
  const file = path.join(directory, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, source);
  return fs.realpathSync(file);
}

// Baselines came from the exact pre-feature CLI. Make only repository/fixture
// locations portable; translation trees, hashes and diagnostic text stay exact.
function portable(result: Result, fixture?: string): Result {
  const normalized = structuredClone(result);
  for (const update of normalized.updates)
    if (update.metadata.filePaths)
      update.metadata.filePaths = update.metadata.filePaths.map((file) => {
        const absolute = path.resolve(file);
        if (fixture && absolute === fixture) return '<fixture>';
        const fromRepository = path.relative(repository, absolute);
        if (
          !fixture ||
          (fromRepository !== '..' &&
            !fromRepository.startsWith(`..${path.sep}`))
        )
          return fromRepository.replaceAll(path.sep, '/');
        return path
          .relative(path.dirname(fixture), absolute)
          .replaceAll(path.sep, '/');
      });
  for (const key of ['errors', 'warnings'] as const)
    normalized[key] = normalized[key].map((text) =>
      fixture
        ? text.replaceAll(fixture, '<fixture>')
        : text.replaceAll(repository.replace(/\/$/, ''), '<repository>')
    );
  return normalized;
}

function disabled(flag: false | undefined): GTParsingFlags {
  return flag === undefined ? {} : { enableAutoJsxInjection: false };
}

async function expectConditionalExports(
  flag: boolean | undefined,
  kind: 'prototype' | 'non-enumerable'
) {
  const project = `${String(flag)}/${kind}`;
  write(
    `${project}/node_modules/@disabled/copy/package.json`,
    JSON.stringify({
      name: '@disabled/copy',
      version: '1.0.0',
      exports: {
        '.': { 'react-server': './server.tsx', default: './client.tsx' },
      },
    })
  );
  write(
    `${project}/node_modules/@disabled/copy/server.tsx`,
    `export function copy() { return 'Server-only wording'; }`
  );
  write(
    `${project}/node_modules/@disabled/copy/client.tsx`,
    `export function copy() { throw new Error('The server condition was lost'); }`
  );
  const input = `import {T,Derive} from 'gt-next'; import {copy} from '@disabled/copy'; export const Page=()=> <T>Manual <Derive>{copy()}</Derive></T>;`;
  const file = write(`${project}/entry.tsx`, input);
  const validationFile = write(`${project}/validation.tsx`, input);
  class ProjectOptions {
    #conditions = ['react-server', 'import', 'default'];
    get conditionNames() {
      return this.#conditions;
    }
  }
  const options: ParsingConfigOptions =
    kind === 'prototype'
      ? new ProjectOptions()
      : (Object.defineProperty({}, 'conditionNames', {
          value: ['react-server', 'import', 'default'],
        }) as ParsingConfigOptions);
  const flags = flag ? { enableAutoJsxInjection: true } : disabled(flag);
  const result = await createUpdates(
    {} as Parameters<typeof createUpdates>[0],
    [file],
    undefined,
    Libraries.GT_NEXT,
    false,
    flags,
    options
  );
  expect(result.errors).toEqual([]);
  expect(result.warnings).toEqual([]);
  expect(result.updates).toHaveLength(1);
  expect(result.updates[0].source).toEqual([
    'Manual ',
    { t: 'Derive', i: 1, c: 'Server-only wording' },
  ]);
  expect(result.updates[0].metadata.hash).toBe('fb68d73f286496b9');
  const settings = {
    files: { gtJson: { parsingFlags: flags } },
    parsingOptions: options,
  } as Parameters<typeof getValidateJson>[0];
  // Keep a fresh import-resolution key so the preceding extraction cannot
  // hide lost conditions in the separate programmatic validation path.
  expect(await getValidateJson(settings, 'gt-next', [validationFile])).toEqual(
    {}
  );
}

beforeEach(() => {
  vi.spyOn(insertion, 'ensureTAndVarImported');
  vi.spyOn(insertion, 'autoInsertJsxComponents');
  vi.spyOn(projection, 'autoJsxExtractionProgram');
  vi.spyOn(projectRuntime, 'resolveAutoJsxRuntime');
});

afterEach(() => vi.restoreAllMocks());

describe.each([undefined, false] as const)(
  'pre-feature CLI behavior when auto JSX is %s',
  (flag) => {
    it('pins the baseline revision and verifies coverage', () => {
      expect(seeds.revision).toBe(beforeFeature);
      expect(edges.revision).toBe(beforeFeature);
      expect(seeds.cases).toHaveLength(84);
      expect(edges.cases).toHaveLength(53);
    });

    it.each(seeds.cases)(
      'matches the complete old result for $file',
      async (example) => {
        const file = path.join(repository, example.file);
        expect(
          createHash('sha256').update(fs.readFileSync(file)).digest('hex')
        ).toBe(example.sourceSha256);
        const result = await createInlineUpdates(
          Libraries.GT_NEXT,
          false,
          [file],
          disabled(flag),
          parsingOptions
        );
        expect(portable(result)).toEqual(example.expected);
        expect(insertion.ensureTAndVarImported).not.toHaveBeenCalled();
        expect(insertion.autoInsertJsxComponents).not.toHaveBeenCalled();
        expect(projection.autoJsxExtractionProgram).not.toHaveBeenCalled();
        expect(projectRuntime.resolveAutoJsxRuntime).not.toHaveBeenCalled();
      }
    );

    it.each(edges.cases)(
      'preserves manual extraction, hashing and diagnostics: $name',
      async (example) => {
        expect(createHash('sha256').update(example.input).digest('hex')).toBe(
          example.sourceSha256
        );
        const file = write(
          `${String(flag)}/${example.name}.tsx`,
          example.input
        );
        const result = await createInlineUpdates(
          Libraries.GT_NEXT,
          false,
          [file],
          disabled(flag),
          parsingOptions
        );
        expect(portable(result, file)).toEqual(example.expected);
        expect(insertion.ensureTAndVarImported).not.toHaveBeenCalled();
        expect(insertion.autoInsertJsxComponents).not.toHaveBeenCalled();
        expect(projection.autoJsxExtractionProgram).not.toHaveBeenCalled();
        expect(projectRuntime.resolveAutoJsxRuntime).not.toHaveBeenCalled();

        const ast = parse(example.input, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx'],
        });
        const original = generate(ast, { comments: true }).code;
        const pkgs = GT_LIBRARIES_UPSTREAM[Libraries.GT_NEXT];
        const { translationComponentPaths, importAliases } = getPathsAndAliases(
          ast,
          pkgs
        );
        for (const { localName, path: binding } of translationComponentPaths)
          parseTranslationComponent({
            originalName: localName,
            localName,
            path: binding,
            updates: [],
            config: {
              importAliases,
              parsingOptions,
              pkgs,
              file,
              includeSourceCodeContext: false,
              ...(flag === false && { enableAutoJsxInjection: false }),
            },
            output: {
              errors: [],
              warnings: new Set(),
              unwrappedExpressions: [],
            },
          });
        expect(generate(ast, { comments: true }).code).toBe(original);
        expect(projection.autoJsxExtractionProgram).not.toHaveBeenCalled();
      }
    );

    it.each(['prototype', 'non-enumerable'] as const)(
      'keeps %s resolution options for translation and validation',
      async (kind) => expectConditionalExports(flag, kind)
    );

    it('does not read JSX runtime configuration or lazy option accessors', async () => {
      const project = `${String(flag)}/lazy`;
      const file = write(
        `${project}/entry.tsx`,
        `import {T} from 'gt-next'; export const Page=()=> <T>Manual config independence</T>;`
      );
      write(`${project}/tsconfig.json`, '{ invalid project config');
      const configRead = vi.fn(() => {
        throw new Error('Disabled JSX config must not be read');
      });
      const options = {
        conditionNames: ['import'],
        get jsxProjectConfigPath(): string {
          return configRead();
        },
      };
      const flags = disabled(flag);
      const result = await createUpdates(
        {} as Parameters<typeof createUpdates>[0],
        [file],
        undefined,
        Libraries.GT_NEXT,
        false,
        flags,
        options
      );
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.updates).toHaveLength(1);
      expect(
        await getValidateJson(
          {
            files: { gtJson: { parsingFlags: flags } },
            parsingOptions: options,
          } as Parameters<typeof getValidateJson>[0],
          'gt-next',
          [file]
        )
      ).toEqual({});
      expect(configRead).not.toHaveBeenCalled();
      expect(projectRuntime.resolveAutoJsxRuntime).not.toHaveBeenCalled();
    });

    it('keeps enabled and disabled cross-file Derive caches independent', async () => {
      const project = `${String(flag)}/cache`;
      write(
        `${project}/child.tsx`,
        `const who='Ada'; export function shared(){return <span>Hello {who}</span>;}`
      );
      const manual = write(
        `${project}/manual.tsx`,
        `import {T,Derive} from 'gt-next'; import {shared} from './child'; export const Page=()=> <T>Before <Derive>{shared()}</Derive> after</T>;`
      );
      const automatic = write(
        `${project}/auto.tsx`,
        `import {Derive} from 'gt-next'; import {shared} from './child'; export const Page=()=> <main>Before <Derive>{shared()}</Derive> after</main>;`
      );
      const enabled = await createInlineUpdates(
        Libraries.GT_NEXT,
        false,
        [automatic],
        { enableAutoJsxInjection: true },
        parsingOptions
      );
      expect(enabled.errors).toEqual([]);
      expect(enabled.updates[0].metadata.hash).toBe('17da66a7acc99dea');
      expect(insertion.autoInsertJsxComponents).toHaveBeenCalled();
      vi.clearAllMocks();
      const original = await createInlineUpdates(
        Libraries.GT_NEXT,
        false,
        [manual],
        disabled(flag),
        parsingOptions
      );
      expect(original.errors).toEqual([]);
      expect(original.warnings).toEqual([]);
      // Both values were independently captured from the pre-feature CLI with
      // the flag absent, before running its enabled transform.
      expect(original.updates[0].metadata.hash).toBe('45237fef541f57d2');
      expect(original.updates[0].metadata.staticId).toBe('fd02d709c0ca33ef');
      expect(insertion.ensureTAndVarImported).not.toHaveBeenCalled();
      expect(insertion.autoInsertJsxComponents).not.toHaveBeenCalled();
      expect(projection.autoJsxExtractionProgram).not.toHaveBeenCalled();
      expect(projectRuntime.resolveAutoJsxRuntime).not.toHaveBeenCalled();
      const enabledAgain = await createInlineUpdates(
        Libraries.GT_NEXT,
        false,
        [automatic],
        { enableAutoJsxInjection: true },
        parsingOptions
      );
      expect(enabledAgain).toEqual(enabled);
    });
  }
);

describe('enabled auto JSX project options', () => {
  it.each(['prototype', 'non-enumerable'] as const)(
    'keeps %s resolution options for manual Derive',
    async (kind) => expectConditionalExports(true, kind)
  );

  it('does not add eager reads of resolution options', async () => {
    const file = write(
      'true/lazy/entry.tsx',
      `import {T} from 'gt-next'; export const Page=()=> <T>Manual text</T>;`
    );
    const conditionRead = vi.fn(() => ['import']);
    const result = await createUpdates(
      {} as Parameters<typeof createUpdates>[0],
      [file],
      undefined,
      Libraries.GT_NEXT,
      false,
      { enableAutoJsxInjection: true },
      {
        get conditionNames(): string[] {
          return conditionRead();
        },
      }
    );
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.updates[0].source).toEqual('Manual text');
    // The existing project extractor reads this once. Preparing an auto-JSX
    // override must not read it a second time when no Derive needs resolution.
    expect(conditionRead).toHaveBeenCalledTimes(1);
  });
});
