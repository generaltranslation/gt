import { execFileSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import type {
  FileUsages,
  ParaglideUsage,
} from '../../src/compiler/analysis/types.js';
import type { MessageKey } from '../../src/compiler/inlang/message-file.js';
import {
  renderMetadataFile,
  type MetadataFileInput,
} from '../../src/compiler/output/metadata.js';
import { referenceMetadataFile } from '../helpers/metadata-reference.js';
import { analyzeProject } from '../helpers/project.js';

const PROJECT = 'project.inlang';
const CODE = ['one', 'two', 'three', 'four'].join('\n');

const key = (id: string, path = [id]): MessageKey => ({ id, path });

/** A usage of `name` on `line` of a file. */
function usage(
  name: string,
  line: number,
  fields: Partial<ParaglideUsage> = {}
): ParaglideUsage {
  return {
    target: 'message',
    name,
    kind: 'call',
    start: line * 100,
    end: line * 100 + 5,
    line,
    column: 1,
    endLine: line,
    targetFile: '/app/src/paraglide/messages.js',
    inlangProject: PROJECT,
    ...fields,
  };
}

const source = (
  file: string,
  usages: ParaglideUsage[],
  code = CODE
): FileUsages => ({ file, code, usages });

/** The metadata file's content, which must be what the TypeScript implementation wrote. */
function rendered(input: MetadataFileInput): string | undefined {
  const content = renderMetadataFile(input);
  expect(content).toBe(referenceMetadataFile(input));

  return content;
}

/** The metadata of `keys`, parsed. */
const render = (
  keys: MessageKey[],
  sources: FileUsages[],
  existing: Record<string, unknown> = {},
  radius = 1
) =>
  JSON.parse(
    rendered({
      keys,
      sources,
      inlangProject: PROJECT,
      radius,
      existing: JSON.stringify(existing),
    }) ?? 'null'
  ) as Record<string, unknown>;

test('each used message gets the lines around its usages, by source file', () => {
  const metadata = render(
    [key('save'), key('unused'), key('cancel')],
    [
      source('src/b.ts', [usage('save', 4)]),
      source('src/a.ts', [usage('cancel', 1), usage('save', 2)]),
    ]
  );
  expect(metadata).toEqual({
    save: {
      sourceCode: {
        'src/a.ts': [{ before: 'one', target: 'two', after: 'three' }],
        'src/b.ts': [{ before: 'three', target: 'four', after: '' }],
      },
    },
    cancel: {
      sourceCode: {
        'src/a.ts': [{ before: '', target: 'one', after: 'two' }],
      },
    },
  });
  // In the message file's order; source files sorted.
  expect(Object.keys(metadata)).toEqual(['save', 'cancel']);
  expect(
    Object.keys((metadata.save as { sourceCode: object }).sourceCode)
  ).toEqual(['src/a.ts', 'src/b.ts']);
});

test('the content is JSON.stringify(metadata, null, 2), with a line break', () => {
  const content = rendered({
    keys: [key('save')],
    sources: [source('src/a.ts', [usage('save', 2)])],
    inlangProject: PROJECT,
    radius: 1,
    existing: '{"save":{"context":"A \\"button\\"","n":[1,{}]}}',
  });
  expect(content).toBe(
    [
      '{',
      '  "save": {',
      '    "context": "A \\"button\\"",',
      '    "n": [',
      '      1,',
      '      {}',
      '    ],',
      '    "sourceCode": {',
      '      "src/a.ts": [',
      '        {',
      '          "before": "one",',
      '          "target": "two",',
      '          "after": "three"',
      '        }',
      '      ]',
      '    }',
      '  }',
      '}',
      '',
    ].join('\n')
  );
});

test('the metadata is nested like the message file', () => {
  const keys = [key('nav.home', ['nav', 'home']), key('a.b', ['a.b'])];
  const files = [source('src/a.ts', [usage('nav.home', 1), usage('a.b', 1)])];
  const sourceCode = {
    'src/a.ts': [{ before: '', target: 'one', after: 'two' }],
  };
  expect(render(keys, files)).toEqual({
    nav: { home: { sourceCode } },
    'a.b': { sourceCode },
  });
});

test('a key named `__proto__` is a key like any other', () => {
  const sourceCode = `{"src/a.ts":[{"before":"","target":"one","after":"two"}]}`;
  const files = (id: string) => [source('src/a.ts', [usage(id, 1)])];
  const compact = (content: string | undefined) =>
    JSON.stringify(JSON.parse(content ?? 'null'));

  const flat = rendered({
    keys: [key('__proto__')],
    sources: files('__proto__'),
    inlangProject: PROJECT,
    radius: 1,
    existing: '{}',
  });
  expect(compact(flat)).toBe(`{"__proto__":{"sourceCode":${sourceCode}}}`);

  const nested = rendered({
    keys: [key('__proto__.home', ['__proto__', 'home'])],
    sources: files('__proto__.home'),
    inlangProject: PROJECT,
    radius: 1,
    existing: `{ "__proto__": { "home": { "context": "The start page" } } }`,
  });
  expect(compact(nested)).toBe(
    `{"__proto__":{"home":{"context":"The start page","sourceCode":${sourceCode}}}}`
  );
});

test("messages the file does not define, and other projects' usages, are left out", () => {
  const files = [
    source('src/a.ts', [
      usage('elsewhere', 1),
      usage('save', 2, { inlangProject: 'admin.inlang' }),
      usage('save', 3, { inlangProject: undefined }),
    ]),
  ];
  expect(render([key('save')], files)).toEqual({});
});

test('hand-written fields are kept; sourceCode and removed messages are not', () => {
  const existing = {
    save: {
      context: 'A button',
      maxChars: 10,
      sourceCode: { 'src/old.ts': [] },
    },
    unused: { context: 'Not used yet', sourceCode: { 'src/old.ts': [] } },
    removed: { context: 'No longer a message' },
    nav: { home: { maxChars: 20 } },
  };
  const keys = [key('save'), key('unused'), key('nav.home', ['nav', 'home'])];
  const files = [source('src/a.ts', [usage('save', 1)])];
  expect(render(keys, files, existing)).toEqual({
    save: {
      context: 'A button',
      maxChars: 10,
      sourceCode: {
        'src/a.ts': [{ before: '', target: 'one', after: 'two' }],
      },
    },
    unused: { context: 'Not used yet' },
    nav: { home: { maxChars: 20 } },
  });
});

test('a dynamic name goes to every message it matches; `*` alone to none', () => {
  const keys = [key('error_404'), key('error_500'), key('save')];
  const files = [
    source('src/a.ts', [
      usage('error_*', 1, { dynamic: true }),
      usage('*', 2, { dynamic: true }),
    ]),
  ];
  const sourceCode = {
    'src/a.ts': [{ before: '', target: 'one', after: 'two' }],
  };
  expect(render(keys, files)).toEqual({
    error_404: { sourceCode },
    error_500: { sourceCode },
  });
});

test('usages on the same lines give one snippet', () => {
  const files = [
    source('src/a.ts', [
      usage('save', 2),
      usage('save', 2, { start: 250, end: 255 }),
      usage('save', 3),
    ]),
  ];
  expect(render([key('save')], files)).toEqual({
    save: {
      sourceCode: {
        'src/a.ts': [
          { before: 'one', target: 'two', after: 'three' },
          { before: 'two', target: 'three', after: 'four' },
        ],
      },
    },
  });
});

// The output does not depend on the order the analysis found usages in.
test('usages at one spot (one prop, several values) render in a fixed order', async () => {
  const code = `<script>let { message } = $props();</script><em>{message()}</em>`;
  const usages = await analyzeProject(
    {
      '/app/src/Label.svelte': code,
      '/app/src/A.svelte': `<script>import { m } from "./paraglide/messages.js"; import Label from "./Label.svelte";</script><Label message={m.zeta} />`,
      '/app/src/B.svelte': `<script>import { m } from "./paraglide/messages.js"; import Label from "./Label.svelte";</script><Label message={m.alpha} />`,
    },
    { entry: '/app/src/Label.svelte', loadAll: true }
  );
  expect(usages).toHaveLength(2);
  const tagged = usages.map((found) => ({ ...found, inlangProject: PROJECT }));
  const renderOrdered = (ordered: ParaglideUsage[]) =>
    rendered({
      keys: [key('alpha'), key('zeta')],
      sources: [
        { file: 'src/Label.svelte', code, usages: ordered },
        source('src/a.ts', [usage('zeta', 1), usage('alpha', 1)]),
      ],
      inlangProject: PROJECT,
      radius: 1,
      existing: '{}',
    });
  const forward = renderOrdered(tagged);
  expect(renderOrdered([...tagged].reverse())).toBe(forward);
  expect(forward).toContain('src/Label.svelte');
});

describe('snippets', () => {
  const lines = ['a', 'b', 'c', 'd', 'e'].join('\n');
  const snippet = (line: number, endLine: number, radius: number) => {
    const metadata = render(
      [key('save')],
      [source('src/a.ts', [usage('save', line, { endLine })], lines)],
      {},
      radius
    ) as { save: { sourceCode: Record<string, unknown[]> } };

    return metadata.save.sourceCode['src/a.ts']![0];
  };

  test("split the usage's lines from those around it", () => {
    expect(snippet(2, 3, 1)).toEqual({
      before: 'a',
      target: 'b\nc',
      after: 'd',
    });
  });

  test('clamp to the file', () => {
    expect(snippet(1, 1, 10)).toEqual({
      before: '',
      target: 'a',
      after: 'b\nc\nd\ne',
    });
  });

  test('take no lines around with a radius of 0', () => {
    expect(snippet(3, 3, 0)).toEqual({ before: '', target: 'c', after: '' });
  });
});

describe('as the TypeScript implementation wrote it', () => {
  /** Renders `existing` with one used and one unused message, with the reference too. */
  const withExisting = (
    existing: string,
    keys = [key('save'), key('nav.home', ['nav', 'home'])]
  ) =>
    rendered({
      keys,
      sources: [source('src/a.ts', [usage('save', 1)])],
      inlangProject: PROJECT,
      radius: 1,
      existing,
    });

  test.each([
    [
      'numbers',
      '{"save": {"n": [-0, 1e400, -1e400, 1.0, 5e-324, 1e21, 1e-7, 123456789012345678901234567890, 0.1, 2e-7, 1.7976931348623157e308, 100e-2, 1E+2]}}',
    ],
    [
      'escapes',
      String.raw`{"save": {"t": "\" \\ \/ \b \f \n \r \t \u0000 \u001f \u007f     é 😀 \ud800 \udc00 \uDE00\uD83D"}}`,
    ],
    ['raw characters', '{"save": {"t": "é 😀   \u007f ～"}}'],
    [
      'array index keys',
      '{"save": {"b": 1, "4294967295": 2, "4294967294": 3, "1": 4, "01": 5, "-1": 6, "0": 7, "a": 8}, "10": {}, "2": {}}',
    ],
    [
      'duplicate keys',
      '{"save": {"a": 1, "b": 2, "a": 3}, "save": {"c": 4, "c": 5, "sourceCode": 6, "d": 7}}',
    ],
    [
      'duplicate keys, last not an object',
      '{"save": {"a": 1}, "save": "text"}',
    ],
    [
      'a message that is not an object',
      '{"save": ["context"], "nav": {"home": "x"}}',
    ],
    ['a group that is not an object', '{"nav": ["home"]}'],
    [
      'nested hand-written fields',
      '{"save": {"meta": {"tags": ["a", {"b": [[], {}]}], "sourceCode": "kept below the message"}}}',
    ],
    [
      '`__proto__` and other keys of Object.prototype',
      '{"save": {"__proto__": {"x": 1}, "constructor": 2, "toString": 3, "hasOwnProperty": 4}}',
    ],
    ['whitespace JSON allows', ' \t\r\n{ "save" : { "a" : 1 } } \n\r\t '],
    [
      'only `sourceCode`',
      '{"save": {"sourceCode": {"old.ts": []}}, "nav": {"home": {"sourceCode": {}}}}',
    ],
    ['empty objects', '{"save": {}, "nav": {"home": {}}}'],
    [
      'keys with escapes',
      String.raw`{"save": {"context": "x"}, "nav": {"home": {"a": 1}}}`,
    ],
  ])('%s', (_, existing) => {
    expect(withExisting(existing)).toBeDefined();
  });

  test.each([
    ['empty', ''],
    ['whitespace', ' \n'],
    ['a byte order mark', '﻿{}'],
    ['an array', '[]'],
    ['null', 'null'],
    ['a string', '"{}"'],
    ['a number', '1'],
    ['unfinished', '{ "save": { "context": "mid-edit" '],
    ['a trailing comma', '{"save": {},}'],
    ['comments', '// x\n{}'],
    ['single quotes', "{'save': {}}"],
    ['a leading zero', '{"save": {"n": 01}}'],
    ['a plus sign', '{"save": {"n": +1}}'],
    ['NaN', '{"save": {"n": NaN}}'],
    ['a control character in a string', '{"save": {"t": "\t"}}'],
    ['a bad escape', String.raw`{"save": {"t": "\x"}}`],
    ['a short unicode escape', String.raw`{"save": {"t": "\u12"}}`],
    ['two values', '{} {}'],
    ['non-breaking space', ' {}'],
    ['a vertical tab', '\u000B{}'],
    ['invalid JSON where nothing is kept', '{"other": [1,], "save": {}}'],
  ])('%s is not an object', (_, existing) => {
    expect(withExisting(existing)).toBeUndefined();
  });

  test('a hand-written field nested too deep fails as JSON.stringify does', () => {
    const deep = (depth: number) => '['.repeat(depth) + ']'.repeat(depth);
    const input = (depth: number): MetadataFileInput => ({
      keys: [key('save')],
      sources: [],
      inlangProject: PROJECT,
      radius: 1,
      existing: `{"save": {"context": ${deep(depth)}}, "other": ${deep(100_000)}}`,
    });

    expect(renderMetadataFile(input(1000))).toBe(
      referenceMetadataFile(input(1000))
    );
    expect(() => referenceMetadataFile(input(20_000))).toThrow(RangeError);
    expect(() => renderMetadataFile(input(20_000))).toThrow(RangeError);
  });

  test.each([
    ['\\r\\n line breaks', 'one\r\ntwo\r\nthree'],
    ['a \\r that ends no line', 'one\rtwo\nthree\r'],
    ['\\r\\r\\n', 'one\r\r\ntwo'],
    ['empty lines', '\n\none\n\n'],
    ['characters to escape', 'a "quote" \\ \t \u0000  \nb'],
    ['lone surrogates', '\uD83D\n\uDE00 \uD800\nx'],
    ['characters beyond U+FFFF', '😀\n～\n😀'],
  ])('code with %s', (_, code) => {
    const lines = code.split('\n').length;
    const usages = Array.from({ length: lines + 1 }, (_, index) =>
      usage('save', index + 1)
    );
    expect(
      rendered({
        keys: [key('save')],
        sources: [source('src/a.ts', usages, code)],
        inlangProject: PROJECT,
        radius: 1,
        existing: '{}',
      })
    ).toBeDefined();
  });

  test.each([0, 1, 2, 1.5, 0.5, 10, 1e9, Infinity, -1, -2.5, NaN])(
    'a radius of %s',
    (radius) => {
      const code = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].join('\n');
      expect(
        rendered({
          keys: [key('save')],
          sources: [
            source(
              'src/a.ts',
              [usage('save', 1), usage('save', 4), usage('save', 7)],
              code
            ),
          ],
          inlangProject: PROJECT,
          radius,
          existing: '{}',
        })
      ).toBeDefined();
    }
  );

  test('source files are sorted by their UTF-16 code units', () => {
    const files = [
      'src/～.ts',
      'src/😀.ts',
      'src/a-b.ts',
      'src/a/b.ts',
      'src/B.ts',
      'src/é.ts',
      '10',
      '2',
      'src/a.ts',
    ];
    const content = rendered({
      keys: [key('save')],
      sources: files.map((file) => source(file, [usage('save', 1)])),
      inlangProject: PROJECT,
      radius: 0,
      existing: '{}',
    });
    const metadata = JSON.parse(content!) as {
      save: { sourceCode: Record<string, unknown> };
    };
    // Array indexes first, as objects enumerate them.
    expect(Object.keys(metadata.save.sourceCode)).toEqual([
      '2',
      '10',
      'src/B.ts',
      'src/a-b.ts',
      'src/a.ts',
      'src/a/b.ts',
      'src/é.ts',
      'src/😀.ts',
      'src/～.ts',
    ]);
  });

  test('usages are ordered by place, then as found', () => {
    const code = ['a', 'b', 'c'].join('\n');
    expect(
      rendered({
        keys: [key('x'), key('y')],
        sources: [
          source(
            'src/a.ts',
            [
              usage('y', 3, { start: 5, end: 9 }),
              usage('x', 1, { start: 5, end: 9 }),
              usage('x', 2, { start: 5, end: 7 }),
              usage('x', 3, { start: 1, end: 2 }),
              usage('y', 1, { start: 5, end: 9 }),
            ],
            code
          ),
        ],
        inlangProject: PROJECT,
        radius: 0,
        existing: '{}',
      })
    ).toBeDefined();
  });

  test('ids repeated in the message file, as `a.b` and `a: { b }` both are', () => {
    expect(
      withExisting(
        '{"a.b": {"context": "flat"}, "a": {"b": {"context": "nested"}}}',
        [key('a.b', ['a.b']), key('a.b', ['a', 'b']), key('save')]
      )
    ).toBeDefined();
  });
});

