import { describe, expect, it } from 'vitest';
import {
  attributeBytes,
  decodeMappings,
  resolveSource,
} from '../server/sourcemap.ts';
import { encodeMappings } from './vlq.ts';

const sum = (totals: Map<string | null, number>) =>
  [...totals.values()].reduce((a, b) => a + b, 0);

describe('decodeMappings', () => {
  it('decodes columns and source indices with delta encoding', () => {
    const mappings = encodeMappings([[[0, 0], [5, 1], [9]], [[2, 1]]]);
    expect(decodeMappings(mappings)).toEqual([
      { line: 0, column: 0, source: 0 },
      { line: 0, column: 5, source: 1 },
      { line: 0, column: 9, source: null },
      { line: 1, column: 2, source: 1 },
    ]);
  });

  it('decodes a mapping string produced by a real bundler', () => {
    // From esbuild: two sources on one line.
    expect(decodeMappings('AAAA,SCAA')).toEqual([
      { line: 0, column: 0, source: 0 },
      { line: 0, column: 9, source: 1 },
    ]);
  });

  it('rejects invalid characters', () => {
    expect(() => decodeMappings('A!AA')).toThrow(/Invalid VLQ/);
  });
});

describe('attributeBytes', () => {
  it('charges each byte to the preceding segment and newlines to the line owner', () => {
    const code = 'abcdef\nxyz';
    const totals = attributeBytes(
      code,
      {
        version: 3,
        sources: ['a.ts', 'b.ts'],
        mappings: encodeMappings([
          [
            [0, 0],
            [3, 1],
          ],
          [[0, 0]],
        ]),
      },
      '/src'
    );
    expect(totals.get('/src/a.ts')).toBe(6);
    expect(totals.get('/src/b.ts')).toBe(4);
    expect(sum(totals)).toBe(code.length);
  });

  it('reports bytes before the first segment and unsourced segments as null', () => {
    const code = '/*hdr*/x=1;y';
    const totals = attributeBytes(
      code,
      {
        version: 3,
        sources: ['a.ts', 'b.ts'],
        mappings: encodeMappings([[[7, 0], [11]]]),
      },
      '/src'
    );
    expect(totals.get(null)).toBe(8);
    expect(totals.get('/src/a.ts')).toBe(4);
  });

  it('counts UTF-8 bytes, not UTF-16 columns', () => {
    const code = '"日本"+"é"';
    const totals = attributeBytes(
      code,
      {
        version: 3,
        sources: ['a.ts', 'b.ts'],
        mappings: encodeMappings([
          [
            [0, 0],
            [4, 1],
          ],
        ]),
      },
      '/src'
    );
    expect(totals.get('/src/a.ts')).toBe(Buffer.byteLength('"日本"'));
    expect(totals.get('/src/b.ts')).toBe(Buffer.byteLength('+"é"'));
    expect(sum(totals)).toBe(Buffer.byteLength(code));
  });

  it('handles indexed maps with sections, as Turbopack emits', () => {
    const code = 'AAAA\nBBBBCCCC';
    const totals = attributeBytes(
      code,
      {
        version: 3,
        sections: [
          {
            offset: { line: 0, column: 0 },
            map: {
              version: 3,
              sources: ['a.ts'],
              mappings: encodeMappings([[[0, 0]]]),
            },
          },
          {
            offset: { line: 1, column: 0 },
            map: {
              version: 3,
              sources: ['b.ts'],
              mappings: encodeMappings([[[0, 0]]]),
            },
          },
          {
            offset: { line: 1, column: 4 },
            map: {
              version: 3,
              sources: ['c.ts'],
              mappings: encodeMappings([[[0, 0]]]),
            },
          },
        ],
      },
      '/src'
    );
    expect(totals.get('/src/a.ts')).toBe(5);
    expect(totals.get('/src/b.ts')).toBe(4);
    expect(totals.get('/src/c.ts')).toBe(4);
  });

  it('charges unmapped bytes to the only source, as for JSON chunks', () => {
    const code = 'var e=`Langue`;export{e as default};';
    const totals = attributeBytes(
      code,
      { version: 3, sources: ['../../src/_gt/fr.json'], mappings: '' },
      '/app/dist/assets'
    );
    expect([...totals]).toEqual([['/app/src/_gt/fr.json', code.length]]);
  });

  it('merges sources that resolve to the same path', () => {
    const totals = attributeBytes(
      'aabb',
      {
        version: 3,
        sources: ['./x.ts', 'x.ts'],
        mappings: encodeMappings([
          [
            [0, 0],
            [2, 1],
          ],
        ]),
      },
      '/src'
    );
    expect([...totals]).toEqual([['/src/x.ts', 4]]);
  });
});

describe('resolveSource', () => {
  it('resolves relative paths against the map dir and source root', () => {
    expect(resolveSource('../lib/a.js', undefined, '/app/dist/assets')).toBe(
      '/app/dist/lib/a.js'
    );
    expect(resolveSource('a.js', 'src', '/app')).toBe('/app/src/a.js');
  });

  it('decodes URL-encoded scoped package paths', () => {
    expect(
      resolveSource('node_modules/%40noble/hashes/x.js', undefined, '/app')
    ).toBe('/app/node_modules/@noble/hashes/x.js');
  });

  it('resolves Turbopack [project] paths against the project root', () => {
    expect(
      resolveSource(
        'turbopack:///[project]/repo/packages/next/src/a.ts',
        undefined,
        '/x',
        '/Users/me'
      )
    ).toBe('/Users/me/repo/packages/next/src/a.ts');
  });

  it('keeps other schemes as virtual ids', () => {
    expect(
      resolveSource('turbopack:///[turbopack]/runtime.ts', undefined, '/x')
    ).toBe('[turbopack]/runtime.ts');
    expect(resolveSource('file:///abs/a.ts', undefined, '/x')).toBe(
      '/abs/a.ts'
    );
  });
});
