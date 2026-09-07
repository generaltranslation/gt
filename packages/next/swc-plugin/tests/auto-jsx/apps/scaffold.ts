import path from 'node:path';
import { mkdir, readdir, realpath, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { cliNextOutput, cliOutput } from '../cli-oracle';
import { createFixtureError } from '../diagnostics.mjs';
import { states, type ParityApp } from './types';

export const drivers = ['swc', 'compiler', 'cli'] as const;
export type Driver = (typeof drivers)[number];

async function write(directory: string, name: string, content: string) {
  const target = path.resolve(directory, name);
  if (!target.startsWith(`${directory}${path.sep}`))
    throw createFixtureError({
      whatHappened: `Invalid app source path: ${name}`,
    });
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
}

/** Merge scoped dependencies without replacing fixture packages or writing through links. */
async function linkDependencies(source: string, destination: string) {
  await mkdir(destination, { recursive: true });
  const existing = new Set(await readdir(destination));
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.name.startsWith('@')) {
      await linkDependencies(from, to);
    } else if (!existing.has(entry.name)) {
      await symlink(await realpath(from), to, 'junction');
    }
  }
}

function commonRoot(directories: string[]) {
  let root = directories[0];
  while (
    directories.some((directory) => !directory.startsWith(`${root}${path.sep}`))
  ) {
    const parent = path.dirname(root);
    if (parent === root) return root;
    root = parent;
  }
  return root;
}