describe('random projects render as the TypeScript implementation rendered them', () => {
  /** A small, seeded generator: the same cases on each run. */
  function random(seed: number) {
    let state = seed >>> 0;
    const next = () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
    const int = (max: number) => Math.floor(next() * max);
    const pick = <T>(items: readonly T[]): T => items[int(items.length)]!;
    const chance = (probability: number) => next() < probability;

    return { int, pick, chance };
  }

  const NAMES = [
    'save',
    'cancel',
    'title',
    'é',
    '😀',
    '\uD800',
    'a b',
    'q"uote',
    'back\\slash',
    'tab\t',
    '__proto__',
    'constructor',
    'toString',
    '0',
    '1',
    '10',
    '4294967294',
    '4294967295',
    '01',
    '',
    'error_404',
    'error_500',
    'sourceCode',
    'context',
  ];
  const LINES = [
    '',
    'const a = m.save();',
    '  return <p>{m.title()}</p>;',
    'é 😀 ～',
    '"quoted" \\ back',
    '\t\ttabs',
    '\u0000\u001f\u007f',
    '  ',
    '\uD83D',
    '\uDE00',
    'x\r',
    '\r',
    'plain',
  ];
  const FILES = [
    'src/a.ts',
    'src/b.ts',
    'src/a/b.ts',
    'src/a-b.ts',
    'src/é.svelte',
    'src/😀.ts',
    'src/～.ts',
    'src/B.ts',
    '0',
    '10',
    '2',
  ];
  const RADII = [0, 1, 2, 3, 10, 1.5, 0.5, Infinity, NaN, -1, 100];
  const PATTERNS = [
    'error_*',
    '*',
    '**',
    's*e',
    '*e',
    'a*b*c',
    'é*',
    '*😀*',
    '.*',
    '(x)*',
    '[*]',
    '*o*',
  ];

  function generate(seed: number): MetadataFileInput {
    const { int, pick, chance } = random(seed);

    // A message file: a tree of keys whose leaves are messages.
    const keys: MessageKey[] = [];
    const tree = (path: string[], depth: number) => {
      const count = 1 + int(depth === 0 ? 6 : 3);
      const names = new Set<string>();
      for (let index = 0; index < count; index++) names.add(pick(NAMES));
      for (const name of names) {
        const keyPath = [...path, name];
        if (depth < 2 && chance(0.25)) tree(keyPath, depth + 1);
        else keys.push({ id: keyPath.join('.'), path: keyPath });
      }
    };
    tree([], 0);
    const ids = keys.map(({ id }) => id);

    // Source files with usages of those messages, and of others.
    const sources: FileUsages[] = [];
    const fileCount = int(4);
    for (let index = 0; index < fileCount; index++) {
      const lines = Array.from({ length: 1 + int(12) }, () => pick(LINES));
      const code = lines.join(chance(0.3) ? '\r\n' : '\n');
      const usages: ParaglideUsage[] = Array.from({ length: int(8) }, () => {
        const line = chance(0.03) ? 0 : 1 + int(lines.length + 2);
        const dynamic = chance(0.2);
        return usage(
          dynamic ? pick(PATTERNS) : chance(0.85) ? pick(ids) : pick(NAMES),
          line,
          {
            dynamic: dynamic || undefined,
            start: int(5),
            end: int(5),
            endLine: line + int(3) - (chance(0.05) ? 2 : 0),
            inlangProject: chance(0.9)
              ? PROJECT
              : pick(['admin.inlang', undefined]),
          }
        );
      });
      sources.push({ file: pick(FILES), code, usages });
    }

    return {
      keys,
      sources: dedupeFiles(sources),
      inlangProject: PROJECT,
      radius: pick(RADII),
      existing: existingFile(keys, { int, pick, chance }),
    };
  }

  /** A file name once: the collector has one entry per file. */
  function dedupeFiles(sources: FileUsages[]): FileUsages[] {
    return [...new Map(sources.map((file) => [file.file, file])).values()];
  }

  /** A metadata file as written by hand, or by an earlier run: JSON text, sometimes not valid. */
  function existingFile(
    keys: readonly MessageKey[],
    { int, pick, chance }: ReturnType<typeof random>
  ): string {
    const value = (depth: number): string => {
      if (depth > 2 || chance(0.6)) {
        return pick([
          '1',
          '-0',
          '1.50',
          '1e21',
          '-2.5e-7',
          '0',
          'true',
          'false',
          'null',
          '"text"',
          String.raw`"é\n\"x\" \ud800"`,
          '123456789012345678901234567890',
          '"😀"',
        ]);
      }
      if (chance(0.4)) {
        return `[${Array.from({ length: int(3) }, () => value(depth + 1)).join(', ')}]`;
      }
      return object(depth + 1);
    };
    const object = (depth: number, members: string[] = []): string => {
      const count = int(4);
      for (let index = 0; index < count; index++) {
        members.push(
          `${JSON.stringify(pick([...NAMES, 'context', 'maxChars', 'sourceCode']))}: ${value(depth)}`
        );
      }
      return `{${members.join(chance(0.5) ? ', ' : ',\n  ')}}`;
    };

    // Entries at some of the keys' paths, and some elsewhere.
    const members: string[] = [];
    for (const { path } of keys) {
      if (!chance(0.6)) continue;
      let entry = chance(0.85) ? object(1) : value(3);
      for (const name of [...path].reverse().slice(0, -1)) {
        entry = `{${JSON.stringify(name)}: ${entry}}`;
      }
      members.push(`${JSON.stringify(path[0])}: ${entry}`);
    }
    if (chance(0.3)) members.push(`"removed": ${object(1)}`);

    let text = `{${members.join(', ')}}`;
    if (chance(0.05)) text = text.slice(0, int(text.length));
    if (chance(0.03)) text = `[${text}]`;
    if (chance(0.1)) text = `\n ${text}\t\n`;
    return text;
  }

  test('3000 random projects', () => {
    let renderedCount = 0;
    let notObjects = 0;

    for (let seed = 1; seed <= 3000; seed++) {
      const input = generate(seed);
      const expected = referenceMetadataFile(input);
      const actual = renderMetadataFile(input);

      if (actual !== expected) {
        // The failing case, to reproduce it.
        expect({ seed, input, actual }).toEqual({
          seed,
          input,
          actual: expected,
        });
      }

      if (expected === undefined) notObjects++;
      else renderedCount++;
    }

    // The cases cover both outcomes.
    expect(renderedCount).toBeGreaterThan(2500);
    expect(notObjects).toBeGreaterThan(50);
  });
});

