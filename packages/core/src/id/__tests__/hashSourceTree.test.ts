import { readFileSync } from 'node:fs';
import type { MessageTree } from '@generaltranslation/icu';
import { describe, expect, it } from 'vitest';
import { hashSource } from '../hashSource';
import type { MessageTreeHashMetadata } from '../types';

type TreeWireFormatFixture = {
  name: string;
  template: string;
  options: MessageTreeHashMetadata;
  tree: MessageTree;
  hash: string;
};

const fixtures: TreeWireFormatFixture[] = JSON.parse(
  readFileSync(
    new URL(
      '../../../../../test-fixtures/icu-tree-wire-format.json',
      import.meta.url
    ),
    'utf8'
  )
);

const fixtureTree = (name: string) =>
  fixtures.find((fixture) => fixture.name === name)!.tree;

const hashTree = (
  tree: MessageTree,
  metadata: MessageTreeHashMetadata = {},
  hashFunction?: (input: string) => string
) =>
  hashSource(
    { source: tree, dataFormat: 'ICU_TREE', ...metadata },
    hashFunction
  );

describe('hashSource with ICU_TREE', () => {
  it.each(fixtures)('$name: $template', ({ tree, options, hash }) => {
    expect(hashTree(tree, options)).toBe(hash);
  });

  it('ignores object key order', () => {
    const tree = fixtureTree('plural-exact-key-order');
    const reordered = JSON.parse(JSON.stringify(tree), (_key, value) =>
      value && typeof value === 'object' && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value).reverse())
        : value
    );
    expect(JSON.stringify(reordered)).not.toBe(JSON.stringify(tree));
    expect(hashTree(reordered)).toBe(hashTree(tree));
  });

  it('hashes context only when non-empty', () => {
    const tree = fixtureTree('plain-literal');
    expect(hashTree(tree, { context: '' })).toBe(hashTree(tree));
  });

  it('hashes the absolute maxChars, including zero', () => {
    const tree = fixtureTree('plain-literal');
    expect(hashTree(tree, { maxChars: 0 })).not.toBe(hashTree(tree));
  });

  it('hashes requiresReview only when true', () => {
    const tree = fixtureTree('plain-literal');
    expect(hashTree(tree, { requiresReview: false })).toBe(hashTree(tree));
  });

  it('hashes explicitly undefined metadata like absent metadata', () => {
    const tree = fixtureTree('plain-literal');
    expect(
      hashTree(tree, {
        context: undefined,
        maxChars: undefined,
        requiresReview: undefined,
      })
    ).toBe(hashTree(tree));
  });

  it('differs from other formats for the same data', () => {
    const tree = fixtureTree('plain-literal');
    expect(hashTree(tree)).not.toBe(
      hashSource({ source: 'Save', dataFormat: 'ICU' })
    );
    expect(hashTree(tree)).not.toBe(
      hashSource({ source: tree as never, dataFormat: 'ICU' })
    );
  });

  it('hashes the tree with its format, like any other source', () => {
    expect(hashTree(['Hi', ['name']], {}, (input) => input)).toBe(
      '{"dataFormat":"ICU_TREE","source":["Hi",["name"]]}'
    );
  });
});
