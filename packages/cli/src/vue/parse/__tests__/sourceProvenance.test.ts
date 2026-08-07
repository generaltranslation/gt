import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createVueInlineUpdates } from '../createVueInlineUpdates.js';

const parsingFlags = {
  autoderive: false,
  enableAutoJsxInjection: false,
  includeSourceCodeContext: false,
  legacyGtReactImportSource: false,
};

const temporaryDirectories: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

describe('Vue CLI source provenance', () => {
  it('ignores React-valid syntax and unrelated installed hooks', async () => {
    const projectRoot = createProject();
    write(
      projectRoot,
      'src/ReactView.ts',
      `import { T, msg, useGT, useMessages } from 'gt-react';
       const gt = useGT();
       const m = useMessages();
       gt('React function');
       m(msg('React message'));
       export const View = () => <T>React rich text</T>;`
    );
    write(
      projectRoot,
      'src/typed.js',
      `import { useGT } from 'gt-react';
       const gt = useGT();
       export const label: string = gt('React typed JavaScript');`
    );
    write(
      projectRoot,
      'src/theme.tsx',
      `import { useGT as useThemeGT } from '@theme/gt';
       const themeGT = useThemeGT();
       themeGT('Ordinary aliased helper');
       export const Theme = () => <div>Theme</div>;`
    );
    const themeHelperPath = path.join(projectRoot, 'src', 'theme-gt.ts');
    write(
      projectRoot,
      'src/theme-gt.ts',
      `export function useGT() {
         return (source: string) => source;
       }`
    );
    write(
      projectRoot,
      'vite.config.ts',
      `import react from '@vitejs/plugin-react';
       import { defineConfig } from 'vite';
       export default defineConfig(({ command }) => {
         const config = {
           plugins: [react()],
           resolve: {
             alias: { '@theme/gt': ${JSON.stringify(themeHelperPath)} },
           },
         };
         if (command === 'serve') return config;
         return { ...config, build: { sourcemap: true } };
       });`
    );
    write(
      projectRoot,
      'src/ordinary.ts',
      `import { useGT } from 'unrelated-hooks';
       const ordinary = useGT();
       ordinary('Not a translation');`
    );
    write(
      projectRoot,
      'node_modules/unrelated-hooks/package.json',
      JSON.stringify({ main: 'index.cjs', name: 'unrelated-hooks' })
    );
    write(
      projectRoot,
      'node_modules/unrelated-hooks/index.cjs',
      `exports.useGT = () => (value) => value;`
    );
    write(
      projectRoot,
      'src/ordinary-esm.ts',
      `import { useGT } from 'unrelated-esm';
       const ordinary = useGT();
       ordinary('Also not a translation');`
    );
    write(
      projectRoot,
      'node_modules/unrelated-esm/package.json',
      JSON.stringify({
        exports: './index.js',
        name: 'unrelated-esm',
        type: 'module',
      })
    );
    write(
      projectRoot,
      'node_modules/unrelated-esm/index.js',
      `export function useGT() { return (value) => value; }`
    );
    write(
      projectRoot,
      'src/i18n.ts',
      `export { msg as defineMessage } from 'gt-vue';`
    );
    write(
      projectRoot,
      'src/mixed-runtime.ts',
      `import { msg } from 'gt-vue';
       void msg;
       export function ordinary() { return 'ordinary'; }`
    );
    write(
      projectRoot,
      'src/mixed-consumer.tsx',
      `import { ordinary } from './mixed-runtime';
       import { useGT } from '@missing/gt';
       ordinary();
       const gt = useGT();
       gt('Ordinary mixed-module helper');`
    );
    write(
      projectRoot,
      'src/mixed-typed.js',
      `import { ordinary } from './mixed-runtime';
       export const label: string = ordinary();`
    );
    write(
      projectRoot,
      'src/vue-message.ts',
      `import { defineMessage } from './i18n';
       defineMessage('Vue message');`
    );
    vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);

    const output = await createVueInlineUpdates(undefined, parsingFlags, {
      conditionNames: ['import', 'default'],
    });

    expect(output.errors).toEqual([]);
    expect(output.warnings).toEqual([]);
    expect(output.updates.map(({ source }) => source)).toEqual(['Vue message']);
  });

  it('ignores unresolved GT-shaped aliases without file-level ownership', async () => {
    const projectRoot = createProject();
    write(
      projectRoot,
      'src/unresolved.ts',
      `import { useGT } from '@missing/gt';
       const gt = useGT();
       gt('Unresolved');`
    );
    vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);

    const output = await createVueInlineUpdates(undefined, parsingFlags, {
      conditionNames: ['import', 'default'],
    });

    expect(output.updates).toEqual([]);
    expect(output.errors).toEqual([]);
  });

  it('keeps unresolved aliases fail-closed in a proven gt-vue file', async () => {
    const projectRoot = createProject();
    write(
      projectRoot,
      'src/unresolved.ts',
      `import { msg } from 'gt-vue';
       import { useGT } from '@missing/gt';
       void msg;
       const gt = useGT();
       gt('Unresolved');`
    );
    vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);

    const output = await createVueInlineUpdates(undefined, parsingFlags, {
      conditionNames: ['import', 'default'],
    });

    expect(output.updates).toEqual([]);
    expect(output.errors).toEqual([
      expect.stringContaining('possible gt-vue string function alias'),
    ]);
  });
});

/** Creates one temporary project whose default source globs select `src`. */
function createProject(): string {
  const projectRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'gt-vue-provenance-')
  );
  temporaryDirectories.push(projectRoot);
  write(
    projectRoot,
    'package.json',
    JSON.stringify({
      dependencies: { 'gt-vue': '0.0.0' },
      devDependencies: {
        '@vitejs/plugin-react': 'latest',
        vite: 'latest',
      },
      private: true,
    })
  );
  return projectRoot;
}

/** Writes one fixture file and creates its parent directories. */
function write(
  projectRoot: string,
  relativePath: string,
  source: string
): void {
  const filePath = path.join(projectRoot, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, source);
}
