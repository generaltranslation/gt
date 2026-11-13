// The CLI's analysis in worker threads, which run the built package: these
// tests need `dist` (CI builds it before testing).
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, test } from 'vitest';
import { writeProject } from '../helpers/fixture.js';

const CLI = path.resolve(
  import.meta.dirname,
  '../../dist/src/compiler/cli/index.js'
);

const run = promisify(execFile);

/** Many modules pass messages to a function of another: the threads load each other's modules. */
function pages(count: number): Record<string, string> {
  return Object.fromEntries(
    Array.from({ length: count }, (_, index) => [
      `src/pages/page${index}.ts`,
      [
        `import { m } from "../paraglide/messages.js";`,
        `import { show } from "../show.js";`,
        `import { label${(index + 1) % count} } from "./page${(index + 1) % count}.js";`,
        `export const label${index} = (text: () => string) => show(text);`,
        index % 3 === 0
          ? `export const title${index} = label${(index + 1) % count}(m.greeting);`
          : `export const title${index} = label${(index + 1) % count}(() => "plain");`,
      ].join('\n'),
    ])
  );
}

async function collectWith(
  root: string,
  threads: number
): Promise<{ metadata: string; log: string }> {
  const metadataFile = path.join(root, 'messages/en.metadata.json');
  await fs.rm(metadataFile, { force: true });

  const { stdout, stderr } = await run(
    process.execPath,
    [CLI, root, '--verbose'],
    { env: { ...process.env, PARAGLIDE_CONTEXT_THREADS: String(threads) } }
  );

  return {
    metadata: await fs.readFile(metadataFile, 'utf8'),
    log: stdout + stderr,
  };
}

describe.skipIf(!existsSync(CLI))('analysis threads', () => {
  test('write what the main thread writes, for scripts and generated components', async () => {
    const root = await writeProject('threads', {
      'src/show.ts': `export function show(label: () => string) { return label(); }\n`,
      ...pages(40),
      'src/Card.vue': `<script setup>\nimport { m } from "./paraglide/messages.js";\nimport { show } from "./show.js";\n</script>\n<template><p>{{ show(m.greeting) }}</p></template>\n`,
      'src/Card.svelte': `<script>\n  import { m } from "./paraglide/messages.js";\n</script>\n<p title={m.greeting()}></p>\n`,
      'app/page.astro': `---\nimport { m } from "../src/paraglide/messages.js";\n---\n<p>{m.greeting()}</p>\n`,
      // The Vue tooling's TypeScript imports from "vue", which an app has installed.
      'node_modules/vue/package.json': `{ "name": "vue", "main": "index.js" }`,
      'node_modules/vue/index.js': '',
    });

    const inMainThread = await collectWith(root, 0);
    const inThreads = await collectWith(root, 2);

    expect(inMainThread.metadata).toContain('src/Card.vue');
    expect(inMainThread.metadata).toContain('src/show.ts');
    expect(inThreads).toEqual(inMainThread);
  });
});
