import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import nodePath from 'node:path';
import { hashSource } from 'generaltranslation/id';
import { resolveImportPath } from '../../resolveImportPath.js';
import { calculateHashes } from '../../../../../extraction/postProcess.js';
import deriveContext from '../../../../../../../../test-fixtures/derive-context.json' with { type: 'json' };
import {
  extractUserT,
  extractWithAutoInjection,
  mockFiles,
  page,
  parsingOptions,
  sources,
} from './harness.js';

vi.mock('node:fs');
vi.mock('../../resolveImportPath.js');

const DYNAMIC_CHILDREN =
  '<T> component has children that could change at runtime';
const UNRESOLVED = (fn: string) =>
  `Function ${fn} definition could not be resolved. This might affect translation resolution`;

beforeEach(() => {
  vi.resetAllMocks();
});

it('attaches the surrounding source code when asked to', () => {
  const lines = [
    'import { T } from "gt-next";',
    '',
    'function Page() {',
    '  const name = "world";',
    '  return (',
    '    <T>',
    '      <div>Hello, world!</div>',
    '    </T>',
    '  );',
    '}',
  ];
  const code = lines.join('\n');
  vi.mocked(fs.readFileSync).mockReturnValue(code);

  const { updates, errors } = extractUserT(code, {
    file: nodePath.resolve('src/page.tsx'),
    includeSourceCodeContext: true,
  });

  expect(errors).toEqual([]);
  expect(updates.map((update) => update.metadata.sourceCode)).toEqual([
    {
      [nodePath.join('src', 'page.tsx')]: [
        {
          before: lines.slice(0, 5).join('\n'),
          target: lines.slice(5, 8).join('\n'),
          after: lines.slice(8).join('\n'),
        },
      ],
    },
  ]);
});

