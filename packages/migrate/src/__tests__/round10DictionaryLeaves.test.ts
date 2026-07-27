import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { reactI18nextAdapter } from '../adapters/reactI18next.js';
import {
  describeDictionaryValue,
  isRenderableLeaf,
  resolveDictionaryKey,
} from '../catalogs/dictionaryLeaf.js';
import { auditConvertedDictionaryKeys } from '../pipeline/auditDictionaryKeys.js';
import type { MigrationContext } from '../pipeline/types.js';

/**
 * Round-10 finding 3: the audit tested presence, so every non-undefined value
 * counted and it stayed silent on the values gt-next actually throws on.
 * Renderable means a DictionaryLeaf: `string`, `[message]`, `[message, opts]`.
 */

const cwd = '/tmp/probe-app';
const callSite = [
  "import { useTranslations } from 'gt-next';",
  'export function View() {',
  "  const t = useTranslations('links');",
  "  return <p>{t('tips')}</p>;",
  '}',
].join('\n');

function auditWith(
  dictionary: Record<string, unknown>,
  code = callSite
): MigrationContext {
  const ctx = {
    cwd,
    catalogs: {
      dir: path.join(cwd, 'gt/dictionaries'),
      locales: ['en'],
      defaultLocale: 'en',
      byLocale: { en: dictionary },
    },
    routing: {
      locales: ['en'],
      defaultLocale: 'en',
      localePrefix: null,
      pathnames: null,
      routingFile: null,
      requestFile: null,
    },
    adapter: reactI18nextAdapter,
    edits: [
      {
        path: path.join(cwd, 'components/View.tsx'),
        kind: 'write',
        content: code,
      },
    ],
    todos: [],
    warnings: [],
    skippedFiles: new Map(),
    stats: {},
  } as unknown as MigrationContext;
  auditConvertedDictionaryKeys(ctx);
  return ctx;
}

function reasons(ctx: MigrationContext): string {
  return ctx.todos.map((todo) => todo.reason).join(' ');
}

describe('round 10 finding 3: a resolvable key must reach a renderable leaf', () => {
  // Each case was silent pre-fix; the array one is exactly what failed
  // linkboard's build with the error string this audit exists to predict.
  const cases: [string, unknown, string][] = [
    ['an ARRAY', ['a', 'b'], 'an array (2 entries)'],
    ['an OBJECT subtree', { a: 'x' }, 'a nested object (1 key)'],
    ['null', null, 'null'],
    ['a number', 42, 'a number'],
  ];

  for (const [label, value, described] of cases) {
    it(`reports a key that resolves to ${label}`, () => {
      const ctx = auditWith({ links: { tips: value } });
      expect(ctx.todos).toHaveLength(1);
      expect(ctx.todos[0].line).toBe(4);
      expect(reasons(ctx)).toContain(`'links.tips', which is ${described}`);
      expect(reasons(ctx)).toContain('not a string');
      expect(reasons(ctx)).toContain(
        'Dictionary entry links.tips cannot be found'
      );
      expect((ctx.warnings ?? []).join(' ')).toContain(
        '1 converted call site(s)'
      );
    });
  }

  it('control: says nothing when the key is a string', () => {
    const ctx = auditWith({ links: { tips: 'Tag as you go' } });
    expect(ctx.todos).toEqual([]);
    expect(ctx.warnings ?? []).toEqual([]);
  });

  it('control: says nothing for the [message] / [message, options] leaves', () => {
    expect(auditWith({ links: { tips: ['Only one'] } }).todos).toEqual([]);
    expect(
      auditWith({ links: { tips: ['Hi', { $context: 'greeting' }] } }).todos
    ).toEqual([]);
  });

  it('control: an absent key keeps its own wording', () => {
    const ctx = auditWith({ links: { other: 'x' } });
    expect(ctx.todos).toHaveLength(1);
    expect(reasons(ctx)).toContain("'links.tips', which is not in");
    expect(reasons(ctx)).not.toContain('not a string');
  });

  it("a computed key's static prefix is checked for presence, not renderability", () => {
    // The prefix names a namespace, so an object is exactly what belongs
    // there; the leaf rule must not turn every prefix into "NOT in".
    const ctx = auditWith(
      { links: { step: { a: 'One' } } },
      [
        "import { useTranslations } from 'gt-next';",
        'export function View({ i }: { i: number }) {',
        "  const t = useTranslations('links');",
        '  return <p>{t(`step.${i}`)}</p>;',
        '}',
      ].join('\n')
    );
    // react-i18next reports its own computed sites, so this adapter adds none;
    // what matters is that no "prefix is NOT in" claim appears either.
    expect(reasons(ctx)).not.toContain('NOT in');
  });
});

describe('gt-next leaf semantics', () => {
  it('accepts exactly the DictionaryLeaf shapes', () => {
    expect(isRenderableLeaf('hello')).toBe(true);
    expect(isRenderableLeaf(['hello'])).toBe(true);
    expect(isRenderableLeaf(['hello', { $context: 'x' }])).toBe(true);
    expect(isRenderableLeaf(['hello', {}])).toBe(true);
    expect(isRenderableLeaf(['a', 'b'])).toBe(false);
    expect(isRenderableLeaf(['a', { $maxChars: 'no' }])).toBe(false);
    expect(isRenderableLeaf(['a', 'b', 'c'])).toBe(false);
    expect(isRenderableLeaf([])).toBe(false);
    expect(isRenderableLeaf({ a: 'x' })).toBe(false);
    expect(isRenderableLeaf(null)).toBe(false);
    expect(isRenderableLeaf(7)).toBe(false);
  });

  it('does not walk INTO an array, exactly as gt-next does not', () => {
    // gt-next's path walker rejects a non-object at every level, so t('tips.0')
    // throws rather than resolving the element.
    expect(resolveDictionaryKey({ tips: ['a', 'b'] }, 'tips.0')).toEqual({
      kind: 'missing',
    });
  });

  it('pins the shape permissiveness this change did NOT touch', () => {
    // A flat dotted leaf inside a namespace object still counts as resolved,
    // as it has since the audit was written. Narrowing it would raise new
    // "missing key" claims on all three adapters, so it is a separate call.
    expect(resolveDictionaryKey({ UI: { 'a.b': 'x' } }, 'UI.a.b')).toEqual({
      kind: 'renderable',
    });
  });

  it('describes what is there in words a TODO can use', () => {
    expect(describeDictionaryValue(['a'])).toBe('an array (1 entry)');
    expect(describeDictionaryValue({})).toBe('a nested object (0 keys)');
    expect(describeDictionaryValue(true)).toBe('a boolean');
  });
});
