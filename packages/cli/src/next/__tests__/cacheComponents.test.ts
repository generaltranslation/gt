import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getCacheComponentsManualFix,
  isCacheComponentsEnabled,
  migrateToCacheComponents,
  resolveCacheComponentsSetup,
  type CacheComponentsSetup,
} from '../cacheComponents.js';

let cwd: string;

function write(file: string, content = '') {
  fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
  fs.writeFileSync(path.join(cwd, file), content);
}

const read = (file: string) => fs.readFileSync(path.join(cwd, file), 'utf8');
const exists = (file: string) => fs.existsSync(path.join(cwd, file));

const LAYOUT = `import './globals.css';
export default function RootLayout({ children }: LayoutProps<'/'>) {
  return <html lang="en"><body>{children}</body></html>;
}
`;

function resolve() {
  if (!exists('next.config.ts')) write('next.config.ts', 'export default {};');
  return resolveCacheComponentsSetup(cwd, path.join(cwd, 'next.config.ts'));
}

async function migrate(typescript = true) {
  const setup = resolve();
  expect(setup?.mode).toBe('migrate');
  return migrateToCacheComponents(
    cwd,
    setup as Extract<CacheComponentsSetup, { mode: 'migrate' }>,
    typescript
  );
}

beforeEach(() => {
  cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-cache-components-'));
});

afterEach(() => {
  fs.rmSync(cwd, { recursive: true, force: true });
});

describe('isCacheComponentsEnabled', () => {
  it.each([
    ['top-level', 'export default { cacheComponents: true };', true],
    [
      'typed config',
      "import type { NextConfig } from 'next';\nconst nextConfig: NextConfig = { cacheComponents: true };\nexport default nextConfig;",
      true,
    ],
    ['disabled', 'export default { cacheComponents: false };', false],
    ['missing', 'export default {};', false],
    ['unparsable', 'export default {', false],
  ])('%s', (_name, code, expected) => {
    write('next.config.ts', code);
    expect(isCacheComponentsEnabled(path.join(cwd, 'next.config.ts'))).toBe(
      expected
    );
  });
});

describe('resolveCacheComponentsSetup', () => {
  it.each([
    ['an existing proxy', ['app/layout.tsx', 'proxy.ts']],
    ['an existing .mjs proxy', ['app/layout.tsx', 'proxy.mjs']],
    ['an existing middleware', ['src/app/layout.tsx', 'src/middleware.js']],
    ['an existing getRegion', ['app/layout.tsx', 'getRegion.ts']],
    ['no root layout', ['app/(a)/layout.tsx', 'app/(b)/layout.tsx']],
    ['a dynamic root segment', ['app/layout.tsx', 'app/[lang]/page.tsx']],
  ])('asks for manual setup with %s', (_name, files) => {
    files.forEach((file) => write(file, 'export default 1;'));
    expect(resolve()).toMatchObject({ mode: 'manual' });
  });

  it('asks for manual setup when typedRoutes is enabled', () => {
    write('app/layout.tsx', LAYOUT);
    write('next.config.ts', 'export default { typedRoutes: true };');
    expect(resolve()).toMatchObject({ mode: 'manual' });
  });

  it('asks for manual setup when a moved file cannot be parsed', () => {
    write('app/layout.tsx', LAYOUT);
    write('app/about/page.tsx', 'export default (');
    expect(resolve()).toMatchObject({ mode: 'manual' });
  });

  it('asks for manual setup when a moved MDX page has relative imports', () => {
    write('app/layout.tsx', LAYOUT);
    write('app/blog/page.mdx', "import Note from './note.mdx';\n\n# Blog\n");
    expect(resolve()).toMatchObject({ mode: 'manual' });
  });

  it('leaves apps with custom request functions alone', () => {
    write('app/[locale]/layout.tsx');
    write('getLocale.ts');
    expect(resolve()).toBeUndefined();
  });
});

describe('getCacheComponentsManualFix', () => {
  it('names the src paths and the existing proxy', () => {
    write('src/app/layout.tsx', LAYOUT);
    write('src/proxy.ts');
    const setup = resolve();
    expect(setup).toMatchObject({
      mode: 'manual',
      reason: `${path.join('src', 'proxy.ts')} already exists`,
    });
    const fix = getCacheComponentsManualFix(
      setup as Extract<CacheComponentsSetup, { mode: 'manual' }>
    );
    expect(fix).toContain('src/app/[locale]');
    expect(fix).toContain('add src/getLocale.ts');
    expect(fix).toContain('in src/proxy.ts');
    expect(fix).toContain(
      'https://generaltranslation.com/docs/react/nextjs/cache-components'
    );
  });
});

