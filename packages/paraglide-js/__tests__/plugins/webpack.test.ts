import path from 'node:path';
import { describe, expect, test } from 'vitest';
import webpack from 'webpack';
import { rspack } from '@rspack/core';
import { ParaglideContextWebpackPlugin } from '../../lib/compiler/plugins/webpack.js';
import {
  greetingIn,
  readSnippets,
  useGreeting,
  writeProject,
} from './fixture.js';

type Bundler = 'webpack' | 'rspack';

function build(
  bundler: Bundler,
  root: string,
  config: Record<string, unknown> = {}
) {
  const options = {
    context: root,
    mode: 'development' as const,
    devtool: false as const,
    entry: './src/main.ts',
    output: { path: path.join(root, 'dist') },
    resolve: {
      extensions: ['.ts', '.js'],
      extensionAlias: { '.js': ['.ts', '.js'] },
    },
    infrastructureLogging: { level: 'none' as const },
    plugins: [new ParaglideContextWebpackPlugin({ enabled: true })],
    ...config,
  };
  const compiler = (
    bundler === 'webpack' ? webpack(options as never) : rspack(options as never)
  ) as {
    run(
      callback: (
        error: Error | null,
        stats?: { hasErrors(): boolean; toString(): string }
      ) => void
    ): void;
    close(callback: () => void): void;
  };
  return new Promise<void>((resolve, reject) =>
    compiler.run((error, stats) => {
      compiler.close(() => {});
      if (error) reject(error);
      else if (stats?.hasErrors()) reject(new Error(stats.toString()));
      else resolve();
    })
  );
}

describe.each<Bundler>(['webpack', 'rspack'])('%s', (bundler) => {
  test('records usages in bundled and unbundled files', async () => {
    const root = await writeProject(`${bundler}-basic`, {
      'src/main.ts': `import { text } from "./bundled.js";\nconsole.log(text);\n`,
      'src/bundled.ts': useGreeting('./paraglide/messages.js'),
      // Not imported: found through `include` (the whole project).
      'src/other.ts': useGreeting('./paraglide/messages.js'),
    });
    await build(bundler, root);
    expect(await readSnippets(root)).toEqual([
      greetingIn('src/bundled.ts'),
      greetingIn('src/other.ts'),
    ]);
  });

  test("resolves with the compiler's resolve.alias", async () => {
    const root = await writeProject(`${bundler}-alias`, {
      'src/main.ts': useGreeting('@i18n/messages.js'),
    });
    await build(bundler, root, {
      resolve: {
        extensions: ['.ts', '.js'],
        alias: { '@i18n': path.join(root, 'src/paraglide') },
      },
    });
    expect(await readSnippets(root)).toEqual([greetingIn('src/main.ts')]);
  });

  test('loaded files outside the project are analyzed', async () => {
    const root = await writeProject(`${bundler}-outside`, {
      'app/package.json': `{ "name": "web", "type": "module" }`,
      'app/src/main.ts': `import { text } from "../../shared/text.js";\nconsole.log(text);\n`,
      'shared/text.ts': useGreeting('../src/paraglide/messages.js'),
    });
    await build(bundler, path.join(root, 'app'), {
      output: { path: path.join(root, 'app/dist') },
    });
    // The inlang project is above the app; sources are relative to the app.
    expect(await readSnippets(root)).toEqual([greetingIn('../shared/text.ts')]);
  });
});

test('webpack watch mode updates the file', async () => {
  const fs = await import('node:fs/promises');
  const root = await writeProject('webpack-watch', {
    'src/main.ts': useGreeting('./paraglide/messages.js'),
  });
  const compiler = webpack({
    context: root,
    mode: 'development',
    devtool: false,
    entry: './src/main.ts',
    output: { path: path.join(root, 'dist') },
    resolve: {
      extensions: ['.ts', '.js'],
      extensionAlias: { '.js': ['.ts', '.js'] },
    },
    infrastructureLogging: { level: 'none' },
    plugins: [new ParaglideContextWebpackPlugin({ enabled: true }) as never],
  });
  let builds = 0;
  let notify: (() => void) | undefined;
  const watching = compiler.watch({ aggregateTimeout: 20 }, () => {
    builds++;
    notify?.();
  });
  const nextBuild = () => new Promise<void>((resolve) => (notify = resolve));
  await nextBuild();
  expect(await readSnippets(root)).toEqual([greetingIn('src/main.ts')]);

  await fs.writeFile(
    path.join(root, 'src/main.ts'),
    `import { m } from "./paraglide/messages.js";\nexport const a = m.greeting();\nexport const b = m.greeting();\n`
  );
  await nextBuild();
  expect(await readSnippets(root)).toEqual([
    'src/main.ts: export const a = m.greeting();',
    'src/main.ts: export const b = m.greeting();',
  ]);
  expect(builds).toBe(2);
  await new Promise((resolve) => watching!.close(resolve));
});