describe('Derive resolution across files', () => {
  /** A page rendering <T>test <Derive>{fn()}</Derive></T> with fn imported. */
  const derivePage = (fn: string, from = './libs/utils1') =>
    page(`<T>test <Derive>{${fn}()}</Derive></T>`, {
      outer: `import { ${fn} } from "${from}";`,
    });
  /** The sources derivePage yields for the given Derive contents. */
  const derived = (...contents: string[]) =>
    contents.map((c) => ['test ', { t: 'Derive', i: 1, c }]);

  function extract(code: string, files: Record<string, string>) {
    const root = mockFiles(files);
    const result = extractUserT(code, { file: `${root}/page.tsx` });
    const filesRead = vi
      .mocked(fs.readFileSync)
      .mock.calls.map(([file]) => String(file).replace(`${root}/`, ''));
    return { ...result, root, filesRead };
  }

  // utils1() returns its own two strings or whatever utils3() returns
  const utils1 = `
    import { utils3 } from "./utils2";
    export function utils1() {
      if (Math.random() > 0.5) {
        return utils3();
      }
      return 1 ? "utils1-a" : "utils1-b";
    }
  `;
  const utils3 = (conditionalReturn = '') => `
    import { utils1 } from "./utils1";
    export function utils3() {
      if (Math.random() > 0.5) {
        ${conditionalReturn}
      }
      return 1 ? "utils3-a" : "utils3-b";
    }
  `;

  it.each<[string, string, Record<string, string>, unknown[]]>([
    [
      'a function declaration',
      derivePage('getName'),
      { 'libs/utils1.ts': 'export function getName() { return "John"; }' },
      derived('John'),
    ],
    [
      'an arrow function',
      derivePage('getTitle'),
      { 'libs/utils1.ts': 'export const getTitle = () => "Dashboard";' },
      derived('Dashboard'),
    ],
    [
      'a function with several returns',
      derivePage('getData'),
      {
        'libs/utils1.ts': `export function getData() {
          if (Math.random() > 0.5) { return "Option A"; }
          return "Option B";
        }`,
      },
      derived('Option A', 'Option B'),
    ],
    [
      'an aliased import',
      page('<T>test <Derive>{aliasUtils1()}</Derive></T>', {
        outer: 'import { utils1 as aliasUtils1 } from "./libs/utils1";',
      }),
      {
        'libs/utils1.ts':
          'export function utils1() { return 1 ? "utils1-a" : "utils1-b"; }',
      },
      derived('utils1-a', 'utils1-b'),
    ],
    [
      'a named re-export',
      derivePage('getTitle', './libs/index'),
      {
        'libs/index.ts': 'export { getTitle } from "./impl";',
        'libs/impl.ts': 'export function getTitle() { return "Dashboard"; }',
      },
      derived('Dashboard'),
    ],
    [
      'modules that import each other',
      derivePage('utils1'),
      {
        'libs/utils1.ts': utils1,
        'libs/utils2.ts':
          'export * from "./utils1";\nexport * from "./utils3";',
        'libs/utils3.ts': utils3(),
      },
      derived('utils3-a', 'utils3-b', 'utils1-a', 'utils1-b'),
    ],
    [
      'a Derive next to a Branch',
      page(
        '<T>Status: <Derive>{getStatus()}</Derive><Branch branch="mode" light="Light" dark="Dark">Default</Branch></T>',
        { outer: 'import { getStatus } from "./libs/utils1";' }
      ),
      { 'libs/utils1.ts': 'export function getStatus() { return "Active"; }' },
      [
        [
          'Status: ',
          { t: 'Derive', i: 1, c: 'Active' },
          {
            t: 'Branch',
            i: 2,
            d: {
              b: { light: 'Light', dark: 'Dark', other: 'Default' },
              t: 'b',
            },
          },
        ],
      ],
    ],
    [
      'functions from two files',
      page(
        '<T>First: <Derive>{getFirst()}</Derive> Second: <Derive>{getSecond()}</Derive></T>',
        {
          outer:
            'import { getFirst } from "./libs/first";\nimport { getSecond } from "./libs/second";',
        }
      ),
      {
        'libs/first.ts': 'export function getFirst() { return "Alpha"; }',
        'libs/second.ts': 'export function getSecond() { return "Beta"; }',
      },
      [
        [
          'First: ',
          { t: 'Derive', i: 1, c: 'Alpha' },
          ' Second: ',
          { t: 'Derive', i: 2, c: 'Beta' },
        ],
      ],
    ],
  ])('resolves %s', (_name, code, files, expected) => {
    const result = extract(code, files);
    expect(result.errors).toEqual([]);
    expect(sources(result)).toEqual(expected);
  });

  it('follows export * and nested calls, producing the known hashes', () => {
    const result = extract(derivePage('utils1'), {
      'libs/utils1.ts': utils1,
      'libs/utils2.ts': 'export * from "./utils3";',
      'libs/utils3.ts': utils3(),
    });

    expect(result.errors).toEqual([]);
    expect(
      Object.fromEntries(
        result.updates.map(({ source, dataFormat }) => [
          hashSource({ source, dataFormat }),
          source,
        ])
      )
    ).toEqual({
      '837be41703617441': ['test ', { t: 'Derive', i: 1, c: 'utils3-a' }],
      '6c4330bad929001a': ['test ', { t: 'Derive', i: 1, c: 'utils3-b' }],
      '40d52de32ba666ce': ['test ', { t: 'Derive', i: 1, c: 'utils1-a' }],
      '081fa70a614caa27': ['test ', { t: 'Derive', i: 1, c: 'utils1-b' }],
    });
    expect(result.filesRead).toEqual([
      'libs/utils1.ts',
      'libs/utils2.ts',
      'libs/utils3.ts',
    ]);
    expect(resolveImportPath).toHaveBeenCalledWith(
      `${result.root}/page.tsx`,
      './libs/utils1',
      parsingOptions,
      expect.any(Map)
    );
    expect(resolveImportPath).toHaveBeenCalledWith(
      `${result.root}/libs/utils1.ts`,
      './utils2',
      parsingOptions,
      expect.any(Map)
    );
  });

  it('prefers a local function over an import with the same name', () => {
    const result = extract(
      page('<T>test <Derive>{getGreeting()}</Derive></T>', {
        outer: `
          import { getGreeting as importedGreeting } from "./libs/utils1";
          function getGreeting() { return 1 ? "local-a" : "local-b"; }
        `,
      }),
      {
        'libs/utils1.ts':
          'export function getGreeting() { return 1 ? "imported-a" : "imported-b"; }',
      }
    );

    expect(result.errors).toEqual([]);
    expect(sources(result)).toEqual(derived('local-a', 'local-b'));
    expect(result.filesRead).toEqual([]);
  });

  it.each([
    ['a function that calls itself', 'return utils3();', 'utils3'],
    ['functions that call each other', 'return utils1();', 'utils1'],
  ])('rejects %s', (_name, conditionalReturn, reported) => {
    const result = extract(derivePage('utils1'), {
      'libs/utils1.ts': utils1,
      'libs/utils2.ts': 'export * from "./utils3";',
      'libs/utils3.ts': utils3(conditionalReturn),
    });

    expect(result.errors).toEqual([
      expect.stringContaining(
        `Recursive function call detected: ${reported}. A derivable (statically analyzable) function cannot use recursive calls to construct its result.`
      ),
    ]);
    expect(result.updates).toEqual([]);
  });

  it('warns and keeps the resolvable branches when a re-export is missing', () => {
    const result = extract(derivePage('utils1'), {
      'libs/utils1.ts': utils1,
      'libs/utils2.ts': 'export * from "./utils1";',
      'libs/utils3.ts':
        'export function utils3() { return 1 ? "utils3-a" : "utils3-b"; }',
    });

    expect([...result.warnings]).toEqual([
      expect.stringContaining(UNRESOLVED('utils3')),
    ]);
    expect(sources(result)).toEqual([
      ['test ', { t: 'Derive', i: 1 }],
      ...derived('utils1-a', 'utils1-b'),
    ]);
    expect(result.filesRead).toEqual(['libs/utils1.ts', 'libs/utils2.ts']);
  });

  it.each<[string, string, Record<string, string>, string]>([
    [
      'is not defined anywhere',
      page('<T>test <Derive>{glorb()}</Derive></T>'),
      {},
      'glorb',
    ],
    [
      'returns nothing',
      derivePage('doSomething'),
      {
        'libs/utils1.ts':
          'export function doSomething() { console.log("side effect"); }',
      },
      'doSomething',
    ],
  ])('warns about a function that %s', (_name, code, files, fn) => {
    const result = extract(code, files);

    expect(result.errors).toEqual([]);
    expect([...result.warnings]).toEqual([
      expect.stringMatching(
        new RegExp(`^${result.root}/page\\.tsx .*${UNRESOLVED(fn)}`)
      ),
    ]);
    expect(sources(result)).toEqual([['test ', { t: 'Derive', i: 1 }]]);
  });

  it.each([
    [
      'JSX with a dynamic expression',
      'getGreeting("World")',
      'export function getGreeting(name: string) { return <span>Hello {name}</span>; }',
      'name',
    ],
    [
      // Not reported as recursion: the returned expression is not derivable
      'an expression that is not static',
      'factorial(5)',
      'export function factorial(n: number): number { if (n <= 1) return 1; return factorial(n - 1) * n; }',
      'factorial(n - 1) * n',
    ],
  ])(
    'reports a function in another file that returns %s',
    (_name, call, fn, reported) => {
      const fnName = call.slice(0, call.indexOf('('));
      const result = extract(
        page(`<T>Result: <Derive>{${call}}</Derive></T>`, {
          outer: `import { ${fnName} } from "./libs/utils1";`,
        }),
        { 'libs/utils1.tsx': fn }
      );

      // The message ends with the offending expression
      expect(result.errors).toEqual([
        expect.stringContaining(DYNAMIC_CHILDREN),
      ]);
      expect(result.errors[0].split('\n').at(-1)).toBe(reported);
      expect(result.updates).toEqual([]);
    }
  );

  // Renamed re-exports are followed to their source file. Only the file
  // traversal is asserted here.
  it.each<[string, string, Record<string, string>]>([
    [
      'a renamed re-export',
      derivePage('renamedFn', './libs/utils2'),
      {
        'libs/utils2.ts': 'export { originalFn as renamedFn } from "./utils1";',
        'libs/utils1.ts':
          'export function originalFn() { return Math.random() > 0.5 ? "original-a" : "original-b"; }',
      },
    ],
    [
      'export * of a renamed re-export',
      derivePage('deepFn', './libs/utils3'),
      {
        'libs/utils3.ts': 'export * from "./utils2";',
        'libs/utils2.ts': 'export { originalFn as deepFn } from "./utils1";',
        'libs/utils1.ts':
          'export function originalFn() { return Math.random() > 0.5 ? "deep-a" : "deep-b"; }',
      },
    ],
  ])('reads every file behind %s', (_name, code, files) => {
    const result = extract(code, files);

    expect(result.errors).toEqual([]);
    expect(result.filesRead).toEqual(Object.keys(files));
  });
});

