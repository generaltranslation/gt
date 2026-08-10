import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { hashSource } from 'generaltranslation/id';
import { describe, expect, it } from 'vitest';
import { extractFromVueSource } from './testVueCompiler.js';

type ParityMode = 'excluded' | 'semantic-wire-exact';

type ParitySeed = {
  context?: string;
  hash: string;
  id: string;
  mode: ParityMode;
  reason: string;
};

const repositoryRoot = path.resolve(__dirname, '../../../../..');
const seedRoot = path.join(repositoryRoot, 'tests/seeds');
const manifestPath = path.join(
  repositoryRoot,
  'test-fixtures/react-vue-runtime-parity.json'
);
const manifest = readManifest(manifestPath);
const semanticWireExactSeeds = manifest.filter(
  ({ mode }) => mode === 'semantic-wire-exact'
);
const excludedSeeds = manifest.filter(({ mode }) => mode === 'excluded');

describe('React runtime seed parity', () => {
  it('classifies every colocated Vue seed exactly once', () => {
    const manifestIds = manifest.map(({ id }) => id);

    expect(manifestIds).toEqual([...manifestIds].sort());
    expect(new Set(manifestIds).size).toBe(manifestIds.length);
    expect(manifestIds).toEqual(collectVueSeedIds(seedRoot));
    for (const seed of manifest) {
      expect(seed.reason).toBe(seed.reason.trim());
      expect(seed.reason.length).toBeGreaterThan(0);
      expect(
        fs.existsSync(path.join(seedDirectory(seed), 'expected.json'))
      ).toBe(true);
    }
  });

  describe('semantic-wire-exact seeds', () => {
    for (const seed of semanticWireExactSeeds) {
      it(`${seed.id}: ${seed.reason}`, async () => {
        const filename = path.join(seedDirectory(seed), 'page.vue');
        const output = await extractFromVueSource(
          fs.readFileSync(filename, 'utf8'),
          filename
        );
        const richResults = output.results.filter(
          ({ dataFormat }) => dataFormat === 'JSX'
        );

        expect(output.errors).toEqual([]);
        expect(output.warnings).toEqual([]);
        expect(output.results).toHaveLength(1);
        expect(richResults).toHaveLength(1);

        const result = richResults[0];
        const expectedSource = readJson(
          path.join(seedDirectory(seed), 'expected.json')
        );

        expect(result.metadata.context).toBe(seed.context);
        expect(toSemanticWireSource(result.source)).toStrictEqual(
          toSemanticWireSource(expectedSource)
        );
        expect(
          hashSource({
            context: result.metadata.context,
            dataFormat: 'JSX',
            source: result.source,
          })
        ).toBe(seed.hash);
      });
    }
  });

  describe('explicitly excluded seeds', () => {
    for (const seed of excludedSeeds) {
      it(`${seed.id}: ${seed.reason}`, async () => {
        const filename = path.join(seedDirectory(seed), 'page.vue');
        const output = await extractFromVueSource(
          fs.readFileSync(filename, 'utf8'),
          filename
        );
        const richResults = output.results.filter(
          ({ dataFormat }) => dataFormat === 'JSX'
        );
        const expectedSource = readJson(
          path.join(seedDirectory(seed), 'expected.json')
        );

        expect(seed.mode).toBe('excluded');
        expect(
          isExactParity(seed, output, richResults, expectedSource),
          `${seed.id} now matches the React oracle and must be promoted to semantic-wire-exact`
        ).toBe(false);
      });
    }
  });
});

/** Returns whether one extraction satisfies the complete portable contract. */
function isExactParity(
  seed: ParitySeed,
  output: Awaited<ReturnType<typeof extractFromVueSource>>,
  richResults: Awaited<ReturnType<typeof extractFromVueSource>>['results'],
  expectedSource: unknown
): boolean {
  if (
    output.errors.length > 0 ||
    output.warnings.length > 0 ||
    output.results.length !== 1 ||
    richResults.length !== 1
  ) {
    return false;
  }

  const result = richResults[0];
  if (
    result.metadata.context !== seed.context ||
    !isDeepStrictEqual(
      toSemanticWireSource(result.source),
      toSemanticWireSource(expectedSource)
    )
  ) {
    return false;
  }

  try {
    return (
      hashSource({
        context: result.metadata.context,
        dataFormat: 'JSX',
        source: result.source,
      }) === seed.hash
    );
  } catch {
    return false;
  }
}

/**
 * Canonicalizes a source to the persisted cross-runtime semantic wire format.
 *
 * React derives ordinary element labels from function names, which production
 * minifiers may rewrite. GT hashing already excludes those labels and both
 * runtimes reconcile translated elements by `i`, so only that ordinary `t`
 * label is removed. Branch/plural discriminators at `d.t`, IDs, variables,
 * content props, branches, and children remain strict. Undefined object props
 * are omitted because JSON catalogs cannot represent them; array positions and
 * holes remain untouched.
 */
function toSemanticWireSource(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toSemanticWireSource);
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key, child]) =>
          child !== undefined &&
          (key !== 't' || !('i' in value) || 'k' in value)
      )
      .map(([key, child]) => [key, toSemanticWireSource(child)])
  );
}

function collectVueSeedIds(directory: string): string[] {
  const ids: string[] = [];

  function visit(current: string): void {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const child = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(child);
      } else if (entry.name === 'page.vue') {
        ids.push(toPosixPath(path.relative(seedRoot, path.dirname(child))));
      }
    }
  }

  visit(directory);
  return ids.sort();
}

function seedDirectory({ id }: ParitySeed): string {
  return path.join(seedRoot, id);
}

function readManifest(filename: string): ParitySeed[] {
  const value = readJson(filename);
  invariant(Array.isArray(value), 'Runtime parity manifest must be an array');

  return value.map((entry, index) => {
    invariant(isRecord(entry), `Manifest entry ${index} must be an object`);
    invariant(
      entry.mode === 'excluded' || entry.mode === 'semantic-wire-exact',
      `Manifest entry ${index} has an invalid parity mode`
    );
    const expectedKeys = [
      ...('context' in entry ? ['context'] : []),
      'hash',
      'id',
      'mode',
      'reason',
    ].sort();
    invariant(
      Object.keys(entry).sort().join('\0') === expectedKeys.join('\0'),
      `Manifest entry ${index} has unexpected fields`
    );
    invariant(typeof entry.id === 'string', `Manifest entry ${index} needs id`);
    invariant(
      typeof entry.hash === 'string',
      `Manifest entry ${index} needs hash`
    );
    invariant(
      typeof entry.reason === 'string',
      `Manifest entry ${index} needs reason`
    );
    invariant(
      entry.context === undefined || typeof entry.context === 'string',
      `Manifest entry ${index} has invalid context`
    );

    return entry as ParitySeed;
  });
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
