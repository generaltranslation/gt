import fs from 'node:fs';
import path from 'node:path';
import type { JsxChildren } from '@generaltranslation/format/types';
import { hashSource } from 'generaltranslation/id';
import { describe, expect, it } from 'vitest';
import {
  MINIMUM_EXACT_SEED_COUNT,
  NON_PORTABLE_SEEDS,
} from '../../../../../test-fixtures/react-vue-seed-contract.js';
import { extractFromVueSource } from './testVueCompiler.js';

const repositoryRoot = path.resolve(__dirname, '../../../../..');
const seedRoot = path.join(repositoryRoot, 'tests/seeds');
const reactSeedIds = collectSeedIds(seedRoot, 'page.tsx');
const vueSeedIds = collectSeedIds(seedRoot, 'page.vue');
const nonPortableIds = new Set(NON_PORTABLE_SEEDS.map(({ id }) => id));
const exactSeedIds = reactSeedIds.filter((id) => !nonPortableIds.has(id));

describe('React seed oracle parity for the Vue extractor', () => {
  it('discovers the same complete seed corpus as the runtime contract', () => {
    expect(reactSeedIds).toHaveLength(84);
    expect(vueSeedIds).toEqual(reactSeedIds);
    expect(exactSeedIds.length).toBeGreaterThanOrEqual(
      MINIMUM_EXACT_SEED_COUNT
    );
  });

  for (const id of exactSeedIds) {
    it(`extracts React's exact semantic wire and hash for ${id}`, async () => {
      const directory = path.join(seedRoot, id);
      const vueFilename = path.join(directory, 'page.vue');
      const vueSource = fs.readFileSync(vueFilename, 'utf8');
      const reactSource = fs.readFileSync(
        path.join(directory, 'page.tsx'),
        'utf8'
      );
      const expectedSource = readJson(
        path.join(directory, 'expected.json')
      ) as JsxChildren;
      const expectedContext = readStaticReactContext(reactSource);
      const output = await extractFromVueSource(vueSource, vueFilename, {
        projectRoot: repositoryRoot,
      });
      const results = output.results.filter(
        ({ dataFormat }) => dataFormat === 'JSX'
      );

      expect(output.errors).toEqual([]);
      expect(output.warnings).toEqual([]);
      expect(results).toHaveLength(1);

      const result = results[0]!;
      expect(result.metadata.context).toBe(expectedContext);
      expect(normalizeSemanticWire(result.source)).toStrictEqual(
        normalizeSemanticWire(expectedSource)
      );
      expect(sourceHash(result.source, result.metadata.context)).toBe(
        sourceHash(expectedSource, expectedContext)
      );
    });
  }
});

/** Reads the one static React context form supported by the shared seeds. */
function readStaticReactContext(source: string): string | undefined {
  const match = source.match(/<T\b[^>]*\bcontext\s*=\s*"([^"]+)"/s);
  return match?.[1];
}

/** Removes only diagnostic element labels before framework comparison. */
function normalizeSemanticWire(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeSemanticWire);
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key, child]) =>
          child !== undefined &&
          (key !== 't' || !('i' in value) || 'k' in value)
      )
      .map(([key, child]) => [key, normalizeSemanticWire(child)])
  );
}

function sourceHash(source: JsxChildren, context?: string): string {
  return hashSource({ context, dataFormat: 'JSX', source });
}

function readJson(filename: string): unknown {
  return JSON.parse(fs.readFileSync(filename, 'utf8')) as unknown;
}

/** Recursively discovers one side of the React/Vue seed contract. */
function collectSeedIds(directory: string, seedFilename: string): string[] {
  const ids: string[] = [];

  function visit(current: string): void {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    if (
      entries.some((entry) => entry.isFile() && entry.name === seedFilename)
    ) {
      ids.push(path.relative(directory, current).replaceAll(path.sep, '/'));
    }
    for (const entry of entries) {
      if (entry.isDirectory()) visit(path.join(current, entry.name));
    }
  }

  visit(directory);
  return ids.sort();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
