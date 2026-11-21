/**
 * Collection -> injection pipeline: which hashes are computed and where they
 * are injected.
 *
 * Content that maps to several translation variants (a <Derive> child, a
 * derive() context, autoderive dynamic content) is resolved by the CLI, so
 * it must get NO compile-time hash: an injected hash (or an empty one, which
 * is used as the lookup hash) would pin the lookup to a key that matches none
 * of the variants. Skipping a <T> must also never shift the hashes of its
 * siblings.
 */
import { describe, it, expect } from 'vitest';
import type { JsxChildren } from '@generaltranslation/format';
import { runPasses } from './testHelpers';
import hashSource from '../../utils/calculateHash';

function transform(code: string, options: Record<string, unknown> = {}) {
  return runPasses(code, ['collection', 'injection'], options);
}

const jsxHash = (source: JsxChildren) =>
  hashSource({ source, dataFormat: 'JSX' });

const JSX_IMPORTS = `
  import { jsx, jsxs } from 'react/jsx-runtime';
  import { T, Var, Num, Select, Plural, Ordinal, Derive, derive } from 'gt-react';
`;

describe('<T> hash injection', () => {
  it('injects _hash into a plain <T>', () => {
    const { errors, code } = transform(
      `${JSX_IMPORTS}jsx(T, { children: "Hello world" });`
    );
    expect(errors).toEqual([]);
    expect(code).toContain(`_hash: "${jsxHash('Hello world')}"`);
  });

  it('injects _hash into a <T> with a Select but no Derive', () => {
    const { errors, code } = transform(
      `${JSX_IMPORTS}jsx(T, { children: jsx(Select, { value: cond, a: "first", b: "fallback" }) });`
    );
    expect(errors).toEqual([]);
    expect(code).toContain('_hash: "');
  });

  it.each<[source: string, compiled: string, options?: object]>([
    [
      '<T><Derive>{cond ? "a" : "b"}</Derive></T>',
      `jsx(T, { children: jsx(Derive, { children: cond ? "a" : "b" }) })`,
    ],
    [
      '<T><p>The <Derive>{...}</Derive> is ready.</p></T>',
      `jsx(T, { children: jsxs("p", { children: ["The ", jsx(Derive, { children: traveler === "solo" ? "solo traveler" : "family" }), " is ready."] }) })`,
    ],
    // Derive in a branch attribute is constructed separately from children
    [
      '<T><Select value={cond} a={<Derive>{getX()}</Derive>} b="fallback" /></T>',
      `jsx(T, { children: jsx(Select, { value: cond, a: jsx(Derive, { children: getX() }), b: "fallback" }) })`,
    ],
    [
      '<T><Plural n={count} one={<Derive>{getX()}</Derive>}>many</Plural></T>',
      `jsx(T, { children: jsx(Plural, { n: count, one: jsx(Derive, { children: getX() }), children: "many" }) })`,
    ],
    [
      '<T context={derive(getMeaning())}>Book</T>',
      `jsx(T, { children: "Book", context: derive(getMeaning()) })`,
    ],
    // Both signals together
    [
      '<T><Derive>{cond ? "a" : "b"}</Derive></T> with autoderive',
      `jsx(T, { children: jsx(Derive, { children: cond ? "a" : "b" }) })`,
      { autoderive: true },
    ],
    [
      '<T><Select value={cond} a={<Derive>{getX()}</Derive>} b="fallback" /></T> with autoderive',
      `jsx(T, { children: jsx(Select, { value: cond, a: jsx(Derive, { children: getX() }), b: "fallback" }) })`,
      { autoderive: true },
    ],
  ])('skips %s', (_source, compiled, options = {}) => {
    const { errors, code } = transform(`${JSX_IMPORTS}${compiled};`, options);
    expect(errors).toEqual([]);
    expect(code).not.toContain('_hash');
  });

  it.each([
    ['a parameter named T', 'function f(T) { jsx(T, { children: "Hello" }); }'],
    [
      'a local named T',
      'function f() { const T = Other; jsx(T, { children: "Hello" }); }',
    ],
  ])('leaves %s without a hash', (_name, compiled) => {
    const { errors, code } = transform(`${JSX_IMPORTS}${compiled}`);
    expect(errors).toEqual([]);
    expect(code).not.toContain('_hash');
  });

  it('a label named T does not shadow the import', () => {
    const { errors, code } = transform(
      `${JSX_IMPORTS}T: while (cond) { jsx(T, { children: "Hello" }); break T; }`
    );
    expect(errors).toEqual([]);
    expect(code).toContain(`_hash: "${jsxHash('Hello')}"`);
  });

  it('a Derive <T> does not shift the hash of a sibling <T>', () => {
    const { errors, code } = transform(`${JSX_IMPORTS}
      jsx(T, { children: jsx(Derive, { children: cond ? "a" : "b" }) });
      jsx(T, { children: "Plain sibling" });
    `);
    expect(errors).toEqual([]);
    expect(code.match(/_hash: "[^"]*"/g)).toEqual([
      `_hash: "${jsxHash('Plain sibling')}"`,
    ]);
  });
});

