import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterAll, describe, test, expect, vi } from 'vitest';
import { extractFromSvelteProject } from '@generaltranslation/svelte-extractor/integration';
import { createInlineUpdates } from '../createInlineUpdates.js';
import { matchFiles } from '../../../fs/matchFiles.js';
import { hashSource } from 'generaltranslation/id';
import type {
  ResolvedGTParsingFlags,
  ParsingConfigOptions,
} from '../../../types/parsing.js';
import { Libraries, type GTLibrary } from '../../../types/libraries.js';

vi.mock('../../../fs/matchFiles.js', () => ({ matchFiles: vi.fn() }));

const parsingOptions: ParsingConfigOptions = {
  conditionNames: ['browser', 'module', 'import', 'require', 'default'],
};

/** Runs createInlineUpdates over the given files. */
function scan(pkg: GTLibrary, files: string[]) {
  vi.mocked(matchFiles).mockReturnValue(files);
  return createInlineUpdates(
    pkg,
    false,
    undefined,
    {} as ResolvedGTParsingFlags,
    parsingOptions
  );
}

// The seeds are shared with the compiler, vue and vue-extractor packages
describe('createInlineUpdates on tests/seeds', () => {
  const SEEDS = path.join(__dirname, '../../../../../../tests/seeds');
  // These seeds have errors (they contain {undefined}, which is disallowed)
  const SEEDS_WITH_ERRORS = [
    'complex-cases/many-edge-cases',
    'complex-cases/more-extreme-edge-cases',
    'complex-cases/whitespace',
    't-component/simple/expressions/static-special-identifiers',
  ];

  /** Directories below `dir` that hold a page.tsx and its expected.json. */
  function seedDirs(dir: string): string[] {
    if (
      fs.existsSync(path.join(dir, 'expected.json')) &&
      fs.existsSync(path.join(dir, 'page.tsx'))
    ) {
      return [path.relative(SEEDS, dir)];
    }
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) => seedDirs(path.join(dir, entry.name)));
  }

  const seeds = seedDirs(SEEDS).filter(
    (seed) => !SEEDS_WITH_ERRORS.includes(seed.split(path.sep).join('/'))
  );

  test.each(seeds)('%s', async (seed) => {
    const expected = JSON.parse(
      fs.readFileSync(path.join(SEEDS, seed, 'expected.json'), 'utf8')
    );

    const result = await scan(Libraries.GT_NEXT, [
      path.join(SEEDS, seed, 'page.tsx'),
    ]);

    // A seed without updates must explain why
    if (result.updates.length === 0) {
      expect(result.warnings.length || result.errors.length).toBeGreaterThan(0);
      return;
    }
    // Some seeds keep <Select>/<Plural> children to cover their extraction.
    expect(
      result.warnings.filter(
        (warning) => !warning.includes('does not render its children')
      )
    ).toEqual([]);
    expect(result.errors).toEqual([]);

    for (const update of result.updates) {
      if (!update.metadata.hash || !update.source) continue;
      if (expected.static) {
        expect(expected.content).toHaveProperty(update.metadata.hash);
        continue;
      }
      const { context, maxChars } = update.metadata;
      expect(update.metadata.hash).toEqual(
        hashSource({
          source: update.source,
          ...(context && { context }),
          ...(maxChars && { maxChars }),
          dataFormat: update.dataFormat,
        })
      );
    }
  });
});

