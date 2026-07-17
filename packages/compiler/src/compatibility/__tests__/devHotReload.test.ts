import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as parser from '@babel/parser';
import { afterEach, describe, expect, it } from 'vitest';
import { ModuleFormatResolver } from '../devHotReload';

const tempDirs: string[] = [];

function createProject(module?: string): string {
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
  return directory;
}

function parse(code: string) {
  return parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });
}

describe('ModuleFormatResolver', () => {
  afterEach(() => {
    for (const directory of tempDirs.splice(0)) {
      fs.rmSync(directory, { force: true, recursive: true });
    }
  });

  it('detects CommonJS from tsconfig', () => {
    const project = createProject('commonjs');

    expect(
      new ModuleFormatResolver().resolve(
        path.join(project, 'App.tsx'),
        parse("import { t } from 'gt-react'; t('Hello');")
      )
    ).toEqual({ format: 'cjs', detail: 'tsconfig module: commonjs' });
  });

  it.each(['es2015', 'es2020', 'es2022', 'esnext', 'preserve'])(
    'detects %s as ESM without claiming top-level await support',
    (module) => {
      const project = createProject(module);

      expect(
        new ModuleFormatResolver().resolve(
          path.join(project, 'App.tsx'),
          parse("import { t } from 'gt-react'; t('Hello');")
        ).format
      ).toBe('esm');
    }
  );

  it.each(['node16', 'system', 'umd', 'none'])(
    'returns unknown for the ambiguous %s module setting',
    (module) => {
      const project = createProject(module);

      expect(
        new ModuleFormatResolver().resolve(
          path.join(project, 'App.tsx'),
          parse("import { t } from 'gt-react'; t('Hello');")
        ).format
      ).toBe('unknown');
    }
  );

  it.each([
    { extension: '.cjs', format: 'cjs' },
    { extension: '.cts', format: 'cjs' },
    { extension: '.mjs', format: 'esm' },
    { extension: '.mts', format: 'esm' },
  ] as const)('detects $format from $extension', ({ extension, format }) => {
    const project = createProject();

    expect(
      new ModuleFormatResolver().resolve(
        path.join(project, `App${extension}`),
        parse('const value = 1;')
      ).format
    ).toBe(format);
  });

  it('falls back to CommonJS syntax without a tsconfig', () => {
    const project = createProject();

    expect(
      new ModuleFormatResolver().resolve(
        path.join(project, 'App.js'),
        parse("const { t } = require('gt-react'); t('Hello');")
      ).format
    ).toBe('cjs');
  });

  it('returns unknown for mixed module syntax', () => {
    const project = createProject();

    expect(
      new ModuleFormatResolver().resolve(
        path.join(project, 'App.js'),
        parse("import value from 'value'; require('other');")
      ).format
    ).toBe('unknown');
  });
});
