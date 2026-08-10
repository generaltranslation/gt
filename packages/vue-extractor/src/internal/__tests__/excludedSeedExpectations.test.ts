import fs from 'node:fs';
import path from 'node:path';
import type { JsxChildren } from '@generaltranslation/format/types';
import { hashSource } from 'generaltranslation/id';
import { describe, expect, it } from 'vitest';
import { extractFromVueSource } from './testVueCompiler.js';

type ParityMode = 'excluded' | 'semantic-wire-exact';

type ParitySeed = {
  id: string;
  mode: ParityMode;
  reason: string;
};

type SuccessfulSeedExpectation = {
  /** Stable Vue-specific hash for a deliberately nonportable fixture. */
  hash: string;
  /** Exact source produced from the nonportable Vue fixture. */
  source: JsxChildren;
};

type RejectedSeedExpectation = {
  /** Exact number of diagnostics emitted for the rejected fixture. */
  errorCount: number;
  /** Stable diagnostic fragments expected from the rejected fixture. */
  errors: string[];
};

type SeedExpectation = RejectedSeedExpectation | SuccessfulSeedExpectation;

const repositoryRoot = path.resolve(__dirname, '../../../../..');
const seedRoot = path.join(repositoryRoot, 'tests/seeds');
const manifestPath = path.join(
  repositoryRoot,
  'test-fixtures/react-vue-runtime-parity.json'
);
const manifest = readManifest(manifestPath);
const excludedSeeds = manifest.filter(({ mode }) => mode === 'excluded');
const portableSeeds = manifest.filter(
  ({ mode }) => mode === 'semantic-wire-exact'
);

describe('excluded Vue seed expectations', () => {
  it('stores independent Vue truth only for explicitly nonportable seeds', () => {
    const expectationIds = collectExpectationIds(seedRoot);
    const excludedIds = excludedSeeds.map(({ id }) => id);

    expect(expectationIds).toEqual(excludedIds);
    for (const seed of portableSeeds) {
      expect(fs.existsSync(expectationPath(seed))).toBe(false);
    }
  });

  for (const seed of excludedSeeds) {
    it(`${seed.id}: ${seed.reason}`, async () => {
      const fixtureDirectory = seedDirectory(seed);
      const fixturePath = path.join(fixtureDirectory, 'page.vue');
      const expectation = readJson(expectationPath(seed)) as SeedExpectation;
      const result = await extractFromVueSource(
        fs.readFileSync(fixturePath, 'utf8'),
        fixturePath,
        { projectRoot: seedRoot }
      );

      expect(result.warnings).toEqual([]);
      if (isRejectedExpectation(expectation)) {
        expect(result.results).toEqual([]);
        expect(result.errors).toHaveLength(expectation.errorCount);
        for (const expectedError of expectation.errors) {
          expect(result.errors.join('\n')).toContain(expectedError);
        }
        return;
      }

      expect(result.errors).toEqual([]);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].dataFormat).toBe('JSX');
      expect(result.results[0].source).toStrictEqual(expectation.source);
      expect(
        hashSource({
          context: result.results[0].metadata.context,
          dataFormat: result.results[0].dataFormat,
          source: result.results[0].source,
        })
      ).toBe(expectation.hash);
    });
  }
});

/** Returns every excluded expectation ID in deterministic manifest order. */
function collectExpectationIds(directory: string): string[] {
  const ids: string[] = [];

  function visit(current: string): void {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const child = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(child);
      } else if (entry.name === 'expected.vue.json') {
        ids.push(toPosixPath(path.relative(seedRoot, path.dirname(child))));
      }
    }
  }

  visit(directory);
  return ids.sort();
}

/** Reads only the manifest fields owned by this Vue-specific test layer. */
function readManifest(filename: string): ParitySeed[] {
  const value = readJson(filename);
  invariant(Array.isArray(value), 'Runtime parity manifest must be an array');

  return value.map((entry, index) => {
    invariant(isRecord(entry), `Manifest entry ${index} must be an object`);
    invariant(typeof entry.id === 'string', `Manifest entry ${index} needs id`);
    invariant(
      entry.mode === 'excluded' || entry.mode === 'semantic-wire-exact',
      `Manifest entry ${index} has an invalid parity mode`
    );
    invariant(
      typeof entry.reason === 'string',
      `Manifest entry ${index} needs reason`
    );
    return {
      id: entry.id,
      mode: entry.mode,
      reason: entry.reason,
    };
  });
}

/** Returns the colocated Vue-only expectation path for one seed. */
function expectationPath(seed: ParitySeed): string {
  return path.join(seedDirectory(seed), 'expected.vue.json');
}

/** Returns the fixture directory for one manifest seed. */
function seedDirectory({ id }: ParitySeed): string {
  return path.join(seedRoot, id);
}

/** Distinguishes a diagnostic fixture from a successful source snapshot. */
function isRejectedExpectation(
  expectation: SeedExpectation
): expectation is RejectedSeedExpectation {
  return 'errors' in expectation;
}

function readJson(filename: string): unknown {
  return JSON.parse(fs.readFileSync(filename, 'utf8')) as unknown;
}

function toPosixPath(filename: string): string {
  return filename.split(path.sep).join('/');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