describe('<T> props', () => {
  const FIXTURES = path.join(__dirname, '__fixtures__/context-props');
  const scanFixtures = (...files: string[]) =>
    scan(
      Libraries.GT_REACT,
      files.map((file) => path.join(FIXTURES, file))
    );

  /**
   * <T> props written as plain string literals (context="...", id="...") must
   * reach metadata so hashing and registration see them, giving the same
   * context-ful hash the runtime and the compiler compute.
   */
  describe('string-literal props', () => {
    test('reach the metadata and the hash', async () => {
      const result = await scanFixtures('page.tsx');
      const updatesWith = (text: string) =>
        result.updates.filter((u) => JSON.stringify(u.source).includes(text));

      expect(result.errors).toEqual([]);

      // Two different contexts on identical children must NOT dedupe into one
      const bookUpdates = updatesWith('"Book"');
      expect(bookUpdates.map((u) => u.metadata.context).sort()).toEqual([
        'A call-to-action that reserves a hotel stay',
        'A noun meaning a printed publication',
      ]);
      // Hashes must be the context-ful hashes the runtime computes at lookup
      for (const update of bookUpdates) {
        expect(update.metadata.hash).toEqual(
          hashSource({
            source: update.source,
            context: update.metadata.context as string,
            dataFormat: update.dataFormat,
          })
        );
      }

      // $context="..." is not read as the context
      const [prefixed] = updatesWith('"Cover"');
      expect(prefixed.metadata.context).toBeUndefined();
      expect(prefixed.metadata.hash).toEqual(
        hashSource({ source: prefixed.source, dataFormat: prefixed.dataFormat })
      );

      const [withId] = updatesWith('"Spine"');
      expect(withId.metadata.id).toEqual('book-id');
    });

    test('maxChars="10" (string-typed) is rejected like maxChars={"10"}', async () => {
      const result = await scanFixtures('max-chars-string.tsx');

      expect(
        result.errors.some((e) => e.toLowerCase().includes('maxchars'))
      ).toBe(true);
    });
  });
});

describe('gt-svelte string calls in JavaScript and TypeScript modules', () => {
  const CALLS = `import { msg, useGT } from 'gt-svelte';
export const save = msg('Save');
export function label() {
  const t = useGT();
  return t('Hello, {name}!', { name: 'Ada' });
}
export const close = msg('Close', { $context: 'button', $id: 'close' });
`;
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-svelte-cli-'));
  const moduleFile = path.join(projectDir, 'messages.ts');
  fs.writeFileSync(moduleFile, CALLS);
  fs.writeFileSync(
    path.join(projectDir, 'Messages.svelte'),
    `<script module lang="ts">${CALLS}</script>`
  );
  afterAll(() => fs.rmSync(projectDir, { recursive: true, force: true }));

  const filePaths = [path.relative(process.cwd(), moduleFile)];

  test('are extracted in a gt-svelte project', async () => {
    const result = await scan(Libraries.GT_SVELTE, [moduleFile]);

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.updates).toEqual([
      {
        dataFormat: 'ICU',
        source: 'Save',
        metadata: {
          hash: hashSource({ source: 'Save', dataFormat: 'ICU' }),
          filePaths,
        },
      },
      {
        dataFormat: 'ICU',
        source: 'Hello, {name}!',
        metadata: {
          hash: hashSource({ source: 'Hello, {name}!', dataFormat: 'ICU' }),
          filePaths,
        },
      },
      {
        dataFormat: 'ICU',
        source: 'Close',
        metadata: {
          context: 'button',
          id: 'close',
          hash: hashSource({
            source: 'Close',
            context: 'button',
            dataFormat: 'ICU',
          }),
          filePaths,
        },
      },
    ]);
  });

  test('match the same calls in a .svelte file', async () => {
    const fromModule = await scan(Libraries.GT_SVELTE, [moduleFile]);
    const fromComponent = await extractFromSvelteProject(projectDir, [
      'Messages.svelte',
    ]);

    expect(fromComponent.updates).toHaveLength(3);
    expect(
      fromModule.updates.map((update) => ({
        ...update,
        metadata: { ...update.metadata, filePaths: ['Messages.svelte'] },
      }))
    ).toEqual(fromComponent.updates);
  });

  test('are not extracted in a React project', async () => {
    const reactFile = path.join(projectDir, 'react.ts');
    fs.writeFileSync(reactFile, CALLS.replace('gt-svelte', 'gt-react'));

    expect((await scan(Libraries.GT_REACT, [moduleFile])).updates).toEqual([]);
    // msg('Save') is a message tree there; the calls with options are not.
    expect(
      (await scan(Libraries.GT_REACT, [reactFile])).updates.map(
        ({ dataFormat, source }) => ({ dataFormat, source })
      )
    ).toEqual([{ dataFormat: 'MESSAGE_TREE', source: 'Save' }]);
  });
});
