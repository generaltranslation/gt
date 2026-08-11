import * as fs from 'fs';
import * as path from 'path';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createInlineUpdates } from '../createInlineUpdates.js';
import { hashSource } from 'generaltranslation/id';
import type { ParsingConfigOptions } from '../../../types/parsing.js';
import { Libraries } from '../../../types/libraries.js';

// Mock parseStrings since we're not testing string parsing functionality
vi.mock('../jsx/utils/parseStringFunction.js', () => ({
  parseStrings: vi.fn(),
}));

// Mock logging to keep tests clean
vi.mock('../../../console/logging.js', () => ({
  logError: vi.fn(),
}));

// Mock process.cwd to control the working directory for tests
vi.mock('node:process', () => ({
  default: {
    cwd: vi.fn(() => '/test/cwd'),
  },
}));

// Mock matchFiles to return our test files
vi.mock('../../../fs/matchFiles.js', () => ({
  matchFiles: vi.fn(),
}));

// Expect these tests to have errors (they have {undefined} which is disallowed)
const TESTS_WITH_ERRORS = [
  'tests/seeds/complex-cases/many-edge-cases',
  'tests/seeds/complex-cases/more-extreme-edge-cases',
  'tests/seeds/complex-cases/whitespace',
  'tests/seeds/t-component/simple/expressions/static-special-identifiers',
];

function isLeafDir(pathname: string): boolean {
  const expectedPath = path.join(pathname, 'expected.json');
  const pagePath = path.join(pathname, 'page.tsx');
  return fs.existsSync(expectedPath) && fs.existsSync(pagePath);
}

async function createTest(dirPath: string) {
  const testName = path.basename(dirPath);
  try {
    // Read the expected JSX children structure
    const expectedPath = path.join(dirPath, 'expected.json');
    const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
    const runtimePath = path.join(dirPath, 'runtime.json');
    const runtime = fs.existsSync(runtimePath)
      ? JSON.parse(fs.readFileSync(runtimePath, 'utf8'))
      : undefined;

    // Read the page.tsx file path
    const pagePath = path.join(dirPath, 'page.tsx');

    // Create test
    test(testName, async () => {
      // Mock matchFiles to return our specific test file
      const { matchFiles } = await import('../../../fs/matchFiles.js');
      vi.mocked(matchFiles).mockReturnValue([pagePath]);

      // Set up parsing options
      const parsingOptions: ParsingConfigOptions = {
        conditionNames: ['browser', 'module', 'import', 'require', 'default'],
      };

      // Call createInlineUpdates with the test file
      const result = await createInlineUpdates(
        Libraries.GT_NEXT,
        false,
        undefined,
        parsingOptions
      );

      // Verify we got updates from files that have T components
      if (result.updates.length === 0) {
        expect(result.warnings.length || result.errors.length).toBeGreaterThan(
          0
        );
        return;
      }

      // no updates were generated (file may not have T components)
      expect(result.warnings).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.updates).not.toHaveLength(0);

      if (runtime) {
        expect(result.updates).toHaveLength(1);
        const [update] = result.updates;
        expect(normalizeSemanticWire(update.source)).toEqual(
          normalizeSemanticWire(expected)
        );
        expect(update.metadata.hash).toBe(runtime.hash);
        expect(selectRuntimeMetadata(update.metadata)).toEqual(
          runtime.metadata ?? {}
        );
      }

      // For each update that came from parsing T components, verify the hash
      for (const update of result.updates) {
        if (update.metadata.hash && update.source) {
          if (expected.static) {
            expect(expected.content).toHaveProperty(update.metadata.hash);
            continue;
          }

          // Calculate expected hash from the expected.json
          const context = update.metadata.context;
          const expectedHash = hashSource({
            source: update.source,
            ...(context && { context }),
            ...(update.metadata.maxChars != null && {
              maxChars: update.metadata.maxChars,
            }),
            ...(update.metadata.requiresReview === true && {
              requiresReview: true,
            }),
            dataFormat: update.dataFormat,
          });

          // Verify that the hash was calculated correctly
          expect(update.metadata.hash).toEqual(expectedHash);

          // Verify that we have a valid source structure from parseTranslationComponent
          expect(update.source).toBeDefined();
          // Source can be string (simple text), object (complex JSX), boolean, or number
          expect(['string', 'object', 'boolean', 'number']).toContain(
            typeof update.source
          );
        }
      }
    });
  } catch (error) {
    console.error(`Error creating test ${testName}:`, error);
    throw error;
  }
}

function selectRuntimeMetadata(metadata: {
  context?: string;
  id?: string;
  maxChars?: number;
  requiresReview?: boolean;
}): Record<string, unknown> {
  return {
    ...(metadata.context && { context: metadata.context }),
    ...(metadata.id && { id: metadata.id }),
    ...(metadata.maxChars != null && { maxChars: metadata.maxChars }),
    ...(metadata.requiresReview === true && { requiresReview: true }),
  };
}

function normalizeSemanticWire(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeSemanticWire);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 't' || !('i' in value) || 'k' in value)
      .map(([key, child]) => [key, normalizeSemanticWire(child)])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function createTests(seedsPath: string): void {
  // First check if current directory is a leaf directory
  if (isLeafDir(seedsPath)) {
    createTest(seedsPath);
    return;
  }

  const dirName = path.basename(seedsPath);
  try {
    describe(dirName, () => {
      // Not a leaf, so iterate over subdirectories
      const entries = fs.readdirSync(seedsPath, { withFileTypes: true });
      const directories = entries.filter((entry) => entry.isDirectory());

      // Recurse over subdirectories
      for (const dir of directories) {
        // Create describe block and recurse
        const dirPath = path.join(seedsPath, dir.name);
        if (TESTS_WITH_ERRORS.some((test) => dirPath.endsWith(test))) {
          continue;
        } else {
          createTests(dirPath);
        }
      }
    });
  } catch (error) {
    console.error(`Error reading directory ${seedsPath}:`, error);
    throw error;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createInlineUpdates', () => {
  // Test full suite to see our amazing progress
  createTests(path.join(__dirname, '../../../../../../tests/seeds'));
});
