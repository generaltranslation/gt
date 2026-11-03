import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getCacheComponentsManualFix,
  isCacheComponentsEnabled,
  migrateToCacheComponents,
  resolveCacheComponentsSetup,
  rewriteMovedRootFile,
} from '../cacheComponents.js';

let cwd: string;

function write(file: string, content = '') {
  fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
  fs.writeFileSync(path.join(cwd, file), content);
}

const read = (file: string) => fs.readFileSync(path.join(cwd, file), 'utf8');

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
  it('migrates a fresh template app', () => {
    write('src/app/layout.tsx');
    write('src/app/page.tsx');
    write('src/app/globals.css');
    write('src/app/favicon.ico');
    expect(resolveCacheComponentsSetup(cwd)).toEqual({
      mode: 'migrate',
      appDir: path.join('src', 'app'),
      layout: path.join('src', 'app', 'layout.tsx'),
      page: path.join('src', 'app', 'page.tsx'),
    });
  });

  it.each([
    ['route folders', ['app/layout.tsx', 'app/page.tsx', 'app/about/page.tsx']],
    ['other route files', ['app/layout.tsx', 'app/page.tsx', 'app/error.tsx']],
    ['an existing proxy', ['app/layout.tsx', 'app/page.tsx', 'proxy.ts']],
    [
      'an existing middleware',
      ['src/app/layout.tsx', 'src/app/page.tsx', 'src/middleware.js'],
    ],
    ['an existing .mjs proxy', ['app/layout.tsx', 'app/page.tsx', 'proxy.mjs']],
    [
      'an existing getRegion',
      ['app/layout.tsx', 'app/page.tsx', 'getRegion.ts'],
    ],
    ['no root page', ['app/layout.tsx']],
  ])('asks for manual setup with %s', (_name, files) => {
    files.forEach((file) => write(file));
    expect(resolveCacheComponentsSetup(cwd)).toMatchObject({
      mode: 'manual',
    });
  });

  it('leaves apps with custom request functions alone', () => {
    write('app/[locale]/layout.tsx');
    write('getLocale.ts');
    expect(resolveCacheComponentsSetup(cwd)).toBeUndefined();
  });
});

describe('getCacheComponentsManualFix', () => {
  it('names the src paths and the existing proxy', () => {
    write('src/app/layout.tsx');
    write('src/app/about/page.tsx');
    write('src/proxy.ts');
    const setup = resolveCacheComponentsSetup(cwd);
    expect(setup).toMatchObject({
      mode: 'manual',
      reason: `${path.join('src', 'proxy.ts')} already exists`,
    });
    const fix = getCacheComponentsManualFix(
      setup as Extract<typeof setup, { mode: 'manual' }>
    );
    expect(fix).toContain('src/app/[locale]');
    expect(fix).toContain('add src/getLocale.ts');
    expect(fix).toContain('in src/proxy.ts');
    expect(fix).toContain(
      'https://generaltranslation.com/docs/react/nextjs/cache-components'
    );
  });
});

describe('rewriteMovedRootFile', () => {
  it('moves relative imports and typed route props one level deeper', () => {
    const code = `import './globals.css';
import styles from './page.module.css';
import { Nav } from '../components/nav';
import { Button } from '@/components/button';
export * from './shared';
const lazy = import('./lazy');
export default function Layout({ children }: LayoutProps<'/'>) {}
type Props = PageProps<'/'>;
`;
    expect(rewriteMovedRootFile(code)).toBe(`import '../globals.css';
import styles from '../page.module.css';
import { Nav } from '../../components/nav';
import { Button } from '@/components/button';
export * from '../shared';
const lazy = import('../lazy');
export default function Layout({ children }: LayoutProps<'/[locale]'>) {}
type Props = PageProps<'/[locale]'>;
`);
  });
});

describe('migrateToCacheComponents', () => {
  it('moves the root files and writes request functions and a proxy', async () => {
    write(
      'src/app/layout.tsx',
      "import './globals.css';\nexport default function RootLayout({ children }: LayoutProps<'/'>) {\n  return <html lang=\"en\"><body>{children}</body></html>;\n}\n"
    );
    write('src/app/page.tsx', 'export default function Page() {}\n');

    const written = await migrateToCacheComponents(
      cwd,
      {
        mode: 'migrate',
        appDir: 'src/app',
        layout: 'src/app/layout.tsx',
        page: 'src/app/page.tsx',
      },
      true
    );

    expect(written.map((file) => path.relative(cwd, file))).toEqual([
      'src/getLocale.ts',
      'src/getRegion.ts',
      'src/proxy.ts',
      'src/app/[locale]/layout.tsx',
      'src/app/[locale]/page.tsx',
    ]);
    expect(fs.existsSync(path.join(cwd, 'src/app/layout.tsx'))).toBe(false);
    expect(fs.existsSync(path.join(cwd, 'src/app/page.tsx'))).toBe(false);

    const layout = read('src/app/[locale]/layout.tsx');
    expect(layout).toMatch(
      /^import '\.\.\/globals\.css';\nimport \{ getLocales \} from 'gt-next';\nexport default/
    );
    expect(layout).toContain("LayoutProps<'/[locale]'>");
    expect(layout).toContain('export function generateStaticParams()');
    expect(read('src/getLocale.ts')).toContain(
      "import { locale } from 'next/root-params';"
    );
    expect(read('src/proxy.ts')).toContain(
      "matcher: ['/((?!api|static|.*\\\\..*|_next).*)']"
    );
  });

  it('fails before moving user files when a target file exists', async () => {
    write('app/layout.tsx', 'export default function RootLayout() {}\n');
    write('app/page.tsx', 'export default function Page() {}\n');
    write('proxy.ts', 'export default function proxy() {}\n');

    await expect(
      migrateToCacheComponents(
        cwd,
        {
          mode: 'migrate',
          appDir: 'app',
          layout: 'app/layout.tsx',
          page: 'app/page.tsx',
        },
        true
      )
    ).rejects.toThrow('EEXIST');
    expect(fs.existsSync(path.join(cwd, 'app/layout.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(cwd, 'app/page.tsx'))).toBe(true);
  });

  it('writes JavaScript files at the project root without a src directory', async () => {
    write('app/layout.jsx', 'export default function RootLayout() {}\n');
    write('app/page.jsx', 'export default function Page() {}\n');

    await migrateToCacheComponents(
      cwd,
      {
        mode: 'migrate',
        appDir: 'app',
        layout: 'app/layout.jsx',
        page: 'app/page.jsx',
      },
      false
    );

    for (const file of [
      'app/[locale]/layout.jsx',
      'app/[locale]/page.jsx',
      'getLocale.js',
      'getRegion.js',
      'proxy.js',
    ]) {
      expect(fs.existsSync(path.join(cwd, file))).toBe(true);
    }
  });
});