describe('derive in the context prop', () => {
  const getFormality =
    'function getFormality() { if (isFormal) { return "formal"; } else { return "casual"; } }';

  it('produces one update per derived context, sharing a staticId', () => {
    const { updates, errors } = extractUserT(
      page('<T context={derive(getFormality())}>Hello</T>', {
        outer: getFormality,
      })
    );

    expect(errors).toEqual([]);
    expect(updates.map((u) => [u.source, u.metadata.context])).toEqual([
      ['Hello', 'formal'],
      ['Hello', 'casual'],
    ]);
    expect(updates[0].metadata.staticId).toEqual(expect.any(String));
    expect(updates[1].metadata.staticId).toBe(updates[0].metadata.staticId);
  });

  it('multiplies derived content by derived context', () => {
    const { updates, errors } = extractUserT(
      page(
        '<T context={derive(getFormality())}><Derive>{getGreeting()}</Derive></T>',
        {
          outer: `${getFormality}
            function getGreeting() { if (isMorning) { return "Good morning"; } else { return "Good evening"; } }`,
        }
      )
    );

    expect(errors).toEqual([]);
    expect(
      updates.map((u) => [(u.source as { c: string }).c, u.metadata.context])
    ).toEqual([
      ['Good morning', 'formal'],
      ['Good morning', 'casual'],
      ['Good evening', 'formal'],
      ['Good evening', 'casual'],
    ]);
    expect(updates[0].metadata.staticId).toEqual(expect.any(String));
    expect(new Set(updates.map((u) => u.metadata.staticId)).size).toBe(1);
  });

  it('hashes each derived context as the runtime does', async () => {
    const { updates, errors } = extractUserT(
      page(deriveContext.jsx, { outer: getFormality })
    );
    await calculateHashes(updates);

    expect(errors).toEqual([]);
    expect(
      updates.map(({ source, metadata: { context, hash } }) => ({
        source,
        context,
        hash,
      }))
    ).toEqual(
      deriveContext.variants.map((variant) => ({
        source: deriveContext.source,
        ...variant,
      }))
    );
  });

  it.each([
    ['a call', 'derive(getFormality())', ['formal', 'casual']],
    ['an awaited call', 'derive(await getFormality())', ['formal', 'casual']],
    [
      'a conditional',
      'derive(isFormal ? "formal" : "casual")',
      ['formal', 'casual'],
    ],
    ['a const', 'derive(tone)', ['formal', 'casual']],
    [
      'a call that builds the full text',
      'derive(getTone())',
      ['tone: formal', 'tone: casual'],
    ],
  ])('follows %s inside derive()', (_name, context, contexts) => {
    const { updates, errors } = extractUserT(
      page(`<T context={${context}}>Hello</T>`, {
        outer: `${getFormality}
          function getTone() { return \`tone: \${getFormality()}\` as const; }`,
        body: 'const tone = isFormal ? "formal" : "casual";',
      }).replace('function Page', 'async function Page')
    );

    expect(errors).toEqual([]);
    expect(updates.map((u) => u.metadata.context)).toEqual(contexts);
  });

  const NOT_WHOLE = 'reads derive() only as its whole context';
  const UNRESOLVED_DERIVE = 'derive() rules violation: Could not resolve';

  it.each([
    ['text joined to derive()', '"tone: " + derive(getFormality())', NOT_WHOLE],
    [
      'derive() in a template literal',
      '`tone: ${derive(getFormality())}`',
      NOT_WHOLE,
    ],
    [
      'derive() in one branch of a conditional',
      'isFormal ? derive(getFormality()) : "casual"',
      NOT_WHOLE,
    ],
    [
      'derive() of a value it cannot follow',
      'derive(props.tone)',
      UNRESOLVED_DERIVE,
    ],
    ['derive() without an argument', 'derive()', UNRESOLVED_DERIVE],
    [
      'derive() with two arguments',
      'derive(getFormality(), "casual")',
      UNRESOLVED_DERIVE,
    ],
    [
      'a call joined to text inside derive()',
      'derive("tone: " + getFormality())',
      UNRESOLVED_DERIVE,
    ],
  ])('rejects %s', (_name, context, error) => {
    const { updates, errors } = extractUserT(
      page(`<T context={${context}}>Hello</T>`, { outer: getFormality })
    );

    expect(updates).toEqual([]);
    expect(errors).toContainEqual(expect.stringContaining(error));
  });

  it('keeps a static string context', () => {
    const { updates, errors } = extractUserT(
      page('<T context="greeting">Hello</T>')
    );

    expect(errors).toEqual([]);
    expect(updates.map((u) => [u.source, u.metadata.context])).toEqual([
      ['Hello', 'greeting'],
    ]);
  });
});

