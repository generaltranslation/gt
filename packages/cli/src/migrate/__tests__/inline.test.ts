import { describe, expect, it } from 'vitest';
import { inlinePass } from '../inline.js';
import type {
  MessageCatalogs,
  MigrationContext,
  RoutingInfo,
} from '../types.js';
import { nextIntlAdapter } from '../adapters/nextIntl.js';

const routing: RoutingInfo = {
  locales: ['en', 'es'],
  defaultLocale: 'en',
  localePrefix: null,
  pathnames: null,
  routingFile: null,
  requestFile: null,
};

function makeContext(messages: Record<string, unknown>): MigrationContext {
  const catalogs: MessageCatalogs = {
    defaultLocale: 'en',
    locales: ['en', 'es'],
    byLocale: { en: messages, es: {} },
    dir: '/project/messages',
  };
  return {
    cwd: '/project',
    catalogs,
    routing,
    edits: [],
    todos: [],
    skippedFiles: new Map(),
    stats: {},
    adapter: nextIntlAdapter,
  };
}

// inlinePass runs on already-compat-migrated code (gt-next imports).
describe('inlinePass', () => {
  it('inlines a pure-text message and wraps the element in <T>', () => {
    const ctx = makeContext({ Home: { title: 'Welcome to my app' } });
    const result = inlinePass(
      'src/app/page.tsx',
      [
        "import { useTranslations } from 'gt-next';",
        'export default function Page() {',
        "  const t = useTranslations('Home');",
        "  return <h1>{t('title')}</h1>;",
        '}',
      ].join('\n'),
      ctx
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).toContain('<T>');
    expect(result.code).toContain('Welcome to my app');
    expect(result.code).not.toContain("t('title')");
    expect(result.code).toMatch(/import \{.*T.*\} from ["']gt-next["']/);
  });

  it('classifies through ctx.adapter.classifyMessage, not the module import', () => {
    // A stub adapter that reports this pure-text message as non-text. The inline
    // pass must consult the adapter's (source-format-specific) classifier, so
    // the key stays on the dictionary path instead of being inlined. Before the
    // seam wiring this used the module-level classifier and inlined it.
    const ctx = makeContext({ Home: { title: 'Welcome to my app' } });
    ctx.adapter = {
      ...nextIntlAdapter,
      classifyMessage: () => ({ kind: 'args', argNames: [] }),
    };
    const result = inlinePass(
      'src/app/page.tsx',
      [
        "import { useTranslations } from 'gt-next';",
        'export default function Page() {',
        "  const t = useTranslations('Home');",
        "  return <h1>{t('title')}</h1>;",
        '}',
      ].join('\n'),
      ctx
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).toBeNull();
  });

  it('inlines every eligible sibling call in the same element', () => {
    const ctx = makeContext({
      Home: { staticA: 'First text', staticB: 'Second text' },
    });
    const result = inlinePass(
      'src/app/page.tsx',
      [
        "import { useTranslations } from 'gt-next';",
        'export default function Page() {',
        "  const t = useTranslations('Home');",
        "  return <p>{t('staticA')} | {t('staticB')}</p>;",
        '}',
      ].join('\n'),
      ctx
    );
    expect(result.skipReasons).toEqual([]);
    expect(result.code).toContain('First text');
    expect(result.code).toContain('Second text');
    expect(result.code).not.toContain("t('staticA')");
    expect(result.code).not.toContain("t('staticB')");
    // one wrap around the shared parent, not nested <T><T>
    expect(result.code!.match(/<T>/g)).toHaveLength(1);
    expect(ctx.stats.inlined).toBe(2);
  });

  it('removes the hook and import when the last t use is inlined', () => {
    const ctx = makeContext({ Home: { title: 'Hello' } });
    const result = inlinePass(
      'src/app/page.tsx',
      [
        "import { useTranslations } from 'gt-next';",
        'export default function Page() {',
        "  const t = useTranslations('Home');",
        "  return <h1>{t('title')}</h1>;",
        '}',
      ].join('\n'),
      ctx
    );
    expect(result.code).not.toContain('useTranslations');
  });

  it('keeps the hook when other keys remain in dictionary mode', () => {
    const ctx = makeContext({
      Home: { title: 'Hello', greeting: 'Hi, {name}!' },
    });
    const result = inlinePass(
      'src/app/page.tsx',
      [
        "import { useTranslations } from 'gt-next';",
        'export default function Page({ name }: { name: string }) {',
        "  const t = useTranslations('Home');",
        '  return (',
        '    <div>',
        "      <h1>{t('title')}</h1>",
        "      <p>{t('greeting', { name })}</p>",
        '    </div>',
        '  );',
        '}',
      ].join('\n'),
      ctx
    );
    expect(result.code).toContain('Hello');
    expect(result.code).toContain("t('greeting', { name })");
    expect(result.code).toContain('useTranslations');
  });

  it('leaves attribute-position strings on the dictionary path', () => {
    const ctx = makeContext({ Home: { hint: 'Enter your email' } });
    const result = inlinePass(
      'src/app/page.tsx',
      [
        "import { useTranslations } from 'gt-next';",
        'export default function Page() {',
        "  const t = useTranslations('Home');",
        "  return <input placeholder={t('hint')} />;",
        '}',
      ].join('\n'),
      ctx
    );
    expect(result.code).toBeNull();
    expect(ctx.stats.inlineCandidatesRemaining).toBe(1);
  });

  it('does not double-wrap inside an existing <T>', () => {
    const ctx = makeContext({ Home: { title: 'Hello' } });
    const result = inlinePass(
      'src/app/page.tsx',
      [
        "import { T, useTranslations } from 'gt-next';",
        'export default function Page() {',
        "  const t = useTranslations('Home');",
        '  return (',
        '    <T>',
        "      <h1>{t('title')}</h1>",
        '    </T>',
        '  );',
        '}',
      ].join('\n'),
      ctx
    );
    expect(result.code).toContain('Hello');
    expect((result.code!.match(/<T>/g) ?? []).length).toBe(1);
  });
});
