import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import {
  checkCompilerImport,
  CheckCompilerImportResult,
} from '../checkCompilerImport';

describe('checkCompilerImport', () => {
  // Helper function to parse code and run checkCompilerImport
  function parseAndCheck(code: string): CheckCompilerImportResult {
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });
    return checkCompilerImport(ast);
  }

  describe('Import Declarations', () => {
    describe('Named imports', () => {
      it('should detect vite named import without alias', () => {
        const code = `import { vite } from '@generaltranslation/compiler';`;
        const result = parseAndCheck(code);

        expect(result.hasCompilerImport).toBe(true);
        expect(result.alias).toBe('vite');
        expect(result.namespaces).toEqual([]);
      });

      it('should detect vite named import with alias', () => {
        const code = `import { vite as gtCompiler } from '@generaltranslation/compiler';`;
        const result = parseAndCheck(code);

        expect(result.hasCompilerImport).toBe(true);
        expect(result.alias).toBe('gtCompiler');
        expect(result.namespaces).toEqual([]);
      });

      it('should detect vite among multiple named imports', () => {
        const code = `import { otherThing, vite, anotherThing } from '@generaltranslation/compiler';`;
        const result = parseAndCheck(code);

        expect(result.hasCompilerImport).toBe(true);
        expect(result.alias).toBe('vite');
        expect(result.namespaces).toEqual([]);
      });

      it('should detect vite with alias among multiple imports', () => {
        const code = `import { otherThing, vite as gtCompiler, anotherThing } from '@generaltranslation/compiler';`;
        const result = parseAndCheck(code);

        expect(result.hasCompilerImport).toBe(true);
        expect(result.alias).toBe('gtCompiler');
        expect(result.namespaces).toEqual([]);
      });

      it('should not detect non-vite named imports', () => {
        const code = `import { otherThing, something } from '@generaltranslation/compiler';`;
        const result = parseAndCheck(code);

        expect(result.hasCompilerImport).toBe(false);
        expect(result.alias).toBe(null);
        expect(result.namespaces).toEqual([]);
      });
    });

    describe('Default imports', () => {
      it('should detect default import', () => {
        const code = `import gtCompiler from '@generaltranslation/compiler';`;
        const result = parseAndCheck(code);

        expect(result.hasCompilerImport).toBe(true);
        expect(result.alias).toBe(null);
        expect(result.namespaces).toEqual(['gtCompiler']);
      });
    });

    describe('Namespace imports', () => {
      it('should detect namespace import', () => {
        const code = `import * as gtCompiler from '@generaltranslation/compiler';`;
        const result = parseAndCheck(code);

        expect(result.hasCompilerImport).toBe(true);
        expect(result.alias).toBe(null);
        expect(result.namespaces).toEqual(['gtCompiler']);
      });
    });

    describe('Mixed imports', () => {
      it('should detect mixed default and named imports', () => {
        const code = `import gtDefault, { vite } from '@generaltranslation/compiler';`;
        const result = parseAndCheck(code);

        expect(result.hasCompilerImport).toBe(true);
        expect(result.alias).toBe('vite');
        expect(result.namespaces).toEqual(['gtDefault']);
      });

      it('should detect mixed default and named imports with alias', () => {
        const code = `import gtDefault, { vite as compiler } from '@generaltranslation/compiler';`;
        const result = parseAndCheck(code);

        expect(result.hasCompilerImport).toBe(true);
        expect(result.alias).toBe('compiler');
        expect(result.namespaces).toEqual(['gtDefault']);
      });

      it('should detect mixed default and other named imports', () => {
        const code = `import gtDefault, { otherThing } from '@generaltranslation/compiler';`;
        const result = parseAndCheck(code);

        expect(result.hasCompilerImport).toBe(true);
        expect(result.alias).toBe(null);
        expect(result.namespaces).toEqual(['gtDefault']);
      });
    });

    describe('Wrong package imports', () => {
      it('should not detect imports from different packages', () => {
        const code = `import { vite } from '@different/package';`;
        const result = parseAndCheck(code);

        expect(result.hasCompilerImport).toBe(false);
        expect(result.alias).toBe(null);
        expect(result.namespaces).toEqual([]);
      });

      it('should not detect imports from similar package names', () => {
        const code = `import { vite } from '@generaltranslation/compiler-different';`;
        const result = parseAndCheck(code);

        expect(result.hasCompilerImport).toBe(false);
        expect(result.alias).toBe(null);
        expect(result.namespaces).toEqual([]);
      });
    });
  });

  describe('Require Statements - Variable Declarations', () => {
    describe('Namespace assignments', () => {
      it('should detect namespace assignment with const', () => {
        const code = `const gtCompiler = require('@generaltranslation/compiler');`;
        const result = parseAndCheck(code);

        expect(result.hasCompilerImport).toBe(true);
        expect(result.alias).toBe(null);
        expect(result.namespaces).toEqual(['gtCompiler']);
      });

      it('should detect namespace assignment with let', () => {
        const code = `let gtCompiler = require('@generaltranslation/compiler');`;
        const result = parseAndCheck(code);

        expect(result.hasCompilerImport).toBe(true);
        expect(result.alias).toBe(null);
        expect(result.namespaces).toEqual(['gtCompiler']);
      });

      it('should detect namespace assignment with var', () => {
        const code = `var gtCompiler = require('@generaltranslation/compiler');`;
        const result = parseAndCheck(code);

        expect(result.hasCompilerImport).toBe(true);
        expect(result.alias).toBe(null);
        expect(result.namespaces).toEqual(['gtCompiler']);
      });
    });

    describe('Destructuring - vite property', () => {
      it('should detect vite destructuring without alias', () => {
        const code = `const { vite } = require('@generaltranslation/compiler');`;
        const result = parseAndCheck(code);

        expect(result.hasCompilerImport).toBe(true);
        expect(result.alias).toBe('vite');
        expect(result.namespaces).toEqual([]);
      });

      it('should detect vite destructuring with alias', () => {
        const code = `const { vite: gtCompiler } = require('@generaltranslation/compiler');`;
        const result = parseAndCheck(code);

        expect(result.hasCompilerImport).toBe(true);
        expect(result.alias).toBe('gtCompiler');
        expect(result.namespaces).toEqual([]);
      });

      it('should detect vite among multiple destructured properties', () => {
        const code = `const { otherThing, vite, anotherThing } = require('@generaltranslation/compiler');`;
        const result = parseAndCheck(code);

        expect(result.hasCompilerImport).toBe(true);
        expect(result.alias).toBe('vite');
        expect(result.namespaces).toEqual([]);
      });

      it('should detect vite with alias among multiple properties', () => {
        const code = `const { otherThing, vite: compiler, anotherThing } = require('@generaltranslation/compiler');`;
        const result = parseAndCheck(code);

        expect(result.hasCompilerImport).toBe(true);
        expect(result.alias).toBe('compiler');
        expect(result.namespaces).toEqual([]);
      });

      it('should not detect non-vite destructuring', () => {
        const code = `const { otherThing, something } = require('@generaltranslation/compiler');`;
        const result = parseAndCheck(code);

        expect(result.hasCompilerImport).toBe(false);
        expect(result.alias).toBe(null);
        expect(result.namespaces).toEqual([]);
      });
    });

    describe('Destructuring - rest elements', () => {
      it('should detect single rest element', () => {
        const code = `const { ...everything } = require('@generaltranslation/compiler');`;
        const result = parseAndCheck(code);

        expect(result.hasCompilerImport).toBe(true);
        expect(result.alias).toBe(null);
        expect(result.namespaces).toEqual(['everything']);
      });

      it('should detect rest element with other properties', () => {
        const code = `const { otherThing, ...rest } = require('@generaltranslation/compiler');`;
        const result = parseAndCheck(code);

        expect(result.hasCompilerImport).toBe(true);
        expect(result.alias).toBe(null);
        expect(result.namespaces).toEqual(['rest']);
      });

      it('should detect multiple rest elements', () => {
        const code = `const { b, ...second } = require('@generaltranslation/compiler');`;
        const result = parseAndCheck(code);

        expect(result.hasCompilerImport).toBe(true);
        expect(result.alias).toBe(null);
        expect(result.namespaces).toEqual(['second']);
      });

      it('should prioritize vite over rest elements when vite is present', () => {
        const code = `const { vite, ...rest } = require('@generaltranslation/compiler');`;
        const result = parseAndCheck(code);

        expect(result.hasCompilerImport).toBe(true);
        expect(result.alias).toBe('vite');
        expect(result.namespaces).toEqual([]);
      });

      it('should prioritize vite with alias over rest elements', () => {
        const code = `const { vite: compiler, ...rest } = require('@generaltranslation/compiler');`;
        const result = parseAndCheck(code);

        expect(result.hasCompilerImport).toBe(true);
        expect(result.alias).toBe('compiler');
        expect(result.namespaces).toEqual([]);
      });
    });

    describe('Member access', () => {
      it('should detect member access to vite property', () => {
        const code = `const gtCompiler = require('@generaltranslation/compiler').vite;`;
        const result = parseAndCheck(code);

        expect(result.hasCompilerImport).toBe(true);
        expect(result.alias).toBe('gtCompiler');
        expect(result.namespaces).toEqual([]);
      });

      it('should not detect member access to non-vite properties', () => {
        const code = `const something = require('@generaltranslation/compiler').otherProperty;`;
        const result = parseAndCheck(code);

        expect(result.hasCompilerImport).toBe(false);
        expect(result.alias).toBe(null);
        expect(result.namespaces).toEqual([]);
      });
    });

    describe('Wrong package requires', () => {
      it('should not detect requires from different packages', () => {
        const code = `const { vite } = require('@different/package');`;
        const result = parseAndCheck(code);

        expect(result.hasCompilerImport).toBe(false);
        expect(result.alias).toBe(null);
        expect(result.namespaces).toEqual([]);
      });

      it('should not detect requires from similar package names', () => {
        const code = `const gtCompiler = require('@generaltranslation/compiler-different');`;
        const result = parseAndCheck(code);

        expect(result.hasCompilerImport).toBe(false);
        expect(result.alias).toBe(null);
        expect(result.namespaces).toEqual([]);
      });
    });

    describe('Multiple variable declarations', () => {
      it('should detect compiler import in multiple declarations', () => {
        const code = `const a = 1, gtCompiler = require('@generaltranslation/compiler'), b = 2;`;
        const result = parseAndCheck(code);

        expect(result.hasCompilerImport).toBe(true);
        expect(result.alias).toBe(null);
        expect(result.namespaces).toEqual(['gtCompiler']);
      });

      it('should detect vite destructuring in multiple declarations', () => {
        const code = `const a = 1, { vite } = require('@generaltranslation/compiler'), b = 2;`;
        const result = parseAndCheck(code);

        expect(result.hasCompilerImport).toBe(true);
        expect(result.alias).toBe('vite');
        expect(result.namespaces).toEqual([]);
      });
    });
  });

  describe('Mixed scenarios', () => {
    it('should handle multiple import and require statements', () => {
      const code = `
        import { otherThing } from '@generaltranslation/compiler';
        const { vite } = require('@generaltranslation/compiler');
      `;
      const result = parseAndCheck(code);

      expect(result.hasCompilerImport).toBe(true);
      expect(result.alias).toBe('vite');
      expect(result.namespaces).toEqual([]);
    });

    it('should handle namespace import and vite require', () => {
      const code = `
        import * as gtImport from '@generaltranslation/compiler';
        const { vite: compiler } = require('@generaltranslation/compiler');
      `;
      const result = parseAndCheck(code);

      expect(result.hasCompilerImport).toBe(true);
      expect(result.alias).toBe('compiler');
      expect(result.namespaces).toEqual(['gtImport']);
    });

    it('should accumulate all namespaces from multiple statements', () => {
      const code = `
        import * as gtImport from '@generaltranslation/compiler';
        import gtDefault from '@generaltranslation/compiler';
        const gtRequire = require('@generaltranslation/compiler');
        const { ...rest } = require('@generaltranslation/compiler');
      `;
      const result = parseAndCheck(code);

      expect(result.hasCompilerImport).toBe(true);
      expect(result.alias).toBe(null);
      expect(result.namespaces).toEqual([
        'gtImport',
        'gtDefault',
        'gtRequire',
        'rest',
      ]);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty file', () => {
      const code = ``;
      const result = parseAndCheck(code);

      expect(result.hasCompilerImport).toBe(false);
      expect(result.alias).toBe(null);
      expect(result.namespaces).toEqual([]);
    });

    it('should handle file with only comments', () => {
      const code = `
        // This is a comment
        /* This is another comment */
      `;
      const result = parseAndCheck(code);

      expect(result.hasCompilerImport).toBe(false);
      expect(result.alias).toBe(null);
      expect(result.namespaces).toEqual([]);
    });

    it('should handle file with unrelated imports and requires', () => {
      const code = `
        import { something } from 'other-package';
        const config = require('./config');
        const fs = require('fs');
      `;
      const result = parseAndCheck(code);

      expect(result.hasCompilerImport).toBe(false);
      expect(result.alias).toBe(null);
      expect(result.namespaces).toEqual([]);
    });

    it('should handle complex destructuring patterns', () => {
      const code = `const { a: { b: { vite } } } = require('@generaltranslation/compiler');`;
      const result = parseAndCheck(code);

      // This is a nested destructuring pattern that the current implementation doesn't handle
      expect(result.hasCompilerImport).toBe(false);
      expect(result.alias).toBe(null);
      expect(result.namespaces).toEqual([]);
    });

    it('should handle array destructuring (not handled by implementation)', () => {
      const code = `const [vite] = require('@generaltranslation/compiler');`;
      const result = parseAndCheck(code);

      // Array destructuring is not handled by the current implementation
      expect(result.hasCompilerImport).toBe(false);
      expect(result.alias).toBe(null);
      expect(result.namespaces).toEqual([]);
    });

    it('should handle computed property access', () => {
      const code = `const compiler = require('@generaltranslation/compiler')['vite'];`;
      const result = parseAndCheck(code);

      // Computed property access is not handled by the current implementation
      expect(result.hasCompilerImport).toBe(false);
      expect(result.alias).toBe(null);
      expect(result.namespaces).toEqual([]);
    });

    it('should handle dynamic requires (not detected)', () => {
      const code = `const packageName = '@generaltranslation/compiler'; const gt = require(packageName);`;
      const result = parseAndCheck(code);

      // Dynamic requires are not handled
      expect(result.hasCompilerImport).toBe(false);
      expect(result.alias).toBe(null);
      expect(result.namespaces).toEqual([]);
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle typical Vite config with ESM imports', () => {
      const code = `
        import { defineConfig } from 'vite';
        import react from '@vitejs/plugin-react';
        import { vite as gtCompiler } from '@generaltranslation/compiler';

        export default defineConfig({
          plugins: [react(), gtCompiler()],
        });
      `;
      const result = parseAndCheck(code);

      expect(result.hasCompilerImport).toBe(true);
      expect(result.alias).toBe('gtCompiler');
      expect(result.namespaces).toEqual([]);
    });

    it('should handle CommonJS Vite config', () => {
      const code = `
        const { defineConfig } = require('vite');
        const react = require('@vitejs/plugin-react');
        const { vite: gtCompiler } = require('@generaltranslation/compiler');

        module.exports = defineConfig({
          plugins: [react(), gtCompiler()],
        });
      `;
      const result = parseAndCheck(code);

      expect(result.hasCompilerImport).toBe(true);
      expect(result.alias).toBe('gtCompiler');
      expect(result.namespaces).toEqual([]);
    });

    it('should handle mixed ESM/CommonJS (though unusual)', () => {
      const code = `
        import { defineConfig } from 'vite';
        const { vite } = require('@generaltranslation/compiler');

        export default defineConfig({
          plugins: [vite()],
        });
      `;
      const result = parseAndCheck(code);

      expect(result.hasCompilerImport).toBe(true);
      expect(result.alias).toBe('vite');
      expect(result.namespaces).toEqual([]);
    });
  });
});
