import * as fs from 'fs';
import * as path from 'path';
import { constructJsxChildren } from '../index';
import { TransformState } from '../../../state/types';
import { StringCollector } from '../../../state/StringCollector';
import { Logger } from '../../../state/Logger';
import { ErrorTracker } from '../../../state/ErrorTracker';
import { stripTField } from './stripTField';
import { hashSource } from 'generaltranslation/id';
import { JsxChildren } from 'generaltranslation/types';
import { ScopeTracker } from '../../../state/ScopeTracker';
import { PluginSettings } from '../../../config';

// TODO: ignore error if its just keys out of order

function isLeafDir(pathname: string): boolean {
  const statePath = path.join(pathname, 'state.json');
  const expectedPath = path.join(pathname, 'expected.json');
  return fs.existsSync(statePath) && fs.existsSync(expectedPath);
}

function createTest(dirPath: string) {
  const testName = path.basename(dirPath);
  try {
    // Collect seed data
    const statePath = path.join(dirPath, 'state.json');
    const stateSeed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const expectedPath = path.join(dirPath, 'expected.json');
    const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));

    // Create test
    test(testName, () => {
      // Set up state
      const stringCollector = new StringCollector();
      const logger = new Logger('silent');
      const errorTracker = new ErrorTracker();
      const scopeTracker = new ScopeTracker();
      const settings: PluginSettings = {
        logLevel: 'silent',
        compileTimeHash: false,
        disableBuildChecks: false,
      };

      const state: TransformState = {
        settings,
        stringCollector,
        scopeTracker,
        logger,
        errorTracker,
        statistics: {
          jsxElementCount: 0,
          dynamicContentViolations: 0,
        },
      };

      stringCollector.unserialize(stateSeed.state.stringCollector);
      scopeTracker.unserialize(stateSeed.state.scopeTracker);

      // Construct JsxChildren
      const result = constructJsxChildren(stateSeed.children, state);

      // Assert expected output
      if (!result.value) {
        expect(result.value).toEqual(expected);
      } else {
        // expect children structures to be equal
        expect(stripTField(result.value as JsxChildren)).toEqual(
          stripTField(expected as JsxChildren)
        );

        // Check hash
        const calculatedHash = hashSource({
          source: result.value,
          dataFormat: 'JSX',
        });
        const expectedHash = hashSource({
          source: expected,
          dataFormat: 'JSX',
        });

        expect(calculatedHash).toEqual(expectedHash);
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

describe('constructJsxChildren', () => {
  createTests(path.join(__dirname, 'seeds'));
});
