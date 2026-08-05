import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { determineLibrary } from '../../fs/determineFramework/index.js';
import { Libraries } from '../../types/libraries.js';
import { createInlineUpdatesForLibraries } from '../createInlineUpdatesForLibrary.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

describe('workspace inline source discovery', () => {
  it('extracts every framework selected from declared workspace packages', async () => {
    const projectRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'gt-mixed-workspace-')
    );
    temporaryDirectories.push(projectRoot);
    writeJson(path.join(projectRoot, 'package.json'), {
      private: true,
      workspaces: ['apps/*'],
    });

    const reactDirectory = path.join(projectRoot, 'apps', 'react');
    fs.mkdirSync(path.join(reactDirectory, 'src'), { recursive: true });
    writeJson(path.join(reactDirectory, 'package.json'), {
      dependencies: { 'gt-react': '0.0.0' },
    });
    fs.writeFileSync(
      path.join(reactDirectory, 'src', 'App.tsx'),
      `import { T } from 'gt-react';
export function App() {
  return <T>React workspace</T>;
}`
    );

    const vueDirectory = path.join(projectRoot, 'apps', 'vue');
    fs.mkdirSync(path.join(vueDirectory, 'src'), { recursive: true });
    writeJson(path.join(vueDirectory, 'package.json'), {
      dependencies: { 'gt-vue': '0.0.0' },
    });
    fs.writeFileSync(
      path.join(vueDirectory, 'src', 'App.vue'),
      `<script setup>
import { useGT } from 'gt-vue';
const gt = useGT();
gt('Vue workspace');
</script>`
    );
    vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);

    expect(determineLibrary()).toEqual({
      library: Libraries.GT_REACT,
      additionalModules: [Libraries.GT_VUE],
    });

    const output = await createInlineUpdatesForLibraries(
      [Libraries.GT_REACT, Libraries.GT_VUE],
      false,
      undefined,
      {
        autoderive: false,
        enableAutoJsxInjection: false,
        includeSourceCodeContext: false,
        legacyGtReactImportSource: false,
      },
      { conditionNames: ['import', 'default'] }
    );

    expect(output.errors).toEqual([]);
    expect(output.updates.map((update) => update.source).sort()).toEqual([
      'React workspace',
      'Vue workspace',
    ]);
  });

  it.skipIf(process.platform === 'win32')(
    'does not read React workspace sources through outside symlinks',
    async () => {
      const projectRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), 'gt-react-symlink-workspace-')
      );
      const outsideDirectory = fs.mkdtempSync(
        path.join(os.tmpdir(), 'gt-react-outside-')
      );
      temporaryDirectories.push(projectRoot, outsideDirectory);
      writeJson(path.join(projectRoot, 'package.json'), {
        private: true,
        workspaces: ['apps/*'],
      });

      const directoryLinkApp = path.join(projectRoot, 'apps', 'directory');
      fs.mkdirSync(directoryLinkApp, { recursive: true });
      writeJson(path.join(directoryLinkApp, 'package.json'), {
        dependencies: { 'gt-react': '0.0.0' },
      });
      fs.writeFileSync(
        path.join(outsideDirectory, 'Directory.tsx'),
        `import { T } from 'gt-react'; export const App = () => <T>Outside directory</T>;`
      );
      fs.symlinkSync(
        outsideDirectory,
        path.join(directoryLinkApp, 'src'),
        'dir'
      );

      const fileLinkApp = path.join(projectRoot, 'apps', 'file');
      fs.mkdirSync(path.join(fileLinkApp, 'src'), { recursive: true });
      writeJson(path.join(fileLinkApp, 'package.json'), {
        dependencies: { 'gt-react': '0.0.0' },
      });
      const outsideFile = path.join(outsideDirectory, 'File.tsx');
      fs.writeFileSync(
        outsideFile,
        `import { T } from 'gt-react'; export const App = () => <T>Outside file</T>;`
      );
      fs.symlinkSync(outsideFile, path.join(fileLinkApp, 'src', 'App.tsx'));
      vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);

      const output = await createInlineUpdatesForLibraries(
        [Libraries.GT_REACT],
        false,
        undefined,
        {
          autoderive: false,
          enableAutoJsxInjection: false,
          includeSourceCodeContext: false,
          legacyGtReactImportSource: false,
        },
        { conditionNames: ['import', 'default'] }
      );

      expect(output).toEqual({ updates: [], errors: [], warnings: [] });
    }
  );
});

function writeJson(file: string, value: unknown): void {
  fs.writeFileSync(file, JSON.stringify(value));
}
