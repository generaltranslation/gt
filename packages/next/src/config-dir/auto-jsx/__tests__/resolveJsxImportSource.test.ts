import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { NextConfig } from 'next';
import { resolveJsxImportSource } from '../resolveJsxImportSource';

const require = createRequire(import.meta.url);
let directory: string;
let config: NextConfig;

function write(filename: string, contents: string) {
  const destination = path.join(directory, filename);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, contents);
}

function installTypeScript() {
  fs.mkdirSync(path.join(directory, 'node_modules'), { recursive: true });
  fs.symlinkSync(
    path.dirname(require.resolve('typescript/package.json')),
    path.join(directory, 'node_modules/typescript'),
    'dir'
  );
}

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-jsx-config-'));
  config = { turbopack: { root: directory } };
});

afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

describe('Next host JSX source selection', () => {
  it.each([true, false])(
    'leaves an absent config unspecified (turbo=%s)',
    (turbo) => {
      expect(resolveJsxImportSource(config, turbo, directory)).toBeUndefined();
    }
  );

  it('matches Turbopack’s React default for an exactly empty config', () => {
    write('jsconfig.json', '');
    expect(resolveJsxImportSource(config, true, directory)).toBe('react');
    expect(resolveJsxImportSource(config, false, directory)).toBeUndefined();
  });

  it.each(['react', '@emotion/react', 'custom-runtime', 'react-extra', ''])(
    'preserves the exact explicit import source %j',
    (source) => {
      write(
        'jsconfig.json',
        JSON.stringify({ compilerOptions: { jsxImportSource: source } })
      );
      expect(resolveJsxImportSource(config, true, directory)).toBe(source);
      expect(resolveJsxImportSource(config, false, directory)).toBe(source);
    }
  );

  it.each([null, false, 1, {}, []])(
    'ignores a non-string source %j',
    (source) => {
      write(
        'jsconfig.json',
        JSON.stringify({ compilerOptions: { jsxImportSource: source } })
      );
      expect(resolveJsxImportSource(config, true, directory)).toBeUndefined();
      expect(resolveJsxImportSource(config, false, directory)).toBeUndefined();
    }
  );

  it('reads comments and trailing commas without changing the file', () => {
    const source =
      '{\n// source selection\n"compilerOptions": {"jsxImportSource":"custom-runtime",},\n}';
    write('jsconfig.json', source);
    expect(resolveJsxImportSource(config, true, directory)).toBe(
      'custom-runtime'
    );
    expect(fs.readFileSync(path.join(directory, 'jsconfig.json'), 'utf8')).toBe(
      source
    );
  });

  it('prefers tsconfig over jsconfig for Turbopack without requiring TypeScript', () => {
    write(
      'tsconfig.json',
      '{"compilerOptions":{"jsxImportSource":"ts-runtime"}}'
    );
    write(
      'jsconfig.json',
      '{"compilerOptions":{"jsxImportSource":"js-runtime"}}'
    );
    expect(resolveJsxImportSource(config, true, directory)).toBe('ts-runtime');
    expect(resolveJsxImportSource(config, false, directory)).toBe('js-runtime');
  });

  it('uses the configured TypeScript config path without falling back to another config', () => {
    config.typescript = { tsconfigPath: 'configs/app.json' };
    write(
      'configs/app.json',
      '{"compilerOptions":{"jsxImportSource":"chosen-runtime"}}'
    );
    write(
      'tsconfig.json',
      '{"compilerOptions":{"jsxImportSource":"ignored-runtime"}}'
    );
    write(
      'jsconfig.json',
      '{"compilerOptions":{"jsxImportSource":"js-runtime"}}'
    );
    expect(resolveJsxImportSource(config, true, directory)).toBe(
      'chosen-runtime'
    );
    installTypeScript();
    expect(resolveJsxImportSource(config, false, directory)).toBe(
      'chosen-runtime'
    );
    fs.unlinkSync(path.join(directory, 'configs/app.json'));
    expect(resolveJsxImportSource(config, true, directory)).toBeUndefined();
    expect(resolveJsxImportSource(config, false, directory)).toBe('js-runtime');
  });

  it('preserves Turbopack’s root-only JSX source behavior for inherited configs', () => {
    write(
      'base.json',
      '{"compilerOptions":{"jsxImportSource":"inherited-runtime"}}'
    );
    write(
      'tsconfig.json',
      '{"extends":"./base.json","compilerOptions":{"jsx":"preserve"}}'
    );
    expect(resolveJsxImportSource(config, true, directory)).toBeUndefined();
    installTypeScript();
    expect(resolveJsxImportSource(config, false, directory)).toBe(
      'inherited-runtime'
    );
  });

  it('lets the project TypeScript resolve package and multiple extends for Webpack', () => {
    installTypeScript();
    write(
      'node_modules/shared-config/package.json',
      '{"name":"shared-config","version":"1.0.0","tsconfig":"base.json"}'
    );
    write(
      'node_modules/shared-config/base.json',
      '{"compilerOptions":{"jsxImportSource":"package-runtime"}}'
    );
    write(
      'first.json',
      '{"compilerOptions":{"jsxImportSource":"first-runtime"}}'
    );
    write('tsconfig.json', '{"extends":["./first.json","shared-config"]}');
    expect(resolveJsxImportSource(config, false, directory)).toBe(
      'package-runtime'
    );
    expect(resolveJsxImportSource(config, true, directory)).toBeUndefined();
  });

  it('does not apply jsconfig inheritance in either host', () => {
    write(
      'base.json',
      '{"compilerOptions":{"jsxImportSource":"inherited-runtime"}}'
    );
    write('jsconfig.json', '{"extends":"./base.json"}');
    expect(resolveJsxImportSource(config, true, directory)).toBeUndefined();
    expect(resolveJsxImportSource(config, false, directory)).toBeUndefined();
  });

  it('uses the nearest config inside the inferred workspace root', () => {
    write('pnpm-workspace.yaml', 'packages: []');
    write(
      'tsconfig.json',
      '{"compilerOptions":{"jsxImportSource":"workspace-runtime"}}'
    );
    fs.mkdirSync(path.join(directory, 'app/src'), { recursive: true });
    expect(resolveJsxImportSource({}, true, path.join(directory, 'app'))).toBe(
      'workspace-runtime'
    );
    write(
      'app/jsconfig.json',
      '{"compilerOptions":{"jsxImportSource":"app-runtime"}}'
    );
    expect(
      resolveJsxImportSource({}, true, path.join(directory, 'app/src'))
    ).toBe('app-runtime');
  });

  it('does not inspect configs beyond an explicit Turbopack root', () => {
    write(
      'tsconfig.json',
      '{"compilerOptions":{"jsxImportSource":"outside-runtime"}}'
    );
    fs.mkdirSync(path.join(directory, 'app'), { recursive: true });
    expect(
      resolveJsxImportSource(
        { turbopack: { root: path.join(directory, 'app') } },
        true,
        path.join(directory, 'app')
      )
    ).toBeUndefined();
  });

  it('uses outputFileTracingRoot when it overrides the Turbopack root', () => {
    write(
      'tsconfig.json',
      '{"compilerOptions":{"jsxImportSource":"workspace-runtime"}}'
    );
    fs.mkdirSync(path.join(directory, 'app'), { recursive: true });
    expect(
      resolveJsxImportSource(
        {
          outputFileTracingRoot: directory,
          turbopack: { root: path.join(directory, 'app') },
        },
        true,
        path.join(directory, 'app')
      )
    ).toBe('workspace-runtime');
  });

  it('formats an actionable parse error', () => {
    write('jsconfig.json', '{ broken');
    expect(() => resolveJsxImportSource(config, true, directory)).toThrow(
      /gt-next \(plugin\).*JSX import source could not be read/
    );
  });
});