describe('Derive inside Plural/Branch props', () => {
  const twoGreetings =
    'function getGreeting() { if (isFormal) return "Good day"; return "Hey"; }';

  it.each([
    [
      'one Plural form',
      2,
      '<Plural n={count} one={<><Derive>{getAnimal()}</Derive> is here</>}>animals</Plural>',
      'function getAnimal() { if (Math.random() > 0.5) return "cat"; return "dog"; }',
    ],
    [
      'two Plural forms (3 x 3)',
      9,
      '<Plural n={count} one={<><Derive>{getAnimal()}</Derive> is here</>}><Derive>{getAnimal()}</Derive> are here</Plural>',
      'function getAnimal() { if (Math.random() > 0.5) return "cat"; if (Math.random() > 0.5) return "dog"; return "bird"; }',
    ],
    [
      'a Branch prop',
      2,
      '<Branch branch={mode} formal={<><Derive>{getGreeting()}</Derive>, welcome</>} casual="What\'s up" />',
      twoGreetings,
    ],
    [
      'a Branch prop and the Branch children (2 x 3)',
      6,
      '<Branch branch={mode} formal={<><Derive>{getGreeting()}</Derive>, welcome</>}><Derive>{getDefault()}</Derive> there</Branch>',
      `${twoGreetings}
       function getDefault() { if (isNight) return "Good night"; if (isMorning) return "Good morning"; return "Hello"; }`,
    ],
    [
      'two Plural forms deriving a function that returns Plurals (3 x 3)',
      9,
      `<p>
        <Plural
          n={count}
          one={<>Here is <Num>{count}</Num> <Derive>{getSubject()}</Derive> who is a racing driver</>}
        >
          Here are <Num>{count}</Num> <Derive>{getSubject()}</Derive> who are racing drivers
        </Plural>.
      </p>`,
      `function getSubject() {
        const subject = Math.random() > 0.5 ? 'man' : 'woman';
        if (subject === 'man') return <Plural n={count} one='man'>men</Plural>;
        if (subject === 'woman') return <Plural n={count} one='woman'>women</Plural>;
        return <Plural n={count} one='child'>children</Plural>;
      }`,
    ],
  ])('multiplies Derive in %s into %i updates', (_name, count, jsx, outer) => {
    const { updates, errors } = extractUserT(page(`<T>${jsx}</T>`, { outer }));

    expect(errors).toEqual([]);
    expect(updates).toHaveLength(count);
  });
});

