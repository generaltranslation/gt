import { readFileSync } from 'node:fs';
import type { Location, MessageFormatElement } from '@generaltranslation/icu';
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
  tree: MessageFormatElement[];
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

const location: Location = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 4, line: 1, column: 5 },
};

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

  it('ignores source locations on elements, options, and styles', () => {
    const withLocations: MessageFormatElement[] = [
      { type: 0, value: 'Hi ', location },
      {
        type: 5,
        value: 'kind',
        location,
        options: {
          location: { value: [{ type: 0, value: 'here', location }] },
          other: { value: [{ type: 7, location }], location },
        },
      },
      {
        type: 2,
        value: 'n',
        location,
        style: { type: 0, tokens: [], parsedOptions: {}, location },
      },
      { type: 8, value: 'b', location, children: [{ type: 1, value: 'x' }] },
    ];
    const withoutLocations: MessageFormatElement[] = [
      { type: 0, value: 'Hi ' },
      {
        type: 5,
        value: 'kind',
        options: {
          location: { value: [{ type: 0, value: 'here' }] },
          other: { value: [{ type: 7 }] },
        },
      },
      {
        type: 2,
        value: 'n',
        style: { type: 0, tokens: [], parsedOptions: {} },
      },
      { type: 8, value: 'b', children: [{ type: 1, value: 'x' }] },
    ];
    expect(hashMessageTree(withLocations)).toBe(
      hashMessageTree(withoutLocations)
    );
    // A select branch named `location` is content, not a source location.
    const withoutLocationBranch = structuredClone(withoutLocations);
    delete (withoutLocationBranch[1] as { options: Record<string, unknown> })
      .options.location;
    expect(hashMessageTree(withLocations)).not.toBe(
      hashMessageTree(withoutLocationBranch)
    );
  });

  it('does not mutate the input tree', () => {
    const tree: MessageFormatElement[] = [{ type: 0, value: 'Hi', location }];
    hashMessageTree(tree);
    expect(tree[0].location).toBe(location);
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
    expect(
      hashMessageTree([{ type: 0, value: 'Hi' }], {}, (input) => input)
    ).toBe('{"tree":[{"type":0,"value":"Hi"}],"v":1}');
  });
});
