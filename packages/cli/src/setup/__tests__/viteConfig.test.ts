import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addCompilerPlugin } from '../buildTools/shared/viteConfig.js';

// The create-start template's vite.config.ts.
const tanstackConfig = `import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'

const config = defineConfig({
  plugins: [
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
`;

const configuredTanstackConfig = `import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import { vite as gtCompiler } from '@generaltranslation/compiler'

const config = defineConfig({
  plugins: [
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tanstackStart(),
    viteReact(),
    gtCompiler(),
  ],
})

export default config
`;

// The create-vite react-ts template's vite.config.ts.
const viteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
});
`;

const configuredViteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { vite as gtCompiler } from '@generaltranslation/compiler';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), gtCompiler()],
});
`;

describe('addCompilerPlugin', () => {
  let appDirectory: string;
  const file = (name: string) => path.join(appDirectory, name);
  const read = (name: string) => fs.readFileSync(file(name), 'utf8');
  const write = (name: string, content: string) =>
    fs.writeFileSync(file(name), content);

  beforeEach(() => {
    appDirectory = fs.mkdtempSync(path.join(tmpdir(), 'gt-vite-config-'));
  });

  afterEach(() => {
    fs.rmSync(appDirectory, { recursive: true, force: true });
  });

  it('adds the compiler after tanstackStart() in the file’s own style', async () => {
    write('vite.config.ts', tanstackConfig);

    const result = await addCompilerPlugin(appDirectory);

    expect(read('vite.config.ts')).toBe(configuredTanstackConfig);
    expect(result).toEqual({
      steps: ['added gtCompiler() to vite.config.ts'],
      manualActions: [],
    });
  });

  it('adds the compiler to a single-line plugin list', async () => {
    write('vite.config.ts', viteConfig);

    await addCompilerPlugin(appDirectory);

    expect(read('vite.config.ts')).toBe(configuredViteConfig);
  });

  it('changes nothing when the compiler already runs after tanstackStart()', async () => {
    write('vite.config.ts', configuredTanstackConfig);

    const result = await addCompilerPlugin(appDirectory);

    expect(read('vite.config.ts')).toBe(configuredTanstackConfig);
    expect(result).toEqual({ steps: [], manualActions: [] });
  });

  it('keeps an aliased compiler import and adds only its call', async () => {
    write(
      'vite.config.mts',
      `import { defineConfig } from "vite"
import { vite as gtPlugin } from "@generaltranslation/compiler"

export default defineConfig({ plugins: [] })
`
    );

    await addCompilerPlugin(appDirectory);

    expect(read('vite.config.mts')).toBe(`import { defineConfig } from "vite"
import { vite as gtPlugin } from "@generaltranslation/compiler"

export default defineConfig({ plugins: [gtPlugin()] })
`);
  });

  it('asks to move a compiler that runs before tanstackStart()', async () => {
    const config = configuredTanstackConfig
      .replace('    gtCompiler(),\n', '')
      .replace(
        '    tanstackStart(),\n',
        '    gtCompiler(),\n    tanstackStart(),\n'
      );
    write('vite.config.ts', config);

    const result = await addCompilerPlugin(appDirectory);

    expect(read('vite.config.ts')).toBe(config);
    expect(result.steps).toEqual([]);
    expect(result.manualActions).toEqual([
      expect.objectContaining({
        whatHappened: expect.stringContaining('before tanstackStart()'),
      }),
    ]);
  });

  it('asks to pass a config the compiler would not find on its own', async () => {
    write('vite.config.ts', viteConfig);

    const result = await addCompilerPlugin(appDirectory, 'config/gt.json');

    expect(read('vite.config.ts')).toBe(configuredViteConfig);
    expect(result).toEqual({
      steps: ['added gtCompiler() to vite.config.ts'],
      manualActions: [
        {
          whatHappened:
            'The GT compiler reads gt.config.json from the app root, but this app uses config/gt.json',
          fix: "In vite.config.ts, import gtConfig from './config/gt.json' and pass it as gtCompiler({ gtConfig })",
        },
      ],
    });
  });

  it.each([
    ['no Vite config', undefined],
    [
      'a plugins list it cannot edit',
      "import { defineConfig } from 'vite'\nimport { plugins } from './plugins'\n\nexport default defineConfig({ plugins })\n",
    ],
    [
      'a function config',
      "import { defineConfig } from 'vite'\n\nexport default defineConfig(() => ({ plugins: [] }))\n",
    ],
    [
      'a gtCompiler binding of its own',
      "import { defineConfig } from 'vite'\nimport gtCompiler from './gt'\n\nexport default defineConfig({ plugins: [gtCompiler()] })\n",
    ],
  ])('reports a manual action for %s', async (_, content) => {
    if (content) write('vite.config.ts', content);

    const result = await addCompilerPlugin(appDirectory);

    if (content) expect(read('vite.config.ts')).toBe(content);
    expect(result.steps).toEqual([]);
    expect(result.manualActions).toEqual([
      {
        whatHappened: expect.any(String),
        fix: expect.stringContaining(
          "import { vite as gtCompiler } from '@generaltranslation/compiler'"
        ),
      },
    ]);
  });
});
