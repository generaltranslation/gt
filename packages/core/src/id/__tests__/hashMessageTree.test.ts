import { readFileSync } from 'node:fs';
import type { MessageTree } from '@generaltranslation/icu';
import { describe, expect, it } from 'vitest';
import {
  hashMessageTree,
  MESSAGE_TREE_HASH_VERSION,
  type MessageTreeHashMetadata,
} from '../hashMessageTree';
import { hashSource } from '../hashSource';

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

describe('hashMessageTree', () => {
  it.each(fixtures)('$name: $template', ({ tree, options, hash }) => {
    expect(hashMessageTree(tree, options)).toBe(hash);
  });

  it('ignores object key order', () => {
    const tree = fixtureTree('plural-exact-key-order');
    const reordered = JSON.parse(JSON.stringify(tree), (_key, value) =>
      value && typeof value === 'object' && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value).reverse())
        : value
    );
    expect(JSON.stringify(reordered)).not.toBe(JSON.stringify(tree));
    expect(hashMessageTree(reordered)).toBe(hashMessageTree(tree));
  });

  it('hashes context only when non-empty', () => {
    const tree = fixtureTree('plain-literal');
    expect(hashMessageTree(tree, { context: '' })).toBe(hashMessageTree(tree));
  });

  it('hashes the absolute maxChars, including zero', () => {
    const tree = fixtureTree('plain-literal');
    expect(hashMessageTree(tree, { maxChars: 0 })).not.toBe(
      hashMessageTree(tree)
    );
  });

  it('hashes requiresReview only when true', () => {
    const tree = fixtureTree('plain-literal');
    expect(hashMessageTree(tree, { requiresReview: false })).toBe(
      hashMessageTree(tree)
    );
  });

  it('hashes explicitly undefined metadata like absent metadata', () => {
    const tree = fixtureTree('plain-literal');
    expect(
      hashMessageTree(tree, {
        context: undefined,
        maxChars: undefined,
        requiresReview: undefined,
      })
    ).toBe(hashMessageTree(tree));
  });

  it('differs from hashSource for the same data', () => {
    const tree = fixtureTree('plain-literal');
    expect(hashMessageTree(tree)).not.toBe(
      hashSource({ source: 'Save', dataFormat: 'ICU' })
    );
    expect(hashMessageTree(tree)).not.toBe(
      hashSource({ source: tree as never, dataFormat: 'ICU' })
    );
  });

  it('uses a custom hash function', () => {
    expect(MESSAGE_TREE_HASH_VERSION).toBe(1);
    expect(hashMessageTree(['Hi', ['name']], {}, (input) => input)).toBe(
      '{"tree":["Hi",["name"]],"v":1}'
    );
  });
});