// https://github.com/generaltranslation/gt/issues/2449
// IDs must match the runtime's addGTIdentifier (react-core). The children of
// a Branch or a Plural are its `other` branch, and every branch starts its own
// counter from the branching element's ID in both implementations.
describe('GT IDs of Branch/Plural children, which are the other branch', () => {
  const plural = {
    t: 'Plural',
    i: 1,
    d: {
      b: {
        one: 'one bottle',
        other: [{ i: 2, v: 'n' }, ' bottles'],
      },
      t: 'p',
    },
  };
  const pluralJsx =
    '<Plural n={2} one="one bottle"><Num>{2}</Num> bottles</Plural>';

  it.each([
    [
      'an element after Plural children',
      `<T>${pluralJsx}<span> live</span></T>`,
      [plural, { t: 'span', i: 2, c: ' live' }],
    ],
    [
      'an element after Branch children',
      '<T><Branch branch="open" open="Open"><span>Closed</span></Branch><span> live</span></T>',
      [
        {
          t: 'Branch',
          i: 1,
          d: {
            b: { open: 'Open', other: { t: 'span', i: 2, c: 'Closed' } },
            t: 'b',
          },
        },
        { t: 'span', i: 2, c: ' live' },
      ],
    ],
    [
      'branch props of a later element',
      `<T>${pluralJsx}<Branch branch="open" open={<b>Open</b>}>Closed</Branch></T>`,
      [
        plural,
        {
          t: 'Branch',
          i: 2,
          d: {
            b: { open: { t: 'b', i: 3, c: 'Open' }, other: 'Closed' },
            t: 'b',
          },
        },
      ],
    ],
  ])('numbers %s like the runtime', (_name, jsx, expected) => {
    const result = extractUserT(page(jsx));

    expect(result.errors).toEqual([]);
    expect(sources(result)).toEqual([expected]);
  });
});

describe('<N>, the count of its <Plural>', () => {
  // The same source as the runtime writes, in react-core's addGTIdentifier test.
  it('is a count variable', () => {
    const result = extractUserT(
      page('<T><Plural n={2} one="One file"><b><N /></b> files</Plural></T>')
    );

    expect(result.errors).toEqual([]);
    expect(sources(result)).toEqual([
      {
        t: 'Plural',
        i: 1,
        d: {
          b: {
            one: 'One file',
            other: [{ t: 'b', i: 2, c: { i: 3, v: '#' } }, ' files'],
          },
          t: 'p',
        },
      },
    ]);
  });

  // A component of the author's own called N is an element: in a named
  // branch, and next to a GT <N> imported under another name.
  it.each([false, true])(
    'is not a component called N that GT did not export, auto injection %s',
    (enableAutoJsxInjection) => {
      const result = extractUserT(
        [
          'import { T, Plural, N as Count } from "gt-next";',
          'const N = ({ children }) => children;',
          'export default function Page() {',
          '  return <T><Plural n={1} one={<N>One</N>}><Count /> files</Plural></T>;',
          '}',
        ].join('\n'),
        { enableAutoJsxInjection }
      );

      expect(result.errors).toEqual([]);
      expect(sources(result)).toEqual([
        {
          t: 'Plural',
          i: 1,
          d: {
            b: {
              one: { t: 'N', i: 2, c: 'One' },
              other: [{ i: 2, v: '#' }, ' files'],
            },
            t: 'p',
          },
        },
      ]);
    }
  );
});

describe('Branch/Plural props that are never rendered', () => {
  it.each([
    [
      'an exact number with a leading zero',
      '<Plural n={2} _01="one bottle">bottles</Plural>',
      'Ignored the _01 prop of <Plural> because it is not an exact number.',
    ],
    [
      'an exact number with an exponent',
      '<Plural n={2} _1e3="a thousand bottles">bottles</Plural>',
      'Ignored the _1e3 prop of <Plural> because it is not an exact number.',
    ],
    [
      'an exact number with a leading zero on <Ordinal>',
      '<Ordinal n={2} _01="first">later</Ordinal>',
      'Ignored the _01 prop of <Ordinal> because it is not an exact number.',
    ],
  ])('warns about %s', (_name, jsx, message) => {
    const { errors, warnings } = extractUserT(page(`<T>${jsx}</T>`));

    expect(errors).toEqual([]);
    expect([...warnings]).toEqual([expect.stringContaining(message)]);
  });

  it('does not warn about exact numbers and children', () => {
    const { warnings } = extractUserT(
      page('<T><Plural n={2} _0="none" _10="ten">bottles</Plural></T>')
    );

    expect([...warnings]).toEqual([]);
  });

  it.each([
    ['Plural', '<Plural n={2} one="one bottle" other="bottles" />'],
    ['Ordinal', '<Ordinal n={2} one="1st" other="nth" />'],
    ['Branch', '<Branch branch="open" open="Open" other="Closed" />'],
  ])('rejects an other prop on <%s>', (component, jsx) => {
    const { errors } = extractUserT(page(`<T>${jsx}</T>`));

    expect(errors).toEqual([
      expect.stringContaining(
        `<${component}> has no other prop. Write the fallback as its children.`
      ),
    ]);
  });
});