describe('<T> with dynamic content (autoderive)', () => {
  // <T>{expression}</T> variants, compiled
  const DYNAMIC_T = `jsxs(T, { children: ["Hello ", name] })`;

  it.each([
    ['<T>Hello {name}</T>', DYNAMIC_T],
    [
      '<T><b>Hello {name}</b></T>',
      `jsx(T, { children: jsxs("b", { children: ["Hello ", name] }) })`,
    ],
    [
      '<T>{firstName} {lastName}</T>',
      `jsxs(T, { children: [firstName, " ", lastName] })`,
    ],
    [
      '<T>{condition ? "yes" : "no"}</T>',
      `jsx(T, { children: condition ? "yes" : "no" })`,
    ],
    ['<T>{getName()}</T>', `jsx(T, { children: getName() })`],
    ['<T>{user.name}</T>', `jsx(T, { children: user.name })`],
    ['<T>{`Hello ${name}`}</T>', 'jsx(T, { children: `Hello ${name}` })'],
  ])(
    'autoderive allows %s and gives it an empty, uninjected hash',
    (_source, compiled) => {
      const { errors, code, manifest } = transform(
        `${JSX_IMPORTS}${compiled};`,
        {
          autoderive: true,
        }
      );
      expect(errors).toEqual([]);
      expect(Object.keys(manifest)).toEqual(['']);
      expect(code).not.toContain('_hash');
    }
  );

  it.each([
    [
      '<T>Hello world</T>',
      `jsx(T, { children: "Hello world" })`,
      'Hello world',
    ],
    [
      '<T>Hello <b>World</b></T>',
      `jsxs(T, { children: ["Hello ", jsx("b", { children: "World" })] })`,
      ['Hello ', { t: 'b', i: 1, c: 'World' }],
    ],
  ] as [string, string, JsxChildren][])(
    'autoderive still hashes static %s',
    (_source, compiled, children) => {
      const { errors, code, manifest } = transform(
        `${JSX_IMPORTS}${compiled};`,
        { autoderive: true }
      );
      expect(errors).toEqual([]);
      expect(Object.keys(manifest)).toEqual([jsxHash(children)]);
      expect(code).toContain(`_hash: "${jsxHash(children)}"`);
    }
  );

  it.each([
    ['autoderive: true', { autoderive: true }, true],
    ['autoderive: false', { autoderive: false }, false],
    ['no autoderive option', {}, false],
  ])('%s -> dynamic content allowed: %s', (_name, options, allowed) => {
    const { errors } = transform(`${JSX_IMPORTS}${DYNAMIC_T};`, options);
    expect(errors.length === 0).toBe(allowed);
  });

  it('rejects a conditional child without autoderive', () => {
    const { errors } = transform(
      `${JSX_IMPORTS}jsx(T, { children: condition ? "yes" : "no" });`
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  it('a dynamic <T> does not shift the hash of a static sibling', () => {
    const { errors, code } = transform(
      `${JSX_IMPORTS}
      ${DYNAMIC_T};
      jsx(T, { children: "Plain sibling" });
    `,
      { autoderive: true }
    );
    expect(errors).toEqual([]);
    expect(code.match(/_hash: "[^"]*"/g)).toEqual([
      `_hash: "${jsxHash('Plain sibling')}"`,
    ]);
    expect(code.split('\n').find((l) => l.includes('name'))).not.toContain(
      '_hash'
    );
  });
});

/**
 * JSX ids must match the runtime's addGTIdentifier numbering, which keeps a
 * shared counter through Select/Plural children. Select props start their own
 * counter from the branching element's id. Element ids are not hashed, but
 * variable keys (_gt_<id>) are, so these cases end in a variable.
 *
 * https://github.com/generaltranslation/gt/issues/2449
 */
describe('JSX ids of Select/Plural children, which are the other branch', () => {
  const PLURAL = `jsxs(Plural, { n: 2, one: "one bottle", children: [jsx(Num, { children: 2 }), " bottles"] })`;
  const pluralChildren = {
    t: 'Plural',
    i: 1,
    d: {
      b: {
        one: 'one bottle',
        other: [{ i: 2, v: 'n' as const }, ' bottles'],
      },
      t: 'p' as const,
    },
  };

  it.each<[source: string, compiled: string, children: JsxChildren]>([
    [
      '<T><Plural n={2} one="one bottle"><Num>{2}</Num> bottles</Plural><Var>{name}</Var></T>',
      `jsxs(T, { children: [${PLURAL}, jsx(Var, { children: name })] })`,
      [pluralChildren, { i: 2, v: 'v' }],
    ],
    [
      '<T><Select value="open" open="Open"><span>Closed</span></Select><Var>{name}</Var></T>',
      `jsxs(T, { children: [
        jsx(Select, { value: "open", open: "Open", children: jsx("span", { children: "Closed" }) }),
        jsx(Var, { children: name }),
      ] })`,
      [
        {
          t: 'Select',
          i: 1,
          d: {
            b: { open: 'Open', other: { t: 'span', i: 2, c: 'Closed' } },
            t: 's',
          },
        },
        { i: 2, v: 'v' },
      ],
    ],
    [
      '<T><Plural ...><Num>{2}</Num> bottles</Plural><Select value="open" open={<Var>{name}</Var>}>Closed</Select></T>',
      `jsxs(T, { children: [
        ${PLURAL},
        jsx(Select, { value: "open", open: jsx(Var, { children: name }), children: "Closed" }),
      ] })`,
      [
        pluralChildren,
        {
          t: 'Select',
          i: 2,
          d: {
            b: { open: { i: 3, v: 'v' }, other: 'Closed' },
            t: 's',
          },
        },
      ],
    ],
  ])('numbers %s like the runtime', (_source, compiled, children) => {
    const { errors, code } = transform(`${JSX_IMPORTS}${compiled};`);
    expect(errors).toEqual([]);
    expect(code).toContain(`_hash: "${jsxHash(children)}"`);
  });
});

describe('an other prop on Select/Plural', () => {
  it.each(['Plural', 'Ordinal', 'Select'])(
    'is an error on <%s>',
    (component) => {
      const { errors, code } = transform(
        `${JSX_IMPORTS}jsx(T, { children: jsx(${component}, { n: count, value: status, one: "One", other: "Many" }) });`
      );
      expect(errors).toEqual([
        expect.stringContaining(
          `<${component}> has no other prop. Write the fallback as its children.`
        ),
      ]);
      expect(code).not.toContain('_hash');
    }
  );
});

describe('<Ordinal>', () => {
  // <T><Ordinal n={place} _1="Winner" one="1st">nth</Ordinal></T>
  it.each([
    ['Ordinal', 'o'],
    ['Plural', 'p'],
  ] as const)('hashes <%s> as t: %s', (component, t) => {
    const { errors, code } = transform(
      `${JSX_IMPORTS}jsx(T, { children: jsx(${component}, { n: place, _1: "Winner", one: "1st", children: "nth" }) });`
    );
    expect(errors).toEqual([]);
    expect(code).toContain(
      `_hash: "${jsxHash({ t: component, i: 1, d: { b: { '=1': 'Winner', one: '1st', other: 'nth' }, t } })}"`
    );
  });

  it.each(['null', 'false', '""'])(
    'hashes a lone %s as no branches',
    (empty) => {
      const { code } = transform(
        `${JSX_IMPORTS}jsx(T, { children: jsx(Ordinal, { n: place, children: ${empty} }) });`
      );
      expect(code).toContain(`_hash: "${jsxHash({ t: 'Ordinal', i: 1 })}"`);
    }
  );
});

describe('a spread on Select/Plural', () => {
  it.each([
    ['Plural', '<Plural n={count} {...forms} />', '{ n: count, ...forms }'],
    ['Ordinal', '<Ordinal n={place} {...forms} />', '{ n: place, ...forms }'],
    [
      'Select',
      '<Select value={status} {...branches}>Closed</Select>',
      '{ value: status, ...branches, children: "Closed" }',
    ],
  ])('is rejected on <%s> inside <T>: %s', (component, _source, props) => {
    const { errors, code } = transform(
      `${JSX_IMPORTS}jsx(T, { children: jsx(${component}, ${props}) });`
    );
    expect(errors).toEqual([
      expect.stringContaining(
        `<${component}> cannot take a spread attribute because its props are read from the source. Write each prop out on the component.`
      ),
    ]);
    expect(code).not.toContain('_hash');
  });

  it('is rejected after a dynamic sibling that autoderive allows', () => {
    // <T>{name}<Plural n={count} {...forms} /></T>
    const { errors } = transform(
      `${JSX_IMPORTS}jsxs(T, { children: [name, jsx(Plural, { n: count, ...forms })] });`,
      { autoderive: true }
    );
    expect(errors).toEqual([
      expect.stringContaining('<Plural> cannot take a spread attribute'),
    ]);
  });

  it('is left alone outside translated content', () => {
    const { errors, code } = transform(
      `${JSX_IMPORTS}jsx(Plural, { n: count, ...forms });`
    );
    expect(errors).toEqual([]);
    expect(code).not.toContain('_hash');
  });
});
