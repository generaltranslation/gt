import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveSetupDirectory } from '../resolveSetupDirectory.js';

describe('resolveSetupDirectory', () => {
  let workspace: string;

  beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(tmpdir(), 'gt-electron-workspace-'));
  });

  afterEach(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  it('resolves an Electron package to its only Vite React renderer', async () => {
    const desktopDirectory = path.join(workspace, 'apps', 'desktop');
    const rendererDirectory = path.join(workspace, 'apps', 'renderer');
    fs.mkdirSync(desktopDirectory, { recursive: true });
    fs.mkdirSync(rendererDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(desktopDirectory, 'package.json'),
      JSON.stringify({ dependencies: { electron: '^40.0.0' } })
    );
    fs.writeFileSync(
      path.join(rendererDirectory, 'package.json'),
      JSON.stringify({
        dependencies: { react: '^19.0.0' },
        devDependencies: { vite: '^7.0.0' },
      })
    );
    fs.writeFileSync(
      path.join(rendererDirectory, 'index.html'),
      '<main></main>'
    );

    await expect(resolveSetupDirectory(desktopDirectory)).resolves.toBe(
      rendererDirectory
    );
  });

  it('keeps non-Electron packages in their current directory', async () => {
    const appDirectory = path.join(workspace, 'apps', 'api');
    fs.mkdirSync(appDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(appDirectory, 'package.json'),
      JSON.stringify({ dependencies: {} })
    );

    await expect(resolveSetupDirectory(appDirectory)).resolves.toBe(
      appDirectory
    );
  });
});