export async function scaffold(
  directory: string,
  app: ParityApp,
  driver: Driver,
  repository: string,
  sourceApp: string
) {
  const require = createRequire(path.join(sourceApp, 'package.json'));
  const nextRoot = path.dirname(
    await realpath(require.resolve('next/package.json'))
  );
  const nextRequire = createRequire(path.join(nextRoot, 'package.json'));
  const styledRoot = path.dirname(
    await realpath(nextRequire.resolve('styled-jsx/package.json'))
  );
  const appFiles = { ...app.files };

  const stateSource = JSON.stringify(states);
  const harness = `'use client';
import { useState } from 'react';
import { Suite } from './Suite';
const states = ${stateSource};
export function Harness() {
  const [index, setIndex] = useState(0);
  return <><nav aria-label="Fixture controls">{states.map((state, next) => <button key={state.name} data-state={state.name} onClick={() => setIndex(next)}>{state.name}</button>)}</nav><div ref={node => { if (node) node.setAttribute('data-hydrated', 'true'); }} data-active-state={states[index].name}><Suite {...states[index]} /></div></>;
}
`;
  const scaffoldFiles: Record<string, string> = {
    'package.json': JSON.stringify(
      {
        name: `gt-parity-${app.name}-${driver}`,
        private: true,
        dependencies: {
          next: require('next/package.json').version,
          react: require('react/package.json').version,
          'react-dom': require('react-dom/package.json').version,
          'gt-next': 'workspace:*',
          '@generaltranslation/compiler': 'workspace:*',
          'styled-jsx': nextRequire('styled-jsx/package.json').version,
        },
      },
      null,
      2
    ),
    'tsconfig.json': JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2020',
          lib: ['dom', 'dom.iterable', 'esnext'],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: 'esnext',
          moduleResolution: 'bundler',
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: 'preserve',
          ...(app.jsxImportSource !== undefined && {
            jsxImportSource: app.jsxImportSource,
          }),
          incremental: true,
        },
        include: ['next-env.d.ts', 'src/**/*', 'app/**/*', 'pages/**/*'],
        exclude: ['node_modules', 'oracle'],
      },
      null,
      2
    ),
    'getLocale.js': `export async function getLocale() { return 'en'; }\n`,
    'src/Harness.tsx': harness,
    'next.config.js': `const { withGTConfig } = require('gt-next/config');
const fixture = ${app.nextConfig || '({})'};
const reactRoot = require('node:path').dirname(require.resolve('react/package.json'));
const reactDomRoot = require('node:path').dirname(require.resolve('react-dom/package.json'));
module.exports = withGTConfig({
  ...fixture,
  turbopack: { ...fixture.turbopack, root: ${JSON.stringify(commonRoot([directory, repository, nextRoot]))},
    ${app.router === 'pages' ? `resolveAlias: { ...fixture.turbopack?.resolveAlias, react: './node_modules/react', 'react-dom': './node_modules/react-dom', 'react/jsx-runtime': './node_modules/react/jsx-runtime.js', 'react/jsx-dev-runtime': './node_modules/react/jsx-dev-runtime.js' },` : ''}
  },
  distDir: process.env.GT_PARITY_DIST,
  reactStrictMode: false,
  devIndicators: false,
  typescript: { ignoreBuildErrors: true },
  experimental: { ...fixture.experimental, cpus: 1 },
  ${
    app.router === 'pages'
      ? `webpack(config, options) {
    // Linked workspace packages must share the app's React instance in Pages Router.
    config.resolve.alias = { ...config.resolve.alias, 'react$': reactRoot, 'react-dom$': reactDomRoot, 'react/jsx-runtime$': require.resolve('react/jsx-runtime'), 'react/jsx-dev-runtime$': require.resolve('react/jsx-dev-runtime') };
    return fixture.webpack ? fixture.webpack(config, options) : config;
  },`
      : ''
  }
}, {
  defaultLocale: 'en', locales: ['en'], getLocalePath: './getLocale.js',
  runtimeUrl: null, cacheUrl: null, _tagIds: true,
  experimentalCompilerOptions: {
    type: ${JSON.stringify(driver === 'compiler' ? 'babel' : 'swc')},
    enableAutoJsxInjection: ${driver !== 'cli'},
    disableBuildChecks: true, compileTimeHash: false,
    enableMacroTransform: false, autoderive: false,
  },
});
`,
  };
  if (app.router === 'pages') {
    scaffoldFiles['pages/_app.tsx'] = `import { GTProvider } from 'gt-next';
export default function App({ Component, pageProps }) { return <GTProvider locale="en" defaultLocale="en" locales={['en']} _tagIds={true}><Component {...pageProps} /></GTProvider>; }\n`;
    scaffoldFiles['pages/index.tsx'] =
      `import { Harness } from '../src/Harness';
export default function Page() { return <Harness />; }\n`;
    scaffoldFiles['pages/server.tsx'] = `import { Suite } from '../src/Suite';
export function getServerSideProps({ query }) { return { props: { index: Math.min(2, Math.max(0, Number(query.state) || 0)) } }; }
export default function Page({ index }) { return <Suite {...${stateSource}[index]} />; }\n`;
  } else {
    scaffoldFiles['app/layout.tsx'] = `import { GTProvider } from 'gt-next';
${app.layoutWrapper ? `import { FixtureRegistry } from ${JSON.stringify(`../${app.layoutWrapper.replace(/^\.\//, '')}`)};` : ''}
export default function Layout({ children }) { return <html lang="en"><head><link rel="icon" href="data:," /></head><body>${app.layoutWrapper ? '<FixtureRegistry>' : ''}<GTProvider>{children}</GTProvider>${app.layoutWrapper ? '</FixtureRegistry>' : ''}</body></html>; }\n`;
    scaffoldFiles['app/page.tsx'] = `import { Harness } from '../src/Harness';
export default function Page() { return <Harness />; }\n`;
    scaffoldFiles['app/server/page.tsx'] =
      `import { Suite } from '../../src/Suite';
export const dynamic = 'force-dynamic';
export default async function Page({ searchParams }) { const query = await searchParams; const index = Math.min(2, Math.max(0, Number(query.state) || 0)); return <Suite {...${stateSource}[index]} />; }\n`;
  }
  // Fixture packages are ordinary owned directories; shared scopes are merged afterwards.
  // Let the real CLI resolver discover physical project configuration before
  // preprocessing each file. Fixture package configs can have their own scope.
  for (const [name, source] of Object.entries({
    ...scaffoldFiles,
    ...app.files,
  }))
    if (name.endsWith('.json')) await write(directory, name, source);
  for (const [name, original] of Object.entries(app.files)) {
    if (driver !== 'cli') continue;
    const context = { file: path.join(directory, name) };
    // Preserve both the actual extraction output and the Next-only helper import adapter.
    if (/\.[cm]?[jt]sx?$/.test(name) && !name.startsWith('loaders/')) {
      await write(
        directory,
        `oracle/cli/${name}`,
        cliOutput(original, context)
      );
      appFiles[name] = cliNextOutput(original, context);
    } else if (name.endsWith('.raw')) {
      const resource = JSON.parse(original);
      await write(
        directory,
        `oracle/cli/${name}.tsx`,
        cliOutput(resource.source, context)
      );
      appFiles[name] = JSON.stringify({
        ...resource,
        source: cliNextOutput(resource.source, context),
      });
    }
  }
  for (const [name, source] of Object.entries({
    ...scaffoldFiles,
    ...appFiles,
  }))
    await write(directory, name, source);
  await linkDependencies(
    path.join(sourceApp, 'node_modules'),
    path.join(directory, 'node_modules')
  );
  await linkDependencies(
    path.dirname(nextRoot),
    path.join(directory, 'node_modules')
  );
  // Next's development Pages runtime may externalize through the app-relative
  // styled-jsx path, so its declared client-only dependency must also resolve there.
  await linkDependencies(
    path.dirname(styledRoot),
    path.join(directory, 'node_modules')
  );
  const scoped = path.join(directory, 'node_modules/@generaltranslation');
  await mkdir(scoped, { recursive: true });
  if (!(await readdir(scoped)).includes('compiler'))
    await symlink(
      path.join(repository, 'packages/compiler'),
      path.join(scoped, 'compiler'),
      'junction'
    );
  const appRequire = createRequire(path.join(directory, 'package.json'));
  const resolution = Object.fromEntries(
    await Promise.all(
      [
        'gt-next',
        'gt-next/config',
        '@generaltranslation/compiler',
        'next/package.json',
        'react/package.json',
      ].map(async (specifier) => [
        specifier,
        await realpath(appRequire.resolve(specifier)),
      ])
    )
  );
  for (const specifier of [
    'gt-next',
    'gt-next/config',
    '@generaltranslation/compiler',
  ]) {
    if (!resolution[specifier].startsWith(`${repository}/packages/`))
      throw createFixtureError({
        whatHappened: `${specifier} resolved outside this checkout`,
        details: resolution[specifier],
      });
  }
  return {
    resolution,
    nextBinary: path.join(nextRoot, 'dist/bin/next'),
    nextVersion: require('next/package.json').version,
  };
}