describe('<Ordinal>', () => {
  it('is stored as an ordinal plural, which hashes apart from a plural', () => {
    const branches = (tag: string) =>
      extractUserT(
        page(
          `<T><${tag} n={place} _1="Winner" one={<><Num>{place}</Num>st</>}><Num>{place}</Num>th</${tag}></T>`
        )
      );
    const b = {
      '=1': 'Winner',
      one: { t: 'C2', i: 2, c: [{ i: 3, v: 'n' }, 'st'] },
      other: [{ i: 2, v: 'n' }, 'th'],
    };
    const [ordinal, plural] = [branches('Ordinal'), branches('Plural')];

    expect(ordinal.errors).toEqual([]);
    expect(sources(ordinal)).toEqual([
      { t: 'Ordinal', i: 1, d: { b, t: 'o' } },
    ]);
    expect(sources(plural)).toEqual([{ t: 'Plural', i: 1, d: { b, t: 'p' } }]);
    const [ordinalHash, pluralHash] = [ordinal, plural].map((result) =>
      hashSource({ dataFormat: 'JSX', source: result.updates[0].source })
    );
    expect(ordinalHash).not.toBe(pluralHash);
  });

  it.each([null, false, ''])('stores no branches for a lone %j', (empty) => {
    expect(
      sources(
        extractUserT(
          page(`<T><Ordinal n={place}>{${JSON.stringify(empty)}}</Ordinal></T>`)
        )
      )
    ).toEqual([{ t: 'Ordinal', i: 1 }]);
  });
});

describe('a component of the author named like a branching component', () => {
  const module = (imports: string, jsx: string) =>
    `${imports}\nexport default function Page() { return <T>${jsx}</T>; }`;

  it.each(['Ordinal', 'Plural', 'Branch'])(
    'keeps their own <%s> an ordinary element',
    (name) => {
      const result = extractUserT(
        module(
          `import { T } from "gt-next";\nimport { ${name} } from "./ui";`,
          `<${name} one="1st">Ranking</${name}>`
        )
      );

      expect(result.errors).toEqual([]);
      expect(sources(result)).toEqual([{ t: name, i: 1, c: 'Ranking' }]);
    }
  );

  it.each([
    ['an aliased', 'import { T, Ordinal as Place } from "gt-next";'],
    ['a quoted', 'import { T, "Ordinal" as Place } from "gt-next";'],
  ])('reads %s GT import as the component it is', (_name, imports) => {
    // Through getPathsAndAliases, which collects the imports for gt.
    const result = extractWithAutoInjection(
      module(imports, '<Place n={2} one="1st">nth</Place>')
    );

    expect(result.errors).toEqual([]);
    expect(sources(result)).toEqual([
      { t: 'Ordinal', i: 1, d: { b: { one: '1st', other: 'nth' }, t: 'o' } },
    ]);
  });
});

describe('a spread attribute on Branch/Plural', () => {
  it.each([
    ['Plural', '<Plural n={count} {...forms} />'],
    ['Ordinal', '<Ordinal n={place} {...forms} />'],
    ['Branch', '<Branch branch={status} {...branches}>Closed</Branch>'],
  ])('is rejected on <%s> inside <T>', (component, jsx) => {
    const { updates, errors } = extractUserT(page(`<T>${jsx}</T>`));

    expect(updates).toEqual([]);
    expect(errors).toEqual([
      expect.stringContaining(
        `<${component}> cannot take a spread attribute because its props are read from the source. Write each prop out on the component.`
      ),
    ]);
  });

  it('is left alone outside translated content', () => {
    const { updates, errors } = extractUserT(
      page('<Plural n={count} {...forms} />')
    );

    expect(updates).toEqual([]);
    expect(errors).toEqual([]);
  });
});

