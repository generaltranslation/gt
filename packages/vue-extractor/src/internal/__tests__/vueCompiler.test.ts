import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as testVueCompiler from '#vue-compiler-sfc';
import { parse as parseTemplate } from '@vue/compiler-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VueCompiler } from '../../types.js';
import { extractFromVueSource } from '../extractFromVueSource.js';
import { inspectVueCompiler, resolveVueCompiler } from '../vueCompiler.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

describe('consumer Vue compiler resolution', () => {
  it.each([null, 42, 'compiler', {}, { version: '3.5.40' }])(
    'fails cleanly for an invalid explicit compiler %#',
    (compiler) => {
      expect(inspectVueCompiler(compiler as unknown as VueCompiler)).toEqual({
        ok: false,
        details: expect.stringContaining('compiler'),
      });
    }
  );

  it('probes one explicit compiler only once across multiple source files', async () => {
    const compileTemplate = vi.fn(testVueCompiler.compileTemplate);
    const compiler = {
      ...testVueCompiler,
      compileTemplate,
      parseTemplate,
    } as unknown as VueCompiler;
    const source = `<script setup>import { T } from 'gt-vue';</script><template><T>Hello</T></template>`;

    const outputs = await Promise.all([
      extractFromVueSource(source, '/fixtures/First.vue', { compiler }),
      extractFromVueSource(source, '/fixtures/Second.vue', { compiler }),
      extractFromVueSource(source, '/fixtures/Third.vue', { compiler }),
    ]);

    expect(outputs.every((output) => output.errors.length === 0)).toBe(true);
    expect(compileTemplate).toHaveBeenCalledTimes(1);
  });

  it('uses the Vue compiler installed beside the consuming SFC', () => {
    const file = path.resolve(
      import.meta.dirname,
      '../../../../vue/src/CompilerProbe.vue'
    );
    const resolution = resolveVueCompiler(file, path.dirname(file));

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;
    expect(resolution.value.version).toMatch(/^3\.(?:[3-9]|\d{2,})\./);
    expect(resolution.value.compiler.version).toBe(resolution.value.version);
    expect(resolution.value.implicitSlotWhitespace).toBe(
      minorVersion(resolution.value.version) >= 5 ? 'html' : 'ecmascript'
    );
  });

  it('loads the consumer compiler browser distributions when Bun cannot follow the Vue proxy', () => {
    const root = createProject({ vue: '3.5.40' });
    writeBunIsolatedVuePackage(root, '3.5.40');
    Object.defineProperty(process.versions, 'bun', {
      configurable: true,
      value: '1.3.14',
    });

    try {
      const resolution = resolveVueCompiler(
        path.join(root, 'src/App.vue'),
        root
      );

      expect(resolution).toEqual({
        ok: true,
        value: expect.objectContaining({
          implicitSlotWhitespace: 'ecmascript',
          templateParseOptionsSupported: true,
          version: '3.5.40',
        }),
      });
    } finally {
      delete process.versions.bun;
    }
  });

  it('rejects unsupported consumer compiler versions through the Bun fallback', () => {
    const root = createProject({ vue: '3.2.47' });
    writeBunIsolatedVuePackage(root, '3.2.47');
    Object.defineProperty(process.versions, 'bun', {
      configurable: true,
      value: '1.3.14',
    });

    try {
      const resolution = resolveVueCompiler(
        path.join(root, 'src/App.vue'),
        root
      );

      expect(resolution).toEqual({
        ok: false,
        details:
          'Resolved Vue compiler version "3.2.47"; gt-vue supports Vue 3.3 through Vue 3.x.',
      });
    } finally {
      delete process.versions.bun;
    }
  });

  it('does not let bundled fallback hide a declared but missing Vue install', () => {
    const root = createProject({ vue: '^3.3.0' });
    const resolution = resolveVueCompiler(path.join(root, 'src/App.vue'), root);

    expect(resolution).toEqual({
      ok: false,
      details: expect.stringContaining(
        'declares Vue "^3.3.0" but vue/compiler-sfc could not be resolved'
      ),
    });
  });

  it('does not resolve the extractor package compiler for a project without Vue', () => {
    const root = createProject({});
    const resolution = resolveVueCompiler(path.join(root, 'src/App.vue'), root);

    expect(resolution).toEqual({
      ok: false,
      details: expect.stringContaining(
        `Could not resolve vue/compiler-sfc from ${path.join(root, 'src/App.vue')}`
      ),
    });
  });

  it('fails closed when an installed Vue package has no compiler export', () => {
    const root = createProject({ vue: '3.3.13' });
    writeVuePackage(root, {
      exports: { './package.json': './package.json' },
      version: '3.3.13',
    });

    const resolution = resolveVueCompiler(path.join(root, 'src/App.vue'), root);

    expect(resolution).toEqual({
      ok: false,
      details: expect.stringContaining("Resolved the app's Vue package"),
    });
  });

  it('fails closed when Vue and compiler-sfc versions disagree', () => {
    const root = createProject({ vue: '3.5.40' });
    writeVuePackage(root, { version: '3.5.40' }, '3.4.38');

    const resolution = resolveVueCompiler(path.join(root, 'src/App.vue'), root);

    expect(resolution).toEqual({
      ok: false,
      details: expect.stringContaining(
        'resolves Vue 3.5.40 but vue/compiler-sfc 3.4.38'
      ),
    });
  });

  it('rejects compiler versions outside the gt-vue peer range', () => {
    const root = createProject({ vue: '4.0.0' });
    writeVuePackage(root, { version: '4.0.0' }, '4.0.0');

    const resolution = resolveVueCompiler(path.join(root, 'src/App.vue'), root);

    expect(resolution).toEqual({
      ok: false,
      details: expect.stringContaining(
        'gt-vue supports Vue 3.3 through Vue 3.x'
      ),
    });
  });
});