test('rendering before any analysis leaves the analysis its threads', () => {
  // In a process of its own: the threads are set up once per process.
  const script = `
    const native = require('@generaltranslation/paraglide-js/native');
    const sources = [{ file: 'src/a.ts', code: 'm.a()', usages: [{ name: 'a', start: 0, end: 5, line: 1, endLine: 1, project: '' }] }];
    native.renderMetadata(JSON.stringify({ inlangProject: '', keys: [['a', ['a']]], existing: '{}', sources }), 3);

    // Nested deeper than threads with a default stack can parse.
    const code = 'export const x = ' + '('.repeat(3000) + '1' + ')'.repeat(3000) + ';';
    const graph = new native.NativeGraph({ targets: [], outdirs: [], sourceExtensions: [], detect: [] });
    graph.queueScript('/app/a.js', 0, code);
    graph.load([], []).then(({ skipped }) => graph.analyze(['/app/a.js']).then(() => console.log(JSON.stringify(skipped))));
  `;

  const output = execFileSync(process.execPath, ['-e', script], {
    cwd: import.meta.dirname,
    encoding: 'utf8',
    // Rust's default for a thread, set here for every system alike.
    env: { ...process.env, RUST_MIN_STACK: String(2 << 20) },
  });
  expect(output.trim()).toBe('[]');
});
