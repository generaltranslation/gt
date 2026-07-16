import { describe, expect, it } from 'vitest';
import { inlinePass } from '../inline.js';
import type { MessageCatalogs, MigrationContext, RoutingInfo } from '../types.js';

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
