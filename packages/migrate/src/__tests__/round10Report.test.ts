import { describe, expect, it } from 'vitest';
import { buildReport } from '../report/report.js';
import { nextIntlAdapter } from '../adapters/nextIntl.js';
import type {
  MessageCatalogs,
  MigrationContext,
  RoutingInfo,
} from '../pipeline/types.js';

const SWAPPED_MIDDLEWARE = [
  "import { createNextMiddleware } from 'gt-next/middleware';",
  'export default createNextMiddleware();',
].join('\n');

/** What the swap emits for next-intl's default and 'always' localePrefix. */
const PREFIXED_MIDDLEWARE = [
  "import { createNextMiddleware } from 'gt-next/middleware';",
  'export default createNextMiddleware({ prefixDefaultLocale: true });',
].join('\n');

function makeContext(
  overrides: Partial<MigrationContext> = {},
  routingOverrides: Partial<RoutingInfo> = {}
): MigrationContext {
  const catalogs: MessageCatalogs = {
    defaultLocale: 'en',
    locales: ['en', 'es'],
    byLocale: { en: {}, es: {} },
    dir: '/project/messages',
  };
  return {
    cwd: '/project',
    catalogs,
    routing: {
      locales: ['en', 'es'],
      defaultLocale: 'en',
      localePrefix: null,
      pathnames: null,
      routingFile: null,
      requestFile: null,
      ...routingOverrides,
    },
    edits: [],
    todos: [],
    skippedFiles: new Map(),
    stats: {},
    adapter: nextIntlAdapter,
    ...overrides,
  };
}

function behaviorSection(report: string): string {
  return (
    report
      .split('## Behavior differences to know about')[1]
      ?.split('\n## ')[0] ?? ''
  );
}

describe('r10 finding 7: the lost hreflang Link headers are disclosed', () => {
  it('names the loss when the middleware was swapped', () => {
    const ctx = makeContext({
      edits: [
        {
          path: '/project/src/middleware.ts',
          kind: 'write',
          content: SWAPPED_MIDDLEWARE,
        },
      ],
    });
    const section = behaviorSection(buildReport(ctx, false, false));
    expect(section).toMatch(/hreflang/);
    expect(section).toMatch(/`Link` headers/);
    expect(section).toMatch(/x-default/);
    expect(section).toMatch(/RFC 8288/);
  });

  it('says nothing about hreflang when no middleware was swapped', () => {
    const ctx = makeContext({
      edits: [
        {
          path: '/project/src/app/page.tsx',
          kind: 'write',
          content: 'export default function Page() { return null; }',
        },
      ],
    });
    expect(behaviorSection(buildReport(ctx, false, false))).not.toMatch(
      /hreflang/
    );
  });
});

describe('r10 finding 6: the extra root redirect hop is disclosed', () => {
  const middlewareCtx = (content: string) =>
    makeContext({
      edits: [{ path: '/project/src/middleware.ts', kind: 'write', content }],
    });

  it('names both hops when the swapped middleware prefixes the default locale', () => {
    const section = behaviorSection(
      buildReport(middlewareCtx(PREFIXED_MIDDLEWARE), false, false)
    );
    // The measured shape: 307 to /en/, then a 308 to /en, against a baseline
    // single 307 (reproduced on four migrated apps).
    expect(section).toMatch(/`\/` now redirects twice/);
    expect(section).toContain('307');
    expect(section).toContain('308');
    expect(section).toContain('`/en/`');
    // Severity stays honest: the landing URL and the page are the same.
    expect(section).toMatch(/unchanged/);
    expect(section).toContain('createNextMiddleware');
  });

  it('says nothing when the middleware does not prefix the default locale', () => {
    const section = behaviorSection(
      buildReport(middlewareCtx(SWAPPED_MIDDLEWARE), false, false)
    );
    // 'as-needed' serves `/` directly, so there is no root redirect to disclose.
    expect(section).not.toMatch(/redirects twice/);
  });

  it('says nothing when no middleware was swapped', () => {
    const section = behaviorSection(
      buildReport(
        middlewareCtx('export default function Page() { return null; }'),
        false,
        false
      )
    );
    expect(section).not.toMatch(/redirects twice/);
  });
});

describe('r10 finding 5: duplicate default-locale URLs are disclosed', () => {
  it("names the duplicate URLs for 'as-needed'", () => {
    const ctx = makeContext(
      {
        edits: [
          {
            path: '/project/src/middleware.ts',
            kind: 'write',
            content: SWAPPED_MIDDLEWARE,
          },
        ],
      },
      { localePrefix: 'as-needed' }
    );
    const section = behaviorSection(buildReport(ctx, false, false));
    expect(section).toMatch(/\/en\/about/);
    expect(section).toMatch(/redirect/i);
    expect(section).toMatch(/canonical/i);
    // Both halves of the measured remedy (see round10AsNeeded.test.ts).
    expect(section).toContain('`/en` to `/`');
    expect(section).toContain('`/en/:path+` to `/:path+`');
  });

  it("says nothing about duplicate URLs for 'always'", () => {
    const ctx = makeContext(
      {
        edits: [
          {
            path: '/project/src/middleware.ts',
            kind: 'write',
            content: SWAPPED_MIDDLEWARE,
          },
        ],
      },
      { localePrefix: 'always' }
    );
    expect(behaviorSection(buildReport(ctx, false, false))).not.toMatch(
      /two URLs/
    );
  });
});

describe('r10 finding 10: gt generate is not described as translating', () => {
  it('says the no-key path writes source-language templates', () => {
    const report = buildReport(makeContext(), false, false);
    const steps = report.split('## Next steps')[1] ?? '';
    expect(steps).toMatch(/gt generate/);
    // The claim that must be gone: `gt generate` "translates" the new locales.
    expect(steps).not.toMatch(/generate`[^.]*to translate new locales/);
    expect(steps).toMatch(/source-language/);
    expect(steps).toMatch(/gt translate/);
  });
});