describe('Derive of a variable', () => {
  const derive = (c: string, i = 1) => ({ t: 'Derive', i, c });

  it.each([
    ['a string literal', '"welcome"', ['welcome']],
    ['a static template literal', '`hello world`', ['hello world']],
    ['a string concatenation', '"good" + " " + "morning"', ['good morning']],
    ['a number', '42', ['42']],
    ['a negative number', '-10', ['-10']],
    ['a boolean', 'true', ['true']],
    ['null', 'null', ['null']],
    ['an "as const" string', '"hello" as const', ['hello']],
    ['a ternary', 'condition ? "boy" : "girl"', ['boy', 'girl']],
    ['a ternary with a type assertion', 'c ? "a" : "b" as string', ['a', 'b']],
    [
      'a nested ternary',
      'a ? "small" : b ? "medium" : "large"',
      ['small', 'medium', 'large'],
    ],
    ['a ternary of mixed types', 'cond ? "text" : 42', ['text', '42']],
    ['a ternary with identical branches', 'cond ? "same" : "same"', ['same']],
  ])('resolves a const initialized with %s', (_name, init, contents) => {
    const result = extractUserT(
      page('<T><Derive>{value}</Derive></T>', {
        body: `const value = ${init};`,
      })
    );

    expect(result.errors).toEqual([]);
    expect(sources(result)).toEqual(contents.map((c) => derive(c)));
  });

  it.each<[string, string, unknown[]]>([
    [
      'a const that aliases other consts',
      page('<T><Derive>{ref2}</Derive></T>', {
        body: 'const original = cond ? "yes" : "no"; const ref1 = original; const ref2 = ref1;',
      }),
      [derive('yes'), derive('no')],
    ],
    [
      'a const next to static text',
      page('<T>The <Derive>{subject}</Derive> is sleeping</T>', {
        body: 'const subject = condition ? "cat" : "dog";',
      }),
      [
        ['The ', derive('cat'), ' is sleeping'],
        ['The ', derive('dog'), ' is sleeping'],
      ],
    ],
    [
      'two consts into their cross product',
      page('<T><Derive>{greeting}</Derive> <Derive>{subject}</Derive></T>', {
        body: 'const greeting = x ? "hi" : "hey"; const subject = y ? "world" : "there";',
      }),
      [
        [derive('hi'), ' ', derive('world', 2)],
        [derive('hi'), ' ', derive('there', 2)],
        [derive('hey'), ' ', derive('world', 2)],
        [derive('hey'), ' ', derive('there', 2)],
      ],
    ],
    [
      'a const and a function call into their cross product',
      page('<T><Derive>{greeting}</Derive> <Derive>{getTime()}</Derive></T>', {
        outer: 'function getTime() { return cond ? "day" : "night"; }',
        body: 'const greeting = x ? "hello" : "goodbye";',
      }),
      [
        [derive('hello'), ' ', derive('day', 2)],
        [derive('hello'), ' ', derive('night', 2)],
        [derive('goodbye'), ' ', derive('day', 2)],
        [derive('goodbye'), ' ', derive('night', 2)],
      ],
    ],
    [
      'a const from an enclosing scope',
      page('<T><Derive>{label}</Derive></T>', {
        outer: 'const label = condition ? "outer-a" : "outer-b";',
      }),
      [derive('outer-a'), derive('outer-b')],
    ],
    [
      'the innermost of two shadowing consts',
      page('<T><Derive>{label}</Derive></T>', {
        outer: 'const label = "outer";',
        body: 'const label = "inner";',
      }),
      [derive('inner')],
    ],
    [
      'the same const in two <T> components',
      page(
        '<><T>First: <Derive>{role}</Derive></T><T>Second: <Derive>{role}</Derive></T></>',
        { body: 'const role = cond ? "admin" : "user";' }
      ),
      [
        ['First: ', derive('admin')],
        ['First: ', derive('user')],
        ['Second: ', derive('admin')],
        ['Second: ', derive('user')],
      ],
    ],
  ])('resolves %s', (_name, code, expected) => {
    const result = extractUserT(code);

    expect(result.errors).toEqual([]);
    expect(sources(result)).toEqual(expected);
  });

  it('keeps an empty string branch as its own variant', () => {
    const result = extractUserT(
      page(
        `<T>
          <Derive>{includeOptionalPrefix ? "Optional prefix: " : ""}</Derive>
          <Branch branch={showReviewerName} true={"Jordan"} false={""} />
          {" approved the build for "}
          <Var name="release-name">{releaseName}</Var>
        </T>`
      )
    );
    const rest = [
      { t: 'Branch', i: 2, d: { t: 'b', b: { true: 'Jordan', false: '' } } },
      ' approved the build for ',
      { i: 3, k: 'release-name', v: 'v' },
    ];

    expect(result.errors).toEqual([]);
    expect(sources(result)).toEqual([
      [derive('Optional prefix: '), ...rest],
      [derive(''), ...rest],
    ]);
  });

  it('resolves a const initialized with an empty string', () => {
    const { updates, errors } = extractUserT(
      page('<T>prefix<Derive>{empty}</Derive>suffix</T>', {
        body: 'const empty = "";',
      })
    );

    expect(errors).toEqual([]);
    expect(updates).toHaveLength(1);
  });

  it.each(['let', 'var'])('warns about a %s declaration', (kind) => {
    const { warnings } = extractUserT(
      page('<T><Derive>{label}</Derive></T>', {
        body: `${kind} label = "hello";`,
      })
    );

    expect([...warnings]).toEqual([
      expect.stringContaining(
        `Variable label is declared with '${kind}' but only 'const' declarations can be resolved statically.`
      ),
    ]);
  });

  it.each([
    [
      'object destructuring',
      { body: 'const { label } = someObj;' },
      'uses destructuring syntax',
    ],
    [
      'array destructuring',
      { body: 'const [label] = someArr;' },
      'uses destructuring syntax',
    ],
    ['an undeclared variable', {}, DYNAMIC_CHILDREN],
    [
      'a function that is not called',
      { body: 'const label = () => "hello";' },
      DYNAMIC_CHILDREN,
    ],
    [
      'a declaration without an initializer',
      { outer: 'declare const label: string;' },
      DYNAMIC_CHILDREN,
    ],
  ])('rejects %s', (_name, setup, message) => {
    const { updates, errors } = extractUserT(
      page('<T><Derive>{label}</Derive></T>', setup)
    );

    expect(errors).toEqual([expect.stringContaining(message)]);
    expect(updates).toEqual([]);
  });

  it('rejects a function parameter', () => {
    const { updates, errors } = extractUserT(`
      import { T, Derive } from "gt-next";
      export default function Page({ label }) {
        return <T><Derive>{label}</Derive></T>;
      }
    `);

    expect(errors).toEqual([expect.stringContaining(DYNAMIC_CHILDREN)]);
    expect(updates).toEqual([]);
  });
});

