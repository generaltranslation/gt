import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveVueCompilerOptions } from '../../config.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

describe('resolveVueCompilerOptions', () => {
  it('uses explicit options when no framework config exists', () => {
    const root = createProject({});

    expect(
      resolveVueCompilerOptions(root, {
        delimiters: ['[[', ']]'],
        whitespace: 'condense',
      })
    ).toEqual({
      compilerOptions: {
        delimiters: ['[[', ']]'],
        whitespace: 'condense',
      },
      errors: [],
    });
  });

  it('resolves static Vite options through aliases, spreads, and TypeScript wrappers', () => {
    const root = createProject({
      'vite.config.ts': `
        import vue from '@vitejs/plugin-vue';
        const delimiters = ['[[', ']]'] as const;
        const compilerOptions = {
          whitespace: 'preserve',
          delimiters,
        } satisfies Record<string, unknown>;
        const template = { compilerOptions: { ...compilerOptions } };
        export default { plugins: [vue({ template })] };
      `,
    });

    expect(resolveVueCompilerOptions(root, undefined)).toEqual({
      compilerOptions: {
        delimiters: ['[[', ']]'],
        whitespace: 'preserve',
      },
      errors: [],
    });
  });

  it('resolves static Nuxt compiler options', () => {
    const root = createProject({
      'nuxt.config.ts': `
        const whitespace = \`preserve\`;
        const delimiters = ['<%', '%>'] as const;
        export default defineNuxtConfig({
          vue: { compilerOptions: { whitespace, delimiters } },
        });
      `,
    });

    expect(resolveVueCompilerOptions(root, undefined)).toEqual({
      compilerOptions: {
        delimiters: ['<%', '%>'],
        whitespace: 'preserve',
      },
      errors: [],
    });
  });

  it('resolves a Vue plugin namespace import', () => {
    const root = createProject({
      'vite.config.mjs': `
        import * as pluginVue from '@vitejs/plugin-vue';
        export default { plugins: [pluginVue.default({
          template: { compilerOptions: { whitespace: 'preserve' } },
        })] };
      `,
    });

    expect(resolveVueCompilerOptions(root, undefined)).toEqual({
      compilerOptions: { whitespace: 'preserve' },
      errors: [],
    });
  });

  it('resolves a CommonJS Vue plugin default import', () => {
    const root = createProject({
      'vite.config.cjs': `
        const vue = require('@vitejs/plugin-vue').default;
        module.exports = { plugins: [vue({
          template: { compilerOptions: { delimiters: ['[[', ']]'] } },
        })] };
      `,
    });

    expect(resolveVueCompilerOptions(root, undefined)).toEqual({
      compilerOptions: { delimiters: ['[[', ']]'] },
      errors: [],
    });
  });

  it('resolves a plain Nuxt default-exported object', () => {
    const root = createProject({
      'nuxt.config.js': `
        export default {
          vue: { compilerOptions: { whitespace: 'preserve' } },
        };
      `,
    });

    expect(resolveVueCompilerOptions(root, undefined)).toEqual({
      compilerOptions: { whitespace: 'preserve' },
      errors: [],
    });
  });

  it('combines matching explicit and project options', () => {
    const root = createProject({
      'vite.config.js': `
        import vue from '@vitejs/plugin-vue';
        export default { plugins: [vue({
          template: { compilerOptions: { whitespace: 'preserve' } },
        })] };
      `,
    });

    expect(
      resolveVueCompilerOptions(root, {
        delimiters: ['[[', ']]'],
        whitespace: 'preserve',
      })
    ).toEqual({
      compilerOptions: {
        delimiters: ['[[', ']]'],
        whitespace: 'preserve',
      },
      errors: [],
    });
  });

  it('fails closed when explicit and project options conflict', () => {
    const root = createProject({
      'vite.config.js': `
        import vue from '@vitejs/plugin-vue';
        export default { plugins: [vue({
          template: { compilerOptions: { whitespace: 'condense' } },
        })] };
      `,
    });

    const result = resolveVueCompilerOptions(root, {
      whitespace: 'preserve',
    });

    expect(result.compilerOptions).toEqual({ whitespace: 'preserve' });
    expect(result.errors.join('\n')).toContain(
      'conflicting Vue whitespace compiler options'
    );
  });

  it('fails closed for dynamic hash-affecting options', () => {
    const root = createProject({
      'vite.config.js': `
        import vue from '@vitejs/plugin-vue';
        const compilerOptions = getCompilerOptions();
        export default { plugins: [vue({ template: { compilerOptions } })] };
      `,
    });

    const result = resolveVueCompilerOptions(root, undefined);

    expect(result.compilerOptions).toEqual({});
    expect(result.errors.join('\n')).toContain(
      'Could not statically resolve Vue compiler options'
    );
  });

  it('fails closed for a dynamic compiler-options parent', () => {
    const root = createProject({
      'nuxt.config.ts': `
        const vue = getVueOptions();
        export default defineNuxtConfig({ vue });
      `,
    });

    const result = resolveVueCompilerOptions(root, undefined);

    expect(result.compilerOptions).toEqual({});
    expect(result.errors.join('\n')).toContain(
      'Could not statically resolve Vue compiler options'
    );
  });

  it('fails closed for unsupported compiler options', () => {
    const root = createProject({
      'vite.config.js': `
        import vue from '@vitejs/plugin-vue';
        export default { plugins: [vue({ template: { compilerOptions: {
          whitespace: 'preserve',
          isCustomElement: (tag) => tag.startsWith('x-'),
        } } })] };
      `,
    });

    const result = resolveVueCompilerOptions(root, undefined);

    expect(result.compilerOptions).toEqual({ whitespace: 'preserve' });
    expect(result.errors.join('\n')).toContain(
      'unsupported Vue compiler option "isCustomElement"'
    );
  });

  it('reports syntax errors only when a config references compiler options', () => {
    const relevantRoot = createProject({
      'vite.config.ts': `const compilerOptions = { whitespace: ;`,
    });
    const unrelatedRoot = createProject({
      'vite.config.ts': `const unrelated = { broken: ;`,
    });

    expect(
      resolveVueCompilerOptions(relevantRoot, undefined).errors.join('\n')
    ).toContain('Could not parse a project configuration');
    expect(resolveVueCompilerOptions(unrelatedRoot, undefined)).toEqual({
      compilerOptions: {},
      errors: [],
    });
  });

  it('rejects cross-framework config ambiguity even when options match', () => {
    const root = createProject({
      'vite.config.js': `
        import vue from '@vitejs/plugin-vue';
        export default { plugins: [vue({ template: { compilerOptions: {
          whitespace: 'preserve',
        } } })] };
      `,
      'nuxt.config.ts': `
        export default defineNuxtConfig({
          vue: { compilerOptions: { whitespace: 'preserve' } },
        });
      `,
    });

    const result = resolveVueCompilerOptions(root, {
      whitespace: 'preserve',
    });

    expect(result.compilerOptions).toEqual({ whitespace: 'preserve' });
    expect(result.errors.join('\n')).toContain(
      'Found both Nuxt and Vite project config files'
    );
  });

  it('rejects malformed explicit options at runtime', () => {
    const root = createProject({});

    const invalidWhitespace = resolveVueCompilerOptions(root, {
      whitespace: 'collapse',
    } as never);
    const invalidDelimiters = resolveVueCompilerOptions(root, {
      delimiters: ['[[', ''],
    });

    expect(invalidWhitespace.errors.join('\n')).toContain(
      'invalid Vue whitespace compiler option'
    );
    expect(invalidDelimiters.errors.join('\n')).toContain(
      'invalid Vue interpolation delimiters'
    );
  });

  it('ignores unrelated dynamic plugin options', () => {
    const root = createProject({
      'vite.config.js': `
        import vue from '@vitejs/plugin-vue';
        export default { plugins: [vue({ script: getScriptOptions() })] };
      `,
    });

    expect(resolveVueCompilerOptions(root, undefined)).toEqual({
      compilerOptions: {},
      errors: [],
    });
  });

  it.each([
    {
      name: 'dead Vue plugin calls',
      source: `
        import { defineConfig } from 'vite';
        import vue from '@vitejs/plugin-vue';
        const unused = vue({ template: { compilerOptions: { whitespace: 'preserve' } } });
        export default defineConfig({ plugins: [vue()] });
      `,
      expected: {},
    },
    {
      name: 'a defineConfig function return',
      source: `
        import { defineConfig } from 'vite';
        import vue from '@vitejs/plugin-vue';
        export default defineConfig(() => ({ plugins: [vue({
          template: { compilerOptions: { whitespace: 'preserve' } },
        })] }));
      `,
      expected: { whitespace: 'preserve' },
    },
    {
      name: 'an immutable config alias and plugin-array spreads',
      source: `
        import { defineConfig } from 'vite';
        import vue from '@vitejs/plugin-vue';
        const gtPlugins = [vue({ template: { compilerOptions: { delimiters: ['[[', ']]'] } } })];
        const plugins = [...gtPlugins];
        const shared = { plugins };
        const config = { ...shared };
        const wrap = defineConfig;
        export default wrap(config);
      `,
      expected: { delimiters: ['[[', ']]'] },
    },
    {
      name: 'a statically selected plugin branch',
      source: `
        import vue from '@vitejs/plugin-vue';
        export default { plugins: [true ? vue({
          template: { compilerOptions: { whitespace: 'preserve' } },
        }) : vue()] };
      `,
      expected: { whitespace: 'preserve' },
    },
  ])(
    'resolves only the active Vite graph through $name',
    ({ source, expected }) => {
      const root = createProject({ 'vite.config.ts': source });

      expect(resolveVueCompilerOptions(root, undefined)).toEqual({
        compilerOptions: expected,
        errors: [],
      });
    }
  );

  it.each([
    {
      name: 'a dynamic plugin branch',
      source: `
        import vue from '@vitejs/plugin-vue';
        export default { plugins: [flag ? vue({
          template: { compilerOptions: { whitespace: 'preserve' } },
        }) : vue()] };
      `,
    },
    {
      name: 'a wrapper that returns the Vue plugin',
      source: `
        import vue from '@vitejs/plugin-vue';
        const makeVue = () => vue({ template: { compilerOptions: { whitespace: 'preserve' } } });
        export default { plugins: [makeVue()] };
      `,
    },
    {
      name: 'multiple active Vue plugin instances',
      source: `
        import vue from '@vitejs/plugin-vue';
        export default { plugins: [vue(), vue({
          template: { compilerOptions: { whitespace: 'preserve' } },
        })] };
      `,
    },
    {
      name: 'a config function with multiple possible returns',
      source: `
        import { defineConfig } from 'vite';
        import vue from '@vitejs/plugin-vue';
        export default defineConfig((env) => {
          if (env.command === 'build') return { plugins: [vue()] };
          return { plugins: [vue({ template: { compilerOptions: { whitespace: 'preserve' } } })] };
        });
      `,
    },
    {
      name: 'a mutated defineConfig alias',
      source: `
        import { defineConfig } from 'vite';
        import vue from '@vitejs/plugin-vue';
        let wrap = defineConfig;
        wrap = (value) => value;
        export default wrap({ plugins: [vue()] });
      `,
    },
  ])('fails closed for $name', ({ source }) => {
    const root = createProject({ 'vite.config.ts': source });

    const result = resolveVueCompilerOptions(root, undefined);

    expect(result.compilerOptions).toEqual({});
    expect(result.errors.join('\n')).toContain(
      'Could not statically resolve Vue compiler options'
    );
  });

  it.each([
    {
      name: 'nested plugin options mutated by assignment',
      source: `
        import vue from '@vitejs/plugin-vue';
        const options = { template: { compilerOptions: { whitespace: 'condense' } } };
        options.template.compilerOptions.whitespace = 'preserve';
        export default { plugins: [vue(options)] };
      `,
    },
    {
      name: 'an active plugin array mutated with push',
      source: `
        import vue from '@vitejs/plugin-vue';
        const plugins = [];
        plugins.push(vue({ template: { compilerOptions: { whitespace: 'preserve' } } }));
        export default { plugins };
      `,
    },
    {
      name: 'an aliased config object mutated by assignment',
      source: `
        import vue from '@vitejs/plugin-vue';
        const config = { plugins: [vue()] };
        const alias = config;
        alias.plugins = [vue({ template: { compilerOptions: { whitespace: 'preserve' } } })];
        export default config;
      `,
    },
    {
      name: 'a compiler options object mutated with Object.assign',
      source: `
        import vue from '@vitejs/plugin-vue';
        const compilerOptions = { whitespace: 'condense' };
        Object.assign(compilerOptions, { whitespace: 'preserve' });
        export default { plugins: [vue({ template: { compilerOptions } })] };
      `,
    },
    {
      name: 'plugin options escape to an unknown mutator call',
      source: `
        import vue from '@vitejs/plugin-vue';
        const options = { template: { compilerOptions: { whitespace: 'condense' } } };
        mutate(options);
        export default { plugins: [vue(options)] };
      `,
    },
    {
      name: 'an assignment alias mutates plugin options',
      source: `
        import vue from '@vitejs/plugin-vue';
        const options = { template: { compilerOptions: { whitespace: 'condense' } } };
        let alias;
        alias = options;
        alias.template.compilerOptions.whitespace = 'preserve';
        export default { plugins: [vue(options)] };
      `,
    },
    {
      name: 'a destructured alias mutates plugin options',
      source: `
        import vue from '@vitejs/plugin-vue';
        const options = { template: { compilerOptions: { whitespace: 'condense' } } };
        const { template } = options;
        template.compilerOptions.whitespace = 'preserve';
        export default { plugins: [vue(options)] };
      `,
    },
  ])('fails closed when $name', ({ source }) => {
    const root = createProject({ 'vite.config.ts': source });

    const result = resolveVueCompilerOptions(root, undefined);

    expect(result.compilerOptions).toEqual({});
    expect(result.errors.join('\n')).toContain(
      'Could not statically resolve Vue compiler options'
    );
  });

  it('uses only Vite’s first standard config file', () => {
    const root = createProject({
      'vite.config.js': `
        import vue from '@vitejs/plugin-vue';
        export default { plugins: [vue()] };
      `,
      'vite.config.ts': `
        import vue from '@vitejs/plugin-vue';
        export default { plugins: [vue({ template: { compilerOptions: { whitespace: 'preserve' } } })] };
      `,
    });

    expect(resolveVueCompilerOptions(root, undefined)).toEqual({
      compilerOptions: {},
      errors: [],
    });
  });

  it('uses Vite’s mjs config before its TypeScript config', () => {
    const root = createProject({
      'vite.config.mjs': `
        import vue from '@vitejs/plugin-vue';
        export default { plugins: [vue()] };
      `,
      'vite.config.ts': `
        import vue from '@vitejs/plugin-vue';
        export default { plugins: [vue({ template: { compilerOptions: { whitespace: 'preserve' } } })] };
      `,
    });

    expect(resolveVueCompilerOptions(root, undefined)).toEqual({
      compilerOptions: {},
      errors: [],
    });
  });

  it('does not auto-discover JSX or TSX Vite config names', () => {
    const root = createProject({
      'vite.config.tsx': `
        import vue from '@vitejs/plugin-vue';
        export default { plugins: [vue({ template: { compilerOptions: { whitespace: 'preserve' } } })] };
      `,
    });

    expect(resolveVueCompilerOptions(root, undefined)).toEqual({
      compilerOptions: {},
      errors: [],
    });
  });

  it('uses the last direct CommonJS overwrite and ignores the earlier value', () => {
    const root = createProject({
      'vite.config.cjs': `
        const vue = require('@vitejs/plugin-vue').default;
        module.exports = { plugins: [vue({ template: { compilerOptions: { whitespace: 'preserve' } } })] };
        module.exports = { plugins: [vue()] };
      `,
    });

    expect(resolveVueCompilerOptions(root, undefined)).toEqual({
      compilerOptions: {},
      errors: [],
    });
  });

  it('ignores dead Nuxt helper calls and reads only the exported config', () => {
    const root = createProject({
      'nuxt.config.ts': `
        const unused = defineNuxtConfig({ vue: { compilerOptions: { whitespace: 'preserve' } } });
        export default defineNuxtConfig({});
      `,
    });

    expect(resolveVueCompilerOptions(root, undefined)).toEqual({
      compilerOptions: {},
      errors: [],
    });
  });

  it('uses only Nuxt’s first standard config file', () => {
    const root = createProject({
      'nuxt.config.js': `export default { vue: { compilerOptions: { whitespace: 'condense' } } };`,
      'nuxt.config.ts': `export default defineNuxtConfig({ vue: { compilerOptions: { whitespace: 'preserve' } } });`,
    });

    expect(resolveVueCompilerOptions(root, undefined)).toEqual({
      compilerOptions: { whitespace: 'condense' },
      errors: [],
    });
  });

  it('fails closed when both standard Nuxt and Vite configs exist', () => {
    const root = createProject({
      'nuxt.config.ts': `export default defineNuxtConfig({ vue: { compilerOptions: { whitespace: 'condense' } } });`,
      'vite.config.js': `
        import vue from '@vitejs/plugin-vue';
        export default { plugins: [vue({ template: { compilerOptions: { whitespace: 'preserve' } } })] };
      `,
    });

    const result = resolveVueCompilerOptions(root, undefined);

    expect(result.compilerOptions).toEqual({});
    expect(result.errors.join('\n')).toContain(
      'Found both Nuxt and Vite project config files'
    );
  });

  it('uses the last direct Nuxt CommonJS overwrite', () => {
    const root = createProject({
      'nuxt.config.cjs': `
        module.exports = { vue: { compilerOptions: { whitespace: 'preserve' } } };
        module.exports = { vue: { compilerOptions: { whitespace: 'condense' } } };
      `,
    });

    expect(resolveVueCompilerOptions(root, undefined)).toEqual({
      compilerOptions: { whitespace: 'condense' },
      errors: [],
    });
  });

  it('fails closed for mixed CommonJS export targets', () => {
    const root = createProject({
      'nuxt.config.cjs': `
        module.exports = { vue: { compilerOptions: { whitespace: 'preserve' } } };
        exports.default = { vue: { compilerOptions: { whitespace: 'condense' } } };
      `,
    });

    const result = resolveVueCompilerOptions(root, undefined);

    expect(result.compilerOptions).toEqual({});
    expect(result.errors.join('\n')).toContain(
      'Could not statically resolve Vue compiler options'
    );
  });

  it('uses one explicit in-root Vite config and bypasses standard discovery', () => {
    const root = createProject({
      'nuxt.config.ts': `export default defineNuxtConfig({ vue: { compilerOptions: { whitespace: 'condense' } } });`,
      'config/custom.ts': `
        import vue from '@vitejs/plugin-vue';
        export default { plugins: [vue({ template: { compilerOptions: { whitespace: 'preserve' } } })] };
      `,
    });

    expect(
      resolveVueCompilerOptions(root, undefined, {
        viteConfigPath: 'config/custom.ts',
      })
    ).toEqual({
      compilerOptions: { whitespace: 'preserve' },
      errors: [],
    });
  });

  it.each([
    ['a missing file', 'missing.ts', 'Could not find'],
    ['an outside-root file', '../outside.ts', 'outside the project'],
    [
      'a node_modules file',
      'node_modules/vite.config.ts',
      'outside the project',
    ],
    ['an unsupported file', 'vite.config.json', 'unsupported Vite config'],
  ])(
    'rejects %s as an explicit Vite config',
    (_name, viteConfigPath, error) => {
      const root = createProject({
        'node_modules/vite.config.ts': 'export default {};',
        'vite.config.json': '{}',
      });

      const result = resolveVueCompilerOptions(root, undefined, {
        viteConfigPath,
      });

      expect(result.compilerOptions).toEqual({});
      expect(result.errors.join('\n')).toContain(error);
    }
  );

  it('conflict-checks explicit options against a custom Vite config', () => {
    const root = createProject({
      'custom.mts': `
        import vue from '@vitejs/plugin-vue';
        export default { plugins: [vue({ template: { compilerOptions: { whitespace: 'preserve' } } })] };
      `,
    });

    const result = resolveVueCompilerOptions(
      root,
      { whitespace: 'condense' },
      { viteConfigPath: 'custom.mts' }
    );

    expect(result.compilerOptions).toEqual({ whitespace: 'condense' });
    expect(result.errors.join('\n')).toContain(
      'conflicting Vue whitespace compiler options'
    );
  });
});

function createProject(files: Record<string, string>): string {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'gt-vue-extractor-config-')
  );
  temporaryDirectories.push(directory);
  for (const [filename, source] of Object.entries(files)) {
    const file = path.join(directory, filename);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, source);
  }
  return directory;
}