function createProject(dependencies: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-vue-compiler-'));
  temporaryDirectories.push(root);
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ dependencies, name: 'fixture', private: true })
  );
  return root;
}

function writeVuePackage(
  root: string,
  manifest: { exports?: Record<string, string>; version: string },
  compilerVersion = manifest.version
): void {
  const directory = path.join(root, 'node_modules/vue');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, 'package.json'),
    JSON.stringify({
      exports: manifest.exports ?? {
        './compiler-sfc': './compiler-sfc.cjs',
        './package.json': './package.json',
      },
      name: 'vue',
      version: manifest.version,
    })
  );
  if (manifest.exports?.['./compiler-sfc'] === undefined && manifest.exports) {
    return;
  }
  fs.writeFileSync(
    path.join(directory, 'compiler-sfc.cjs'),
    `module.exports = { compileTemplate() {}, parse() {}, version: ${JSON.stringify(compilerVersion)} };\n`
  );
}

function writeBunIsolatedVuePackage(root: string, version: string): void {
  writeVuePackage(root, { version });
  fs.writeFileSync(
    path.join(root, 'node_modules/vue/compiler-sfc.cjs'),
    `module.exports = require('@vue/compiler-sfc');\n`
  );

  const compilerSfcRoot = path.join(root, 'node_modules/@vue/compiler-sfc');
  const compilerDomRoot = path.join(root, 'node_modules/@vue/compiler-dom');
  fs.mkdirSync(path.join(compilerSfcRoot, 'dist'), { recursive: true });
  fs.mkdirSync(path.join(compilerDomRoot, 'dist'), { recursive: true });
  fs.writeFileSync(
    path.join(compilerSfcRoot, 'package.json'),
    JSON.stringify({ name: '@vue/compiler-sfc', version })
  );
  fs.writeFileSync(
    path.join(compilerDomRoot, 'package.json'),
    JSON.stringify({ name: '@vue/compiler-dom', version })
  );
  fs.writeFileSync(
    path.join(compilerSfcRoot, 'dist/compiler-sfc.esm-browser.js'),
    `module.exports = {
  compileTemplate() {
    return {
      errors: [],
      ast: {
        children: [{
          tag: 'Probe',
          codegenNode: { children: { properties: [] } }
        }]
      }
    };
  },
  parse(_source, options) {
    return {
      descriptor: {
        template: {
          ast: {
            children: [{
              type: 2,
              content: options.templateParseOptions.whitespace
            }]
          }
        }
      }
    };
  },
  version: ${JSON.stringify(version)}
};\n`
  );
  fs.writeFileSync(
    path.join(compilerDomRoot, 'dist/compiler-dom.esm-browser.js'),
    `module.exports = { compile() {}, parse() {} };\n`
  );
}

function minorVersion(version: string): number {
  return Number(version.split('.')[1]);
}