describe('autoderive: <T> implicitly acts as <Derive>', () => {
  const autoderive = (code: string) => extractUserT(code, { autoderive: true });
  const label = { body: 'const label = condition ? "boy" : "girl";' };
  const twoByTwo = {
    body: 'const a = c1 ? "x" : "y"; const b = c2 ? "1" : "2";',
  };

  it.each<[string, string, unknown[]]>([
    [
      'a ternary const without a Derive node',
      page('<T>Hello {label}</T>', label),
      [
        ['Hello ', 'boy'],
        ['Hello ', 'girl'],
      ],
    ],
    [
      'a const inside a child element',
      page('<T>Hello <b>{label}</b></T>', label),
      [
        ['Hello ', { t: 'b', i: 1, c: 'boy' }],
        ['Hello ', { t: 'b', i: 1, c: 'girl' }],
      ],
    ],
    [
      'a const inside nested elements',
      page('<T><div><span>{label}</span></div></T>', label),
      [
        { t: 'div', i: 1, c: { t: 'span', i: 2, c: 'boy' } },
        { t: 'div', i: 1, c: { t: 'span', i: 2, c: 'girl' } },
      ],
    ],
    ['static content', page('<T>Hello world</T>'), ['Hello world']],
    [
      'a string const',
      page('<T>{label}</T>', { body: 'const label = "hello";' }),
      ['hello'],
    ],
    [
      'a nested ternary',
      page('<T>{x}</T>', {
        body: 'const x = a ? "one" : b ? "two" : "three";',
      }),
      ['one', 'two', 'three'],
    ],
    [
      'a const from an enclosing scope',
      page('<T>{label}</T>', {
        outer: 'const label = condition ? "outer1" : "outer2";',
      }),
      ['outer1', 'outer2'],
    ],
    [
      'two expressions into their cross product',
      page('<T>{a} and {b}</T>', twoByTwo),
      [
        ['x', ' and ', '1'],
        ['x', ' and ', '2'],
        ['y', ' and ', '1'],
        ['y', ' and ', '2'],
      ],
    ],
    [
      'expressions in separate child elements into their cross product',
      page('<T><b>{a}</b> and <i>{b}</i></T>', twoByTwo),
      [
        [{ t: 'b', i: 1, c: 'x' }, ' and ', { t: 'i', i: 2, c: '1' }],
        [{ t: 'b', i: 1, c: 'x' }, ' and ', { t: 'i', i: 2, c: '2' }],
        [{ t: 'b', i: 1, c: 'y' }, ' and ', { t: 'i', i: 2, c: '1' }],
        [{ t: 'b', i: 1, c: 'y' }, ' and ', { t: 'i', i: 2, c: '2' }],
      ],
    ],
    [
      'an explicit Derive, keeping its node',
      page('<T>Hello <Derive>{label}</Derive></T>', label),
      [
        ['Hello ', { t: 'Derive', i: 1, c: 'boy' }],
        ['Hello ', { t: 'Derive', i: 1, c: 'girl' }],
      ],
    ],
    [
      'an explicit Derive next to a bare expression',
      page('<T><Derive>{a}</Derive> and {b}</T>', twoByTwo),
      [
        [{ t: 'Derive', i: 1, c: 'x' }, ' and ', '1'],
        [{ t: 'Derive', i: 1, c: 'x' }, ' and ', '2'],
        [{ t: 'Derive', i: 1, c: 'y' }, ' and ', '1'],
        [{ t: 'Derive', i: 1, c: 'y' }, ' and ', '2'],
      ],
    ],
    [
      'each <T> of a file independently',
      `import { T } from "gt-next";
       export function A() { const x = c ? "a" : "b"; return <T>{x}</T>; }
       export function B() { const y = c ? "1" : "2"; return <T>{y}</T>; }`,
      ['a', 'b', '1', '2'],
    ],
  ])('resolves %s', (_name, code, expected) => {
    const result = autoderive(code);

    expect(result.errors).toEqual([]);
    expect(sources(result)).toEqual(expected);
  });

  it('reports dynamic content when autoderive is off', () => {
    const { updates, errors } = extractUserT(
      page('<T>Hello {label}</T>', label),
      { autoderive: false }
    );

    expect(errors).toEqual([expect.stringContaining(DYNAMIC_CHILDREN)]);
    expect(updates).toEqual([]);
  });

  it('warns about a let declaration', () => {
    const { warnings } = autoderive(
      page('<T>{label}</T>', { body: 'let label = "hello";' })
    );

    expect([...warnings]).toEqual([
      expect.stringContaining("Variable label is declared with 'let'"),
    ]);
  });

  it('rejects a destructured variable', () => {
    const { errors } = autoderive(
      page('<T>{label}</T>', { body: 'const { label } = obj;' })
    );

    expect(errors).toEqual([
      expect.stringContaining('uses destructuring syntax'),
    ]);
  });

  it('sets a shared staticId only on derived content', () => {
    const [staticUpdate] = autoderive(
      page('<T>Hello <b>World</b></T>')
    ).updates;
    const derivedUpdates = autoderive(
      page('<T>Hello {label}</T>', label)
    ).updates;

    expect(staticUpdate.metadata.staticId).toBeUndefined();
    expect(derivedUpdates[0].metadata.staticId).toEqual(expect.any(String));
    expect(derivedUpdates[1].metadata.staticId).toBe(
      derivedUpdates[0].metadata.staticId
    );
  });
});
