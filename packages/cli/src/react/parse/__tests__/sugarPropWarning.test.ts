/**
 * The CLI scan emits ONE consolidated warning (never an error) listing every
 * occurrence of deprecated $-prefixed sugar props on <T> components as
 * file:line:column, covering both the string-literal ($context="...") and
 * expression-container ($context={"..."}) forms.
 */
import * as fs from 'fs';
import * as path from 'path';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createInlineUpdates } from '../createInlineUpdates.js';
import type { ParsingConfigOptions } from '../../../types/parsing.js';
import { Libraries } from '../../../types/libraries.js';

vi.mock('../jsx/utils/parseStringFunction.js', () => ({
  parseStrings: vi.fn(),
}));
vi.mock('../../../console/logging.js', () => ({
  logError: vi.fn(),
}));
vi.mock('../../../fs/matchFiles.js', () => ({
  matchFiles: vi.fn(),
}));

const FIXTURES = path.join(__dirname, '__fixtures__/context-props');

const parsingOptions: ParsingConfigOptions = {
  conditionNames: ['browser', 'module', 'import', 'require', 'default'],
};

async function scan(files: string[]) {
  const { matchFiles } = await import('../../../fs/matchFiles.js');
  vi.mocked(matchFiles).mockReturnValue(
    files.map((f) => path.join(FIXTURES, f))
  );
  return createInlineUpdates(
    Libraries.GT_REACT,
    false,
    undefined,
    {},
    parsingOptions
  );
}

/**
 * Expected file:line for each occurrence of an attribute in a fixture.
 * Bare boolean attributes (`<T $requiresReview>`) carry no `=`, so they are
 * matched on the closing bracket instead.
 */
function expectedLocations(file: string, attr: string, bare = false): string[] {
  const fullPath = path.join(FIXTURES, file);
  const lines = fs.readFileSync(fullPath, 'utf8').split('\n');
  const found: string[] = [];
  lines.forEach((line, index) => {
    const column = line.indexOf(bare ? `${attr}>` : `${attr}=`);
    if (column !== -1) {
      found.push(`${fullPath}:${index + 1}:${column} (${attr})`);
    }
  });
  return found;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('deprecated $-prefixed <T> prop warning', () => {
  test('one consolidated warning lists all occurrences across files and forms', async () => {
    const result = await scan(['page.tsx', 'expression-container.tsx']);
    expect(result.errors).toHaveLength(0);

    const deprecationWarnings = result.warnings.filter((w) =>
      w.includes('deprecated')
    );
    // Fires exactly once, no matter how many occurrences
    expect(deprecationWarnings).toHaveLength(1);
    const warning = deprecationWarnings[0];

    // String-literal forms: two $context and one $id in page.tsx
    // Expression-container forms: $context={...}, $maxChars={...}, and
    // $requiresReview in both the bare and ={true} forms
    const expected = [
      ...expectedLocations('page.tsx', '$context'),
      ...expectedLocations('page.tsx', '$id'),
      ...expectedLocations('expression-container.tsx', '$context'),
      ...expectedLocations('expression-container.tsx', '$maxChars'),
      ...expectedLocations('expression-container.tsx', '$requiresReview'),
      ...expectedLocations('expression-container.tsx', '$requiresReview', true),
    ];
    expect(expected.length).toBe(7);
    for (const location of expected) {
      expect(warning).toContain(location);
    }

    // Advises the unprefixed forms and the removal horizon
    expect(warning).toContain('unprefixed');
    expect(warning).toContain('next major version');
  });

  test('no deprecation warning when only unprefixed props are used', async () => {
    const result = await scan(['unprefixed.tsx']);
    expect(result.errors).toHaveLength(0);
    expect(
      result.warnings.filter((w) => w.includes('deprecated'))
    ).toHaveLength(0);
  });
});
