import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import { checkPluginInvocation } from '../checkPluginInvocation';

describe('checkPluginInvocation', () => {
  // Helper function to parse code and run checkPluginInvocation
  function parseAndCheck(
    code: string,
    alias: string | null,
    namespaces: string[] = []
  ): boolean {
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });
    return checkPluginInvocation({ ast, alias, namespaces });
  }

  describe('Direct alias invocation in default export', () => {
    it('should detect direct alias invocation in simple export', () => {
      const code = `
        import { defineConfig } from 'vite';
        import { vite as gtCompiler } from '@generaltranslation/compiler';
        
        export default defineConfig({
          plugins: [gtCompiler()]
        });
      `;

      const result = parseAndCheck(code, 'gtCompiler');
      expect(result).toBe(true);
    });

    it('should detect direct alias invocation among multiple plugins', () => {
      const code = `
        import { defineConfig } from 'vite';
        import react from '@vitejs/plugin-react';
        import { vite as gtCompiler } from '@generaltranslation/compiler';
        
        export default defineConfig({
          plugins: [react(), gtCompiler(), someOtherPlugin()]
        });
      `;

      const result = parseAndCheck(code, 'gtCompiler');
      expect(result).toBe(true);
    });

    it('should detect alias invocation with different alias names', () => {
      const code = `
        export default defineConfig({
          plugins: [myCustomAlias()]
        });
      `;

      const result = parseAndCheck(code, 'myCustomAlias');
      expect(result).toBe(true);
    });

    it('should detect alias invocation in arrow function export', () => {
      const code = `
        export default () => defineConfig({
          plugins: [gtCompiler()]
        });
      `;

      const result = parseAndCheck(code, 'gtCompiler');
      expect(result).toBe(true);
    });

    it('should detect alias invocation in complex export expression', () => {
      const code = `
        export default defineConfig({
          plugins: [
            ...basePlugins,
            process.env.NODE_ENV === 'development' ? gtCompiler() : null,
            ...otherPlugins
          ].filter(Boolean)
        });
      `;

      const result = parseAndCheck(code, 'gtCompiler');
      expect(result).toBe(true);
    });
  });

  describe('Namespace member invocation in default export', () => {
    it('should detect namespace member invocation', () => {
      const code = `
        const gt = require('@generaltranslation/compiler');
        
        export default defineConfig({
          plugins: [gt.vite()]
        });
      `;

      const result = parseAndCheck(code, '', ['gt']);
      expect(result).toBe(true);
    });

    it('should detect namespace member invocation with import', () => {
      const code = `
        import * as gt from '@generaltranslation/compiler';
        
        export default defineConfig({
          plugins: [gt.vite()]
        });
      `;

      const result = parseAndCheck(code, '', ['gt']);
      expect(result).toBe(true);
    });

    it('should detect namespace member invocation among multiple namespaces', () => {
      const code = `
        export default defineConfig({
          plugins: [compiler.vite()]
        });
      `;

      const result = parseAndCheck(code, '', ['gt', 'compiler', 'other']);
      expect(result).toBe(true);
    });

    it('should detect default import namespace invocation', () => {
      const code = `
        import gtDefault from '@generaltranslation/compiler';
        
        export default defineConfig({
          plugins: [gtDefault.vite()]
        });
      `;

      const result = parseAndCheck(code, '', ['gtDefault']);
      expect(result).toBe(true);
    });
  });

  describe('Mixed scenarios', () => {
    it('should detect alias even when namespaces are also provided', () => {
      const code = `
        export default defineConfig({
          plugins: [gtCompiler()]
        });
      `;

      const result = parseAndCheck(code, 'gtCompiler', ['gt', 'other']);
      expect(result).toBe(true);
    });

    it('should detect namespace member when alias is also provided', () => {
      const code = `
        export default defineConfig({
          plugins: [gt.vite()]
        });
      `;

      const result = parseAndCheck(code, 'someAlias', ['gt']);
      expect(result).toBe(true);
    });

    it('should detect multiple invocations', () => {
      const code = `
        export default defineConfig({
          plugins: [
            gtCompiler(),
            gt.vite(),
            other.vite()
          ]
        });
      `;

      const result = parseAndCheck(code, 'gtCompiler', ['gt', 'other']);
      expect(result).toBe(true);
    });
  });

  describe('Cases that should be detected anywhere in file', () => {
    it('should detect invocation outside export statements', () => {
      const code = `
        const plugins = [gtCompiler()];
        
        export default defineConfig({
          plugins: []
        });
      `;

      const result = parseAndCheck(code, 'gtCompiler');
      expect(result).toBe(true); // Now detects anywhere
    });

    it('should detect invocation in regular functions', () => {
      const code = `
        function createConfig() {
          return defineConfig({
            plugins: [gtCompiler()]
          });
        }
        
        export default createConfig();
      `;

      const result = parseAndCheck(code, 'gtCompiler');
      expect(result).toBe(true); // Now detects anywhere
    });

    it('should detect invocation in named exports', () => {
      const code = `
        export const config = defineConfig({
          plugins: [gtCompiler()]
        });
      `;

      const result = parseAndCheck(code, 'gtCompiler');
      expect(result).toBe(true); // Now detects anywhere
    });

    it('should detect invocation in variable assignments', () => {
      const code = `
        const myConfig = {
          plugins: [gtCompiler()]
        };
      `;

      const result = parseAndCheck(code, 'gtCompiler');
      expect(result).toBe(true);
    });

    it('should detect invocation in conditional statements', () => {
      const code = `
        if (process.env.NODE_ENV === 'development') {
          const plugin = gtCompiler();
        }
      `;

      const result = parseAndCheck(code, 'gtCompiler');
      expect(result).toBe(true);
    });

    it('should detect namespace invocation in any context', () => {
      const code = `
        function setupPlugins() {
          const compiler = gt.vite();
          return [compiler];
        }
      `;

      const result = parseAndCheck(code, '', ['gt']);
      expect(result).toBe(true);
    });
  });

  describe('Cases that should NOT be detected', () => {
    it('should not detect wrong alias name', () => {
      const code = `
        export default defineConfig({
          plugins: [wrongAlias()]
        });
      `;

      const result = parseAndCheck(code, 'gtCompiler');
      expect(result).toBe(false);
    });

    it('should not detect wrong namespace', () => {
      const code = `
        export default defineConfig({
          plugins: [wrongNamespace.vite()]
        });
      `;

      const result = parseAndCheck(code, '', ['gt', 'compiler']);
      expect(result).toBe(false);
    });

    it('should not detect wrong method on correct namespace', () => {
      const code = `
        export default defineConfig({
          plugins: [gt.wrongMethod()]
        });
      `;

      const result = parseAndCheck(code, '', ['gt']);
      expect(result).toBe(false);
    });

    it('should not detect non-call expressions', () => {
      const code = `
        export default defineConfig({
          plugins: [gtCompiler]  // Missing () call
        });
      `;

      const result = parseAndCheck(code, 'gtCompiler');
      expect(result).toBe(false);
    });

    it('should not detect property access without method call', () => {
      const code = `
        export default defineConfig({
          plugins: [gt.vite]  // Missing () call
        });
      `;

      const result = parseAndCheck(code, '', ['gt']);
      expect(result).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty file', () => {
      const code = '';
      const result = parseAndCheck(code, 'gtCompiler');
      expect(result).toBe(false);
    });

    it('should handle file with no plugin invocations', () => {
      const code = `
        import { vite as gtCompiler } from '@generaltranslation/compiler';
        const config = defineConfig({
          plugins: [react(), typescript()]
        });
      `;

      const result = parseAndCheck(code, 'gtCompiler');
      expect(result).toBe(false);
    });

    it('should handle empty default export', () => {
      const code = 'export default {};';
      const result = parseAndCheck(code, 'gtCompiler');
      expect(result).toBe(false);
    });

    it('should detect invocations in nested objects', () => {
      const code = `
        export default {
          nested: {
            config: defineConfig({
              plugins: [gtCompiler()]
            })
          }
        };
      `;

      const result = parseAndCheck(code, 'gtCompiler');
      expect(result).toBe(true); // Detects anywhere in the file
    });

    it('should handle empty alias and empty namespaces', () => {
      const code = `
        export default defineConfig({
          plugins: [somePlugin()]
        });
      `;

      const result = parseAndCheck(code, '', []);
      expect(result).toBe(false);
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle typical Vite config with ESM', () => {
      const code = `
        import { defineConfig } from 'vite';
        import react from '@vitejs/plugin-react';
        import { vite as gtCompiler } from '@generaltranslation/compiler';
        
        export default defineConfig({
          plugins: [
            react(),
            gtCompiler({
              apiKey: process.env.GT_API_KEY,
              projectId: 'my-project'
            })
          ],
          build: {
            outDir: 'dist'
          }
        });
      `;

      const result = parseAndCheck(code, 'gtCompiler');
      expect(result).toBe(true);
    });

    it('should handle CommonJS Vite config', () => {
      const code = `
        const { defineConfig } = require('vite');
        const react = require('@vitejs/plugin-react');
        const gt = require('@generaltranslation/compiler');
        
        module.exports = defineConfig({
          plugins: [
            react(),
            gt.vite({
              apiKey: process.env.GT_API_KEY
            })
          ]
        });
      `;

      const result = parseAndCheck(code, '', ['gt']);
      expect(result).toBe(true);
    });

    it('should handle conditional plugin loading', () => {
      const code = `
        import { defineConfig } from 'vite';
        import { vite as gtCompiler } from '@generaltranslation/compiler';
        
        export default defineConfig({
          plugins: [
            ...(process.env.NODE_ENV === 'development' ? [gtCompiler()] : []),
            ...(process.env.ENABLE_GT ? [gtCompiler({ debug: true })] : [])
          ]
        });
      `;

      const result = parseAndCheck(code, 'gtCompiler');
      expect(result).toBe(true);
    });

    it('should handle Vite config as function', () => {
      const code = `
        import { defineConfig } from 'vite';
        import { vite as gtCompiler } from '@generaltranslation/compiler';
        
        export default defineConfig(({ command, mode }) => ({
          plugins: [
            gtCompiler({
              development: mode === 'development'
            })
          ]
        }));
      `;

      const result = parseAndCheck(code, 'gtCompiler');
      expect(result).toBe(true);
    });
  });

  describe('Additional comprehensive test cases', () => {
    it('should detect alias invocation in array literals', () => {
      const code = `
        const pluginList = [react(), gtCompiler(), typescript()];
      `;

      const result = parseAndCheck(code, 'gtCompiler');
      expect(result).toBe(true);
    });

    it('should detect namespace invocation in array literals', () => {
      const code = `
        const pluginList = [react(), compiler.vite(), typescript()];
      `;

      const result = parseAndCheck(code, '', ['compiler']);
      expect(result).toBe(true);
    });

    it('should detect invocation in object method calls', () => {
      const code = `
        const config = {
          setup() {
            return gtCompiler();
          }
        };
      `;

      const result = parseAndCheck(code, 'gtCompiler');
      expect(result).toBe(true);
    });

    it('should detect invocation in class methods', () => {
      const code = `
        class ConfigBuilder {
          buildPlugins() {
            return [gtCompiler()];
          }
        }
      `;

      const result = parseAndCheck(code, 'gtCompiler');
      expect(result).toBe(true);
    });

    it('should detect invocation as function arguments', () => {
      const code = `
        setupVite(gtCompiler(), { dev: true });
      `;

      const result = parseAndCheck(code, 'gtCompiler');
      expect(result).toBe(true);
    });

    it('should detect namespace invocation as function arguments', () => {
      const code = `
        setupVite(compiler.vite(), { dev: true });
      `;

      const result = parseAndCheck(code, '', ['compiler']);
      expect(result).toBe(true);
    });

    it('should detect invocation in try-catch blocks', () => {
      const code = `
        try {
          const plugin = gtCompiler();
        } catch (e) {
          console.error(e);
        }
      `;

      const result = parseAndCheck(code, 'gtCompiler');
      expect(result).toBe(true);
    });

    it('should detect invocation in async functions', () => {
      const code = `
        async function setupAsync() {
          const plugin = await Promise.resolve(gtCompiler());
          return plugin;
        }
      `;

      const result = parseAndCheck(code, 'gtCompiler');
      expect(result).toBe(true);
    });

    it('should detect invocation in arrow functions', () => {
      const code = `
        const getPlugin = () => gtCompiler();
        const getAsyncPlugin = async () => gt.vite();
      `;

      const result1 = parseAndCheck(code, 'gtCompiler');
      const result2 = parseAndCheck(code, '', ['gt']);
      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });

    it('should detect invocation in template literals (within expressions)', () => {
      const code = `
        const message = \`Plugin loaded: \${gtCompiler().name}\`;
      `;

      const result = parseAndCheck(code, 'gtCompiler');
      expect(result).toBe(true);
    });

    it('should detect invocation in switch statements', () => {
      const code = `
        function getPlugin(env) {
          switch (env) {
            case 'dev':
              return gtCompiler();
            default:
              return null;
          }
        }
      `;

      const result = parseAndCheck(code, 'gtCompiler');
      expect(result).toBe(true);
    });

    it('should detect invocation in for loops', () => {
      const code = `
        for (let i = 0; i < 5; i++) {
          plugins.push(gtCompiler());
        }
      `;

      const result = parseAndCheck(code, 'gtCompiler');
      expect(result).toBe(true);
    });

    it('should detect invocation in while loops', () => {
      const code = `
        while (condition) {
          const plugin = gt.vite();
          process(plugin);
        }
      `;

      const result = parseAndCheck(code, '', ['gt']);
      expect(result).toBe(true);
    });

    it('should not detect similar but different method names', () => {
      const code = `
        compiler.build(); // Not vite()
        compiler.dev();   // Not vite()
        gt.compile();     // Not vite()
      `;

      const result = parseAndCheck(code, '', ['compiler', 'gt']);
      expect(result).toBe(false);
    });

    it('should not detect when namespace matches but method is different', () => {
      const code = `
        gt.compile();
        gt.build();
        gt.setup();
      `;

      const result = parseAndCheck(code, '', ['gt']);
      expect(result).toBe(false);
    });

    it('should handle multiple aliases in same file', () => {
      const code = `
        const plugin1 = gtCompiler();
        const plugin2 = myCompiler();
        const plugin3 = customCompiler();
      `;

      const result1 = parseAndCheck(code, 'gtCompiler');
      const result2 = parseAndCheck(code, 'myCompiler');
      const result3 = parseAndCheck(code, 'customCompiler');
      const result4 = parseAndCheck(code, 'nonExistent');

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(true);
      expect(result4).toBe(false);
    });

    it('should handle multiple namespaces in same file', () => {
      const code = `
        const plugin1 = gt.vite();
        const plugin2 = compiler.build(); // Not vite
        const plugin3 = other.vite();
      `;

      const result1 = parseAndCheck(code, '', ['gt']);
      const result2 = parseAndCheck(code, '', ['compiler']);
      const result3 = parseAndCheck(code, '', ['other']);
      const result4 = parseAndCheck(code, '', ['nonExistent']);

      expect(result1).toBe(true);
      expect(result2).toBe(false); // compiler.build() not compiler.vite()
      expect(result3).toBe(true);
      expect(result4).toBe(false);
    });

    it('should detect invocation in complex nested expressions', () => {
      const code = `
        const result = someFunction(
          anotherFunction({
            plugins: [
              ...basePlugins,
              process.env.NODE_ENV === 'development' 
                ? gtCompiler({ debug: true })
                : null
            ].filter(Boolean)
          })
        );
      `;

      const result = parseAndCheck(code, 'gtCompiler');
      expect(result).toBe(true);
    });

    it('should handle null alias with empty namespaces', () => {
      const code = `
        const plugin = somePlugin();
      `;

      const result = parseAndCheck(code, null, []);
      expect(result).toBe(false);
    });

    it('should handle null alias but valid namespace', () => {
      const code = `
        const plugin = gt.vite();
      `;

      const result = parseAndCheck(code, null, ['gt']);
      expect(result).toBe(true);
    });
  });
});
