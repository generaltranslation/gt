import * as fs from 'fs';
import * as path from 'path';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createInlineUpdates } from '../createInlineUpdates.js';
import { hashSource } from 'generaltranslation/id';
import type { ParsingConfigOptions } from '../../../types/parsing.js';

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
        'gt-next',
        false,
        undefined,
        parsingOptions
      );

      // Verify we got updates from files that have T components
      expect(result.updates).toBeDefined();

      // Skip test if no updates were generated (file may not have T components)
      if (result.updates.length === 0) {
        console.warn(
          `No updates generated for test ${testName} - file may not contain T components`
        );
        return;
      }

      // For each update that came from parsing T components, verify the hash
      for (const update of result.updates) {
        if (update.metadata.hash && update.source) {
          // Calculate expected hash from the expected.json
          const context = update.metadata.context;
          const expectedHash = hashSource({
            source: expected,
            ...(context && { context }),
            ...(update.metadata.id && { id: update.metadata.id }),
            dataFormat: update.dataFormat,
          });

          // Only log when there's a mismatch to see failing cases
          if (update.metadata.hash !== expectedHash) {
            console.log(`\n=== FAILING TEST: ${testName} ===`);
            console.log(
              'UPDATE SOURCE:',
              JSON.stringify(update.source, null, 2)
            );
            console.log(
              'EXPECTED STRUCTURE:',
              JSON.stringify(expected, null, 2)
            );
            console.log('Calculated hash:', update.metadata.hash);
            console.log('Expected hash:', expectedHash);
          }

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
        createTests(dirPath);
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
  createTests(
    '/Users/ernestmccarter/Documents/dev/gt/packages/compiler/src/transform/jsx-children/__tests__/seeds'
  );
});
