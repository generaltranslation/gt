import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../../console/logger.js';
import { collectParaglideContext } from '../collectParaglideContext.js';

const spinner = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn() }));

vi.mock('../../console/logger.js', () => ({
  logger: {
    createSpinner: vi.fn(() => spinner),
    warn: vi.fn(),
  },
}));

const RECORDING_COMPILER = `
import fs from 'node:fs';
import path from 'node:path';

export async function collectContext({ root, logger }) {
  logger.warn('an import could not be resolved');
  logger.info('2 usage(s)');
  fs.writeFileSync(path.join(root, 'collected.json'), JSON.stringify({ root }));
}
`;

const FAILING_COMPILER = `
export async function collectContext() {
  throw new Error('no Paraglide outdir');
}
`;

function installParaglidePackage(projectRoot: string, compiler: string): void {
  const packageDirectory = path.join(
    projectRoot,
    'node_modules/@generaltranslation/paraglide-js'
  );
  fs.mkdirSync(path.join(packageDirectory, 'dist/src'), { recursive: true });
  fs.writeFileSync(
    path.join(packageDirectory, 'package.json'),
    JSON.stringify({
      name: '@generaltranslation/paraglide-js',
      type: 'module',
      exports: {
        './compiler': {
          types: './dist/src/compiler.d.ts',
          default: './dist/src/compiler.js',
        },
      },
    })
  );
  fs.writeFileSync(
    path.join(packageDirectory, 'dist/src/compiler.js'),
    compiler
  );
}

describe('collectParaglideContext', () => {
  let projectRoot: string;

  beforeEach(() => {
    vi.clearAllMocks();
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-paraglide-'));
    fs.writeFileSync(path.join(projectRoot, 'package.json'), '{}');
  });

  afterEach(() => {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  });

  it('collects the context of the project when the package is installed', async () => {
    installParaglidePackage(projectRoot, RECORDING_COMPILER);

    await collectParaglideContext(projectRoot);

    const collected = JSON.parse(
      fs.readFileSync(path.join(projectRoot, 'collected.json'), 'utf8')
    );
    expect(collected).toEqual({ root: projectRoot });
    expect(spinner.start).toHaveBeenCalledOnce();
    expect(spinner.stop).toHaveBeenCalledWith(
      'Collected source code context for Paraglide messages'
    );
    expect(logger.warn).toHaveBeenCalledExactlyOnceWith(
      'an import could not be resolved'
    );
  });

  it('does nothing when the package is not installed', async () => {
    await collectParaglideContext(projectRoot);

    expect(spinner.start).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('warns instead of throwing when the collection fails', async () => {
    installParaglidePackage(projectRoot, FAILING_COMPILER);

    await collectParaglideContext(projectRoot);

    expect(spinner.stop).toHaveBeenCalledWith(
      'Source code context for Paraglide messages was skipped'
    );
    expect(logger.warn).toHaveBeenCalledExactlyOnceWith(
      'Source code context for Paraglide messages could not be collected: no Paraglide outdir'
    );
  });
});
