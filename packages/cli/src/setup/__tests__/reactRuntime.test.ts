import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  detectReactRuntime,
  setupReactRuntime,
  updateReactRouterSsrRoot,
} from '../reactRuntime.js';

const tempDirectories: string[] = [];

function createTempDirectory(): string {
  const tempDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'gt-react-runtime-')
  );
  tempDirectories.push(tempDirectory);
  return tempDirectory;
}

afterEach(() => {
  for (const tempDirectory of tempDirectories.splice(0)) {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
});

describe('detectReactRuntime', () => {
  it('distinguishes a React Router SPA from its default SSR mode', () => {
    const spaDirectory = createTempDirectory();
    fs.mkdirSync(path.join(spaDirectory, 'app'));
    fs.writeFileSync(
      path.join(spaDirectory, 'app/root.tsx'),
      'export default function App() { return <main />; }'
    );
    fs.writeFileSync(
      path.join(spaDirectory, 'react-router.config.ts'),
      'export default { ssr: false };'
    );
    const packageJson = { devDependencies: { '@react-router/dev': '^7.0.0' } };

    expect(detectReactRuntime('vite', packageJson, spaDirectory)).toEqual({
      kind: 'spa',
    });

    fs.writeFileSync(
      path.join(spaDirectory, 'react-router.config.ts'),
      'export default { ssr: true };'
    );
    expect(detectReactRuntime('vite', packageJson, spaDirectory)).toEqual({
      kind: 'ssr',
      framework: 'react-router',
      rootPath: 'app/root.tsx',
    });

    fs.rmSync(path.join(spaDirectory, 'react-router.config.ts'));
    expect(detectReactRuntime('vite', packageJson, spaDirectory)).toEqual({
      kind: 'ssr',
      framework: 'react-router',
      rootPath: 'app/root.tsx',
    });

    fs.writeFileSync(
      path.join(spaDirectory, 'react-router.config.ts'),
      'export default { ssr: process.env.ENABLE_SSR === "true" };'
    );
    expect(detectReactRuntime('vite', packageJson, spaDirectory)).toMatchObject(
      {
        kind: 'unsupported-ssr',
        reason: expect.stringContaining('determines ssr dynamically'),
      }
    );
  });
});

describe('updateReactRouterSsrRoot', () => {
  it('adds the v11 SSR lifecycle while preserving the root component', () => {
    const code = `
import { Links, Outlet, Scripts } from 'react-router';

const preserved = 'user code';

export default function App() {
  return (
    <main data-value={preserved}>
      <Outlet />
      <Links />
      <Scripts />
    </main>
  );
}
`;

    const result = updateReactRouterSsrRoot({
      code,
      rootPath: '/project/app/root.tsx',
      configPath: '/project/gt.config.json',
      loadTranslationsPath: '/project/loadTranslations.js',
    });

    expect(result.changed).toBe(true);
    expect(result.warning).toBeUndefined();
    expect(result.code).toMatch(
      /import \{ GTProvider, getTranslationsSnapshot, initializeGT, parseLocale \} from ['"]gt-react['"];/
    );
    expect(result.code).toMatch(
      /import gtConfig from ['"]\.\.\/gt\.config\.json['"];/
    );
    expect(result.code).toMatch(
      /import loadTranslations from ['"]\.\.\/loadTranslations\.js['"];/
    );
    expect(result.code).toContain('initializeGT({');
    expect(result.code).toContain('const locale = parseLocale(request);');
    expect(result.code).toContain(
      'translations: await getTranslationsSnapshot(locale)'
    );
    expect(result.code).toContain('useLoaderData<typeof loader>()');
    expect(result.code).toContain(
      '<GTProvider locale={locale} translations={translations}>'
    );
    expect(result.code).toContain('<main data-value={preserved}>');
  });

  it('supports JavaScript roots without adding TypeScript syntax', () => {
    const result = updateReactRouterSsrRoot({
      code: `import { Outlet } from 'react-router';
export default function App() { return <Outlet />; }`,
      rootPath: '/project/app/root.jsx',
      configPath: '/project/gt.config.json',
      loadTranslationsPath: '/project/loadTranslations.js',
    });

    expect(result.changed).toBe(true);
    expect(result.code).toMatch(
      /export async function loader\(\{\s*request\s*\}\)/
    );
    expect(result.code).not.toContain('request: Request');
  });

  it('uses the configured CDN when no local translation loader exists', () => {
    const result = updateReactRouterSsrRoot({
      code: `import { Outlet } from 'react-router';
export default function App() { return <Outlet />; }`,
      rootPath: '/project/app/root.tsx',
      configPath: '/project/gt.config.json',
    });

    expect(result.changed).toBe(true);
    expect(result.code).toContain(`initializeGT({
  ...gtConfig
});`);
    expect(result.code).not.toContain('loadTranslations');
  });

  it('is idempotent after completing the SSR setup', () => {
    const input = `import { Outlet } from 'react-router';
export default function App() { return <Outlet />; }`;
    const first = updateReactRouterSsrRoot({
      code: input,
      rootPath: '/project/app/root.tsx',
      configPath: '/project/gt.config.json',
      loadTranslationsPath: '/project/loadTranslations.js',
    });
    const second = updateReactRouterSsrRoot({
      code: first.code,
      rootPath: '/project/app/root.tsx',
      configPath: '/project/gt.config.json',
      loadTranslationsPath: '/project/loadTranslations.js',
    });

    expect(second).toEqual({ code: first.code, changed: false });
  });
});

describe('setupReactRuntime fallback behavior', () => {
  it('preserves an existing root loader and gives actionable SSR guidance', async () => {
    const cwd = createTempDirectory();
    fs.mkdirSync(path.join(cwd, 'app'));
    const rootPath = path.join(cwd, 'app/root.tsx');
    const originalCode = `import { Outlet } from 'react-router';
export async function loader() { return { user: 'Ernest' }; }
export default function App() { return <Outlet />; }`;
    fs.writeFileSync(rootPath, originalCode);
    fs.writeFileSync(path.join(cwd, 'gt.config.json'), '{}');

    const result = await setupReactRuntime({
      framework: 'vite',
      packageJson: {
        devDependencies: { '@react-router/dev': '^7.0.0' },
      },
      cwd,
    });

    expect(fs.readFileSync(rootPath, 'utf8')).toBe(originalCode);
    expect(result.filesUpdated).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('already exports a loader');
    expect(result.warnings[0]).toContain('initializeGT()');
    expect(result.warnings[0]).toContain('getTranslationsSnapshot(locale)');
    expect(result.warnings[0]).toContain(
      'https://generaltranslation.com/docs/react/react-quickstart'
    );
  });

  it('preserves root bindings that would conflict with generated data', () => {
    const code = `import { Outlet } from 'react-router';
export default function App() {
  const locale = 'custom';
  return <Outlet />;
}`;

    const result = updateReactRouterSsrRoot({
      code,
      rootPath: '/project/app/root.tsx',
      configPath: '/project/gt.config.json',
    });

    expect(result.changed).toBe(false);
    expect(result.code).toBe(code);
    expect(result.warning).toContain('already declares "locale"');
  });

  it('follows finalized local and remote translation storage', async () => {
    const createProject = () => {
      const cwd = createTempDirectory();
      fs.mkdirSync(path.join(cwd, 'app'));
      fs.writeFileSync(
        path.join(cwd, 'app/root.tsx'),
        `import { Outlet } from 'react-router';
export default function App() { return <Outlet />; }`
      );
      fs.writeFileSync(
        path.join(cwd, 'gt.config.json'),
        '{"files":{"gt":{"output":"src/_gt/[locale].json"}}}'
      );
      fs.writeFileSync(
        path.join(cwd, 'loadTranslations.js'),
        'export default async function loadTranslations() { return {}; }'
      );
      return cwd;
    };
    const localCwd = createProject();
    const remoteCwd = createProject();
    const packageJson = { devDependencies: { '@react-router/dev': '^7.0.0' } };

    await setupReactRuntime({
      framework: 'vite',
      packageJson,
      translationStorage: 'local',
      cwd: localCwd,
    });
    await setupReactRuntime({
      framework: 'vite',
      packageJson,
      translationStorage: 'remote',
      cwd: remoteCwd,
    });

    expect(
      fs.readFileSync(path.join(localCwd, 'app/root.tsx'), 'utf8')
    ).toContain("import loadTranslations from '../loadTranslations.js';");
    expect(
      fs.readFileSync(path.join(remoteCwd, 'app/root.tsx'), 'utf8')
    ).not.toContain('loadTranslations');
  });

  it('leaves React Router SPAs untouched without SSR guidance', async () => {
    const cwd = createTempDirectory();
    fs.mkdirSync(path.join(cwd, 'app'));
    fs.writeFileSync(
      path.join(cwd, 'app/root.tsx'),
      'export default function App() { return <main />; }'
    );
    fs.writeFileSync(
      path.join(cwd, 'react-router.config.ts'),
      'export default { ssr: false };'
    );

    await expect(
      setupReactRuntime({
        framework: 'vite',
        packageJson: {
          devDependencies: { '@react-router/dev': '^7.0.0' },
        },
        cwd,
      })
    ).resolves.toEqual({ filesUpdated: [], warnings: [] });
  });
});
