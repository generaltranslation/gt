import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configureGTVitePlugin } from '../buildTools/shared/viteConfig.js';
import { Libraries } from '../../types/libraries.js';

const VITE_CONFIG = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
`;
const CONFIGURED = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { gtReact } from 'gt-react/vite'

export default defineConfig({
  plugins: [react(), gtReact()],
})
`;

describe('configureGTVitePlugin', () => {
  let appDirectory: string;
  const file = (name: string) => path.join(appDirectory, name);
  const read = (name: string) => fs.readFileSync(file(name), 'utf8');
  const write = (name: string, content: string) => {
    fs.mkdirSync(path.dirname(file(name)), { recursive: true });
    fs.writeFileSync(file(name), content);
  };
  const installGTReact = (exports: Record<string, string>) =>
    write(
      'node_modules/gt-react/package.json',
      JSON.stringify({ name: 'gt-react', exports })
    );

  beforeEach(() => {
    appDirectory = fs.mkdtempSync(path.join(tmpdir(), 'gt-vite-config-'));
  });

  afterEach(() => {
    fs.rmSync(appDirectory, { recursive: true, force: true });
  });

  it('adds the import and call, and leaves a configured file alone on a rerun', async () => {
    installGTReact({ '.': './index.mjs', './vite': './vite.mjs' });
    write('vite.config.ts', VITE_CONFIG);

    expect(
      await configureGTVitePlugin(appDirectory, Libraries.GT_REACT, false)
    ).toEqual({
      steps: ['configured vite.config.ts'],
      manualActions: [],
    });
    expect(read('vite.config.ts')).toBe(CONFIGURED);

    expect(
      await configureGTVitePlugin(appDirectory, Libraries.GT_REACT, false)
    ).toEqual({
      steps: [],
      manualActions: [],
    });
    expect(read('vite.config.ts')).toBe(CONFIGURED);
  });

  it.each([
    [Libraries.GT_VUE, 'gtVue'],
    [Libraries.GT_SVELTE, 'gtSvelte'],
  ] as const)('adds the %s plugin', async (runtime, name) => {
    write(
      `node_modules/${runtime}/package.json`,
      JSON.stringify({ name: runtime, exports: { './vite': './vite.js' } })
    );
    write('vite.config.ts', VITE_CONFIG);

    expect(await configureGTVitePlugin(appDirectory, runtime, false)).toEqual({
      steps: ['configured vite.config.ts'],
      manualActions: [],
    });
    expect(read('vite.config.ts')).toBe(
      CONFIGURED.replace(
        "import { gtReact } from 'gt-react/vite'",
        `import { ${name} } from '${runtime}/vite'`
      ).replace('gtReact()]', `${name}()]`)
    );
  });

  it('reuses an existing import instead of adding another', async () => {
    installGTReact({ './vite': './vite.mjs' });
    write(
      'vite.config.ts',
      VITE_CONFIG.replace(
        "import react from '@vitejs/plugin-react'",
        "import react from '@vitejs/plugin-react'\nimport { gtReact as gt } from 'gt-react/vite'"
      )
    );

    await configureGTVitePlugin(appDirectory, Libraries.GT_REACT, false);

    expect(read('vite.config.ts')).toBe(
      CONFIGURED.replace(
        "import { gtReact } from 'gt-react/vite'",
        "import { gtReact as gt } from 'gt-react/vite'"
      ).replace('gtReact()]', 'gt()]')
    );
  });

  it.each([
    ['is installed without the Vite plugin', { '.': './index.mjs' }],
    ['is declared but not installed', undefined],
  ])('leaves the config unchanged when gt-react %s', async (_, exports) => {
    if (exports) installGTReact(exports);
    write('vite.config.ts', VITE_CONFIG);

    const { steps, manualActions } = await configureGTVitePlugin(
      appDirectory,
      Libraries.GT_REACT,
      false
    );

    expect(read('vite.config.ts')).toBe(VITE_CONFIG);
    expect(steps).toEqual([]);
    expect(manualActions).toEqual([
      {
        whatHappened: expect.stringContaining('No installed gt-react'),
        fix: expect.stringContaining('Install or upgrade gt-react to 12'),
      },
    ]);
  });

  it('reports the plugin without writing it when app source is kept', async () => {
    installGTReact({ './vite': './vite.mjs' });
    write('vite.config.ts', VITE_CONFIG);

    expect(
      await configureGTVitePlugin(appDirectory, Libraries.GT_REACT, true)
    ).toEqual({
      steps: [],
      manualActions: [
        {
          whatHappened: 'vite.config.ts was not configured automatically',
          fix: expect.stringContaining('add gtReact() to the plugins'),
        },
      ],
    });
    expect(read('vite.config.ts')).toBe(VITE_CONFIG);

    write('vite.config.ts', CONFIGURED);
    expect(
      await configureGTVitePlugin(appDirectory, Libraries.GT_REACT, true)
    ).toEqual({
      steps: [],
      manualActions: [],
    });
  });

  it.each([
    ['no Vite config', undefined, 'No vite.config was found'],
    [
      'a config without a plugins array',
      'export default { plugins: getPlugins() }\n',
      'vite.config.ts was not configured automatically',
    ],
  ])('reports a manual step for %s', async (_, content, whatHappened) => {
    installGTReact({ './vite': './vite.mjs' });
    if (content) write('vite.config.ts', content);

    expect(
      await configureGTVitePlugin(appDirectory, Libraries.GT_REACT, false)
    ).toEqual({
      steps: [],
      manualActions: [
        {
          whatHappened,
          fix: expect.stringContaining(
            "import { gtReact } from 'gt-react/vite' and add gtReact() to the plugins of defineConfig"
          ),
        },
      ],
    });
    if (content) expect(read('vite.config.ts')).toBe(content);
  });
});