describe('migrateToCacheComponents', () => {
  it('migrates a fresh template app', async () => {
    write('src/app/layout.tsx', LAYOUT);
    write('src/app/page.tsx', 'export default function Page() {}\n');
    write('src/app/globals.css');
    write('src/app/favicon.ico');

    const written = await migrate();

    expect(written.map((file) => path.relative(cwd, file)).sort()).toEqual([
      'src/app/[locale]/layout.tsx',
      'src/getLocale.ts',
      'src/getRegion.ts',
      'src/proxy.ts',
    ]);
    expect(exists('src/app/[locale]/page.tsx')).toBe(true);
    expect(exists('src/app/layout.tsx')).toBe(false);
    expect(exists('src/app/globals.css')).toBe(true);
    expect(exists('src/app/favicon.ico')).toBe(true);
    expect(read('src/app/[locale]/layout.tsx')).toBe(
      `import '../globals.css';
import { getLocales } from 'gt-next';
export default function RootLayout({ children }: LayoutProps<'/[locale]'>) {
  return <html lang="en"><body>{children}</body></html>;
}

export function generateStaticParams() {
  return getLocales().map((locale) => ({ locale }));
}
`
    );
    expect(read('src/getLocale.ts')).toContain(
      "import { locale } from 'next/root-params';"
    );
    expect(read('src/proxy.ts')).toContain(
      "matcher: ['/((?!api|static|.*\\\\..*|_next).*)']"
    );
  });

  it('moves route folders and keeps root-only files and code folders in place', async () => {
    write('tsconfig.json', '{"compilerOptions":{"paths":{"@/*":["./*"]}}}');
    write('app/layout.tsx', LAYOUT);
    write('app/not-found.tsx', 'export default function NotFound() {}\n');
    write('app/global-error.tsx', 'export default function E() {}\n');
    write('app/sitemap.ts', 'export default function sitemap() {}\n');
    write('app/opengraph-image.tsx', 'export default function I() {}\n');
    write('app/api/hello/route.ts', 'export function GET() {}\n');
    write('app/lib/data.ts', 'export const data = 1;\n');
    write('app/_components/nav.tsx', 'export function Nav() {}\n');
    write('app/docs/page.mdx', '# Docs\n');
    write(
      'app/(marketing)/about/page.tsx',
      `import { data } from '../../lib/data';
import { Nav } from '@/app/_components/nav';
export default function About(props: PageProps<'/about'>) {}
`
    );
    write(
      'app/blog/[slug]/page.tsx',
      `import styles from './post.module.css';
export default async function Post() {}
`
    );
    write(
      'components/links.tsx',
      `export { default as About } from '../app/(marketing)/about/page';
export { default as Post } from '@/app/blog/[slug]/page';
`
    );

    await migrate();

    for (const file of [
      'app/[locale]/layout.tsx',
      'app/[locale]/not-found.tsx',
      'app/[locale]/(marketing)/about/page.tsx',
      'app/[locale]/blog/[slug]/page.tsx',
      'app/[locale]/docs/page.mdx',
      'app/global-error.tsx',
      'app/sitemap.ts',
      'app/opengraph-image.tsx',
      'app/api/hello/route.ts',
      'app/lib/data.ts',
      'app/_components/nav.tsx',
    ]) {
      expect(exists(file), file).toBe(true);
    }
    expect(read('app/[locale]/(marketing)/about/page.tsx')).toBe(
      `import { data } from '../../../lib/data';
import { Nav } from '@/app/_components/nav';
export default function About(props: PageProps<'/[locale]/about'>) {}
`
    );
    expect(read('app/[locale]/blog/[slug]/page.tsx')).toContain(
      "from './post.module.css'"
    );
    expect(read('components/links.tsx')).toBe(
      `export { default as About } from '../app/[locale]/(marketing)/about/page';
export { default as Post } from '@/app/[locale]/blog/[slug]/page';
`
    );
  });

  it('fails before moving user files when a target file exists', async () => {
    write('app/layout.tsx', LAYOUT);
    write('app/page.tsx', 'export default function Page() {}\n');
    const setup = resolve();
    write('proxy.ts', 'export default function proxy() {}\n');

    await expect(
      migrateToCacheComponents(
        cwd,
        setup as Extract<CacheComponentsSetup, { mode: 'migrate' }>,
        true
      )
    ).rejects.toThrow('EEXIST');
    expect(exists('app/layout.tsx')).toBe(true);
    expect(exists('app/page.tsx')).toBe(true);
  });

  it('writes JavaScript files at the project root without a src directory', async () => {
    write('app/layout.jsx', 'export default function RootLayout() {}\n');
    write('app/page.jsx', 'export default function Page() {}\n');

    await migrate(false);

    for (const file of [
      'app/[locale]/layout.jsx',
      'app/[locale]/page.jsx',
      'getLocale.js',
      'getRegion.js',
      'proxy.js',
    ]) {
      expect(exists(file), file).toBe(true);
    }
  });
});
