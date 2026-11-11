import path from 'node:path';
import { expect, test } from 'vitest';
import * as esbuild from 'esbuild';
import { paraglideContextEsbuild } from '../../lib/compiler/plugins/esbuild.js';
import {
  greetingIn,
  readSnippets,
  useGreeting,
  writeProject,
} from './fixture.js';

test("esbuild: bundled and unbundled files, the build's alias", async () => {
  const root = await writeProject('esbuild', {
    'src/main.ts': `import { text } from "./bundled.js";\nconsole.log(text);\n`,
    'src/bundled.ts': useGreeting('@i18n/messages.js'),
    'src/other.ts': useGreeting('./paraglide/messages.js'),
  });
  await esbuild.build({
    absWorkingDir: root,
    entryPoints: ['src/main.ts'],
    bundle: true,
    write: false,
    outdir: 'dist',
    logLevel: 'silent',
    alias: { '@i18n': './src/paraglide' },
    plugins: [paraglideContextEsbuild({ enabled: true }) as never],
  });
  expect(await readSnippets(root)).toEqual([
    greetingIn('src/bundled.ts'),
    greetingIn('src/other.ts'),
  ]);
});
