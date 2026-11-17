/**
 * Collection -> injection pipeline: which hashes are computed and where they
 * are injected.
 *
 * Content that maps to several translation variants (a <Derive> child, a
 * derive() message or $context, autoderive dynamic content) is resolved by
 * the CLI, so it must get NO compile-time hash: an injected hash (or an
 * empty one, which is used as the lookup hash) would pin the lookup to a
 * key that matches none of the variants. Skipping a call must also never
 * shift the hashes of its siblings.
 */
import { describe, it, expect } from 'vitest';
import type { JsxChildren } from '@generaltranslation/format';
import { runPasses, findCalls, literalValue } from './testHelpers';
import hashSource from '../../utils/calculateHash';

function transform(code: string, options: Record<string, unknown> = {}) {
  return runPasses(code, ['collection', 'injection'], options);
}

const jsxHash = (source: JsxChildren) =>
  hashSource({ source, dataFormat: 'JSX' });
const icuHash = (source: string) => hashSource({ source, dataFormat: 'ICU' });

const JSX_IMPORTS = `
  import { jsx, jsxs } from 'react/jsx-runtime';
  import { T, Var, Num, Branch, Plural, Derive, derive } from 'gt-react';
`;

describe('<T> hash injection', () => {
  it('injects _hash into a plain <T>', () => {
    const { errors, code } = transform(
      `${JSX_IMPORTS}jsx(T, { children: "Hello world" });`
    );
    expect(errors).toEqual([]);
    expect(code).toContain(`_hash: "${jsxHash('Hello world')}"`);
  });

  it('injects _hash into a <T> with a Branch but no Derive', () => {
    const { errors, code } = transform(
      `${JSX_IMPORTS}jsx(T, { children: jsx(Branch, { branch: cond, a: "first", b: "fallback" }) });`
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
      '<T><Branch branch={cond} a={<Derive>{getX()}</Derive>} b="fallback" /></T>',
      `jsx(T, { children: jsx(Branch, { branch: cond, a: jsx(Derive, { children: getX() }), b: "fallback" }) })`,
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
      '<T><Branch branch={cond} a={<Derive>{getX()}</Derive>} b="fallback" /></T> with autoderive',
      `jsx(T, { children: jsx(Branch, { branch: cond, a: jsx(Derive, { children: getX() }), b: "fallback" }) })`,
      { autoderive: true },
    ],
  ])('skips %s', (_source, compiled, options = {}) => {
    const { errors, code } = transform(`${JSX_IMPORTS}${compiled};`, options);
    expect(errors).toEqual([]);
    expect(code).not.toContain('_hash');
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
    [
      'autoderive: { jsx: true, strings: false }',
      { autoderive: { jsx: true, strings: false } },
      true,
    ],
    [
      'autoderive: { jsx: false, strings: true }',
      { autoderive: { jsx: false, strings: true } },
      false,
    ],
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
 * shared counter through Branch/Plural children. Branch props start their own
 * counter from the branching element's id. Element ids are not hashed, but
 * variable keys (_gt_<id>) are, so these cases end in a variable.
 *
 * https://github.com/generaltranslation/gt/issues/2449
 */
describe('JSX ids of Branch/Plural children, which are the other branch', () => {
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
      '<T><Branch branch="open" open="Open"><span>Closed</span></Branch><Var>{name}</Var></T>',
      `jsxs(T, { children: [
        jsx(Branch, { branch: "open", open: "Open", children: jsx("span", { children: "Closed" }) }),
        jsx(Var, { children: name }),
      ] })`,
      [
        {
          t: 'Branch',
          i: 1,
          d: {
            b: { open: 'Open', other: { t: 'span', i: 2, c: 'Closed' } },
            t: 'b',
          },
        },
        { i: 2, v: 'v' },
      ],
    ],
    [
      '<T><Plural ...><Num>{2}</Num> bottles</Plural><Branch branch="open" open={<Var>{name}</Var>}>Closed</Branch></T>',
      `jsxs(T, { children: [
        ${PLURAL},
        jsx(Branch, { branch: "open", open: jsx(Var, { children: name }), children: "Closed" }),
      ] })`,
      [
        pluralChildren,
        {
          t: 'Branch',
          i: 2,
          d: {
            b: { open: { i: 3, v: 'v' }, other: 'Closed' },
            t: 'b',
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

describe('an other prop on Branch/Plural', () => {
  it.each(['Plural', 'Branch'])('is an error on <%s>', (component) => {
    const { errors, code } = transform(
      `${JSX_IMPORTS}jsx(T, { children: jsx(${component}, { n: count, branch: status, one: "One", other: "Many" }) });`
    );
    expect(errors).toEqual([
      expect.stringContaining(
        `<${component}> has no other prop. Write the fallback as its children.`
      ),
    ]);
    expect(code).not.toContain('_hash');
  });
});

describe('a spread on Branch/Plural', () => {
  it.each([
    ['Plural', '<Plural n={count} {...forms} />', '{ n: count, ...forms }'],
    [
      'Branch',
      '<Branch branch={status} {...branches}>Closed</Branch>',
      '{ branch: status, ...branches, children: "Closed" }',
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

  it('is left alone outside translated content', () => {
    const { errors, code } = transform(
      `${JSX_IMPORTS}jsx(Plural, { n: count, ...forms });`
    );
    expect(errors).toEqual([]);
    expect(code).not.toContain('_hash');
  });
});

/**
 * Two regressions covered here:
 *
 * 1. Counter misalignment: collection skipped useGT() t() calls whose message
 *    could not be statically resolved WITHOUT reserving a counter slot, while the
 *    injection pass increments the counter for every t() call. Every t()
 *    call after a derive call was injected with the hash of the PREVIOUS call.
 *
 * 2. Empty-hash injection: t() calls with $context: derive(...) registered
 *    an empty hash which was injected as $_hash: "".
 */
describe('useGT() callback hash injection', () => {
  const USE_GT = `
    import { useGT, derive } from 'gt-react';
    const t = useGT();
  `;
  const injectedHashes = (code: string) =>
    code.match(/"\$_hash": "[^"]*"/g) ?? [];

  it('injects $_hash into a static t() call', () => {
    const { errors, code } = transform(`${USE_GT}t("Hello world");`);
    expect(errors).toEqual([]);
    expect(code).toContain(`"$_hash": "${icuHash('Hello world')}"`);
  });

  it.each([
    ['derive() in the message', 't(`Hello ${derive(getName())}`);'],
    ['$context: derive(...)', `t("Book", { $context: derive(getMeaning()) });`],
  ])('injects no $_hash for %s', (_name, call) => {
    const { errors, code } = transform(`${USE_GT}${call}`);
    expect(errors).toEqual([]);
    expect(code).not.toContain('$_hash');
  });

  it.each([
    ['a derive() message', 't(`Hello ${derive(getName())}`);', 'derive(', {}],
    [
      'autoderive dynamic content',
      't(`Hello ${name}`);',
      '${name}',
      { autoderive: true },
    ],
  ])(
    '%s does not shift hashes onto sibling calls',
    (_name, call, marker, options) => {
      const { errors, code } = transform(
        `${USE_GT}${call}\nt("Static message");`,
        options
      );
      expect(errors).toEqual([]);
      expect(injectedHashes(code)).toEqual([
        `"$_hash": "${icuHash('Static message')}"`,
      ]);
      // The hash is attached to the static call, not the skipped one
      const skippedCall = code.split('\n').find((l) => l.includes(marker));
      expect(skippedCall).toBeDefined();
      expect(skippedCall).not.toContain('$_hash');
    }
  );

  it('excludes derive entries from the useGT() prefetch array', () => {
    const { errors, code } = transform(`${USE_GT}
      t("Book", { $context: derive(getMeaning()) });
      t("Static message");
    `);
    expect(errors).toEqual([]);
    expect(code).toContain('useGT([');
    expect(code).toContain('message: "Static message"');
    expect(code).not.toContain('message: "Book"');
    expect(code).not.toContain('$_hash: ""');
  });

  it('leaves useGT() without arguments when every call is derived', () => {
    const { errors, code } = transform(
      USE_GT + 't(`Hello ${derive(getName())}`);'
    );
    expect(errors).toEqual([]);
    expect(code).toContain('useGT()');
    expect(code).not.toContain('$_hash');
  });

  it('keeps hash alignment when a standalone t() appears before the callback', () => {
    const { ast } = transform(`
      import { useGT, t } from 'gt-react';
      const standalone = t("Standalone string");
      const gt = useGT();
      const callback = gt("Callback string");
    `);
    const [tCall] = findCalls(ast, 't');
    const [gtCall] = findCalls(ast, 'gt');
    expect(literalValue(tCall.arguments[1])).toEqual({
      $_hash: icuHash('Standalone string'),
    });
    expect(literalValue(gtCall.arguments[1])).toEqual({
      $_hash: icuHash('Callback string'),
    });
  });

  it('resolves a local t = useGT() that shadows an imported t to the callback', () => {
    const { errors, code } = transform(`
      import { useGT, t } from 'gt-react';
      const standalone = t("Standalone string");
      function Component() {
        const t = useGT();
        return t("Callback string");
      }
    `);
    expect(errors).toEqual([]);
    expect(code).toContain('useGT([');
    expect(code).toContain('message: "Callback string"');
    expect(code).not.toContain('message: "Standalone string"');
    expect(code).toContain(`"$_hash": "${icuHash('Callback string')}"`);
  });
});

describe('standalone string function hash injection', () => {
  it('injects $_hash into t() and keeps its options', () => {
    const { ast } = transform(`
      import { t } from 'gt-react';
      const msg = t("Hello world", { $context: "greeting" });
    `);
    const calls = findCalls(ast, 't');
    expect(calls).toHaveLength(1);
    expect(literalValue(calls[0].arguments[1])).toEqual({
      $context: 'greeting',
      $_hash: hashSource({
        source: 'Hello world',
        context: 'greeting',
        dataFormat: 'ICU',
      }),
    });
  });

  it('does not inject $_hash into msg()', () => {
    const { ast } = transform(`
      import { msg } from 'gt-react';
      const value = msg("Hello world");
    `);
    const calls = findCalls(ast, 'msg');
    expect(calls).toHaveLength(1);
    expect(calls[0].arguments).toHaveLength(1);
  });

  it('injects getGT() preload messages with TranslationMetadata keys', () => {
    const { ast } = transform(`
      import { getGT } from 'gt-next/server';
      async function Page() {
        const t = await getGT();
        return t("Hello", { $context: "nav", $id: "greet", $maxChars: 50, $format: "STRING" });
      }
    `);
    const getGTCalls = findCalls(ast, 'getGT');
    expect(getGTCalls).toHaveLength(1);
    expect(literalValue(getGTCalls[0].arguments[0])).toEqual([
      {
        message: 'Hello',
        $context: 'nav',
        $id: 'greet',
        $maxChars: 50,
        $format: 'STRING',
        $_hash: hashSource({
          source: 'Hello',
          context: 'nav',
          maxChars: 50,
          dataFormat: 'STRING',
        }),
      },
    ]);
  });
});
