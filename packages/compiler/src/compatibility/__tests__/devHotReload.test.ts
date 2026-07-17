import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as parser from '@babel/parser';
import { afterEach, describe, expect, it } from 'vitest';
import { DevHotReloadCompatibilityResolver } from '../devHotReload';

const tempDirs: string[] = [];

function createProject(
  module: string | undefined,
  packageType?: string
): string {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'gt-compiler-module-')
  );
  tempDirs.push(directory);
  if (module) {
    fs.writeFileSync(
      path.join(directory, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { module } })
    );
  }
  if (packageType) {
    fs.writeFileSync(
      path.join(directory, 'package.json'),
      JSON.stringify({ type: packageType })
    );
  }
  return directory;
}

function parse(code: string) {
  return parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });
}

describe('DevHotReloadCompatibilityResolver', () => {
  afterEach(() => {
    for (const directory of tempDirs.splice(0)) {
      fs.rmSync(directory, { force: true, recursive: true });
    }
  });

  it.each(['commonjs', 'amd', 'umd'])(
    'detects the %s TypeScript module format',
    (module) => {
      const project = createProject(module);
      const compatibility = new DevHotReloadCompatibilityResolver().resolve(
        path.join(project, 'App.tsx'),
        parse("import { t } from 'gt-react'; t('Hello');")
      );

      expect(compatibility).toEqual({
        compatible: false,
        detectedModuleType: module,
        reason: 'commonjs',
      });
    }
  );

  it.each([
    { configured: 'es2015', detected: 'es6' },
    { configured: 'es2020', detected: 'es2020' },
  ])(
    'detects the $configured module format as older ESM',
    ({ configured, detected }) => {
      const project = createProject(configured);
      const compatibility = new DevHotReloadCompatibilityResolver().resolve(
        path.join(project, 'App.tsx'),
        parse("import { t } from 'gt-react'; t('Hello');")
      );

      expect(compatibility).toEqual({
        compatible: false,
        detectedModuleType: detected,
        reason: 'legacy-esm',
      });
    }
  );

  it.each(['es2022', 'esnext', 'preserve'])(
    'allows the %s module format',
    (module) => {
      const project = createProject(module);
      const compatibility = new DevHotReloadCompatibilityResolver().resolve(
        path.join(project, 'App.tsx'),
        parse("import { t } from 'gt-react'; t('Hello');")
      );

      expect(compatibility).toEqual({ compatible: true });
    }
  );

  it('uses package type to resolve Node module formats', () => {
    const cjsProject = createProject('node16', 'commonjs');
    const esmProject = createProject('node16', 'module');
    const resolver = new DevHotReloadCompatibilityResolver();
    const ast = parse("import { t } from 'gt-react'; t('Hello');");

    expect(
      resolver.resolve(path.join(cjsProject, 'App.ts'), ast).compatible
    ).toBe(false);
    expect(
      resolver.resolve(path.join(esmProject, 'App.ts'), ast).compatible
    ).toBe(true);
  });

  it('falls back to CommonJS syntax when no tsconfig is available', () => {
    const project = createProject(undefined);
    const compatibility = new DevHotReloadCompatibilityResolver().resolve(
      path.join(project, 'App.js'),
      parse("const { t } = require('gt-react'); t('Hello');")
    );

    expect(compatibility.compatible).toBe(false);
  });
});
