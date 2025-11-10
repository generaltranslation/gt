import { describe, it, expect } from 'vitest';
import * as t from '@babel/types';
import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import { isCreateElement } from '../isCreateElement.js';

function createTestCode(code: string) {
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
  });
  return ast;
}

function findCallExpression(
  code: string,
  calleeName: string
): NodePath<t.CallExpression> | null {
  const ast = createTestCode(code);
  let foundCallExpression: NodePath<t.CallExpression> | null = null;

  traverse(ast, {
    CallExpression(path) {
      const callee = path.get('callee');
      if (
        callee.isIdentifier() &&
        callee.node.name === calleeName &&
        !foundCallExpression
      ) {
        foundCallExpression = path;
      }
    },
  });

  return foundCallExpression;
}

function findMemberCallExpression(
  code: string,
  objectName: string,
  propertyName: string
): NodePath<t.CallExpression> | null {
  const ast = createTestCode(code);
  let foundCallExpression: NodePath<t.CallExpression> | null = null;

  traverse(ast, {
    CallExpression(path) {
      const callee = path.get('callee');
      if (
        callee.isMemberExpression() &&
        callee.node.object.type === 'Identifier' &&
        callee.node.object.name === objectName &&
        callee.node.property.type === 'Identifier' &&
        callee.node.property.name === propertyName &&
        !foundCallExpression
      ) {
        foundCallExpression = path;
      }
    },
  });

  return foundCallExpression;
}

describe('isCreateElement', () => {
  describe('createElement detection', () => {
    describe('ESM imports', () => {
      it('should detect createElement from named import', () => {
        const code = `
          import { createElement } from 'react';
          createElement('div', null, 'Hello');
        `;

        const callExpr = findCallExpression(code, 'createElement');
        expect(callExpr).not.toBeNull();

        const result = isCreateElement(callExpr!);
        expect(result).toBe(true);
      });

      it('should detect createElement from default import', () => {
        const code = `
          import React from 'react';
          React.createElement('div', null, 'Hello');
        `;

        const callExpr = findMemberCallExpression(
          code,
          'React',
          'createElement'
        );
        expect(callExpr).not.toBeNull();

        const result = isCreateElement(callExpr!);
        expect(result).toBe(true);
      });

      it('should detect createElement from namespace import', () => {
        const code = `
          import * as React from 'react';
          React.createElement('div', null, 'Hello');
        `;

        const callExpr = findMemberCallExpression(
          code,
          'React',
          'createElement'
        );
        expect(callExpr).not.toBeNull();

        const result = isCreateElement(callExpr!);
        expect(result).toBe(true);
      });

      it('should detect createElement with alias', () => {
        const code = `
          import { createElement as ce } from 'react';
          ce('div', null, 'Hello');
        `;

        const callExpr = findCallExpression(code, 'ce');
        expect(callExpr).not.toBeNull();

        const result = isCreateElement(callExpr!);
        expect(result).toBe(true);
      });
    });

    describe('CommonJS imports', () => {
      it('should detect createElement from require', () => {
        const code = `
          const React = require('react');
          React.createElement('div', null, 'Hello');
        `;

        const callExpr = findMemberCallExpression(
          code,
          'React',
          'createElement'
        );
        expect(callExpr).not.toBeNull();

        const result = isCreateElement(callExpr!);
        expect(result).toBe(true);
      });

      it('should detect createElement from destructured require', () => {
        const code = `
          const { createElement } = require('react');
          createElement('div', null, 'Hello');
        `;

        const callExpr = findCallExpression(code, 'createElement');
        expect(callExpr).not.toBeNull();

        const result = isCreateElement(callExpr!);
        expect(result).toBe(true);
      });

      it('should detect createElement from require with property access', () => {
        const code = `
          const createElement = require('react').createElement;
          createElement('div', null, 'Hello');
        `;

        const callExpr = findCallExpression(code, 'createElement');
        expect(callExpr).not.toBeNull();

        const result = isCreateElement(callExpr!);
        expect(result).toBe(true);
      });
    });
  });

  describe('jsx runtime functions', () => {
    describe('jsx function', () => {
      it('should detect jsx from jsx-runtime named import', () => {
        const code = `
          import { jsx } from 'react/jsx-runtime';
          jsx('div', { children: 'Hello' });
        `;

        const callExpr = findCallExpression(code, 'jsx');
        expect(callExpr).not.toBeNull();

        const result = isCreateElement(callExpr!);
        expect(result).toBe(true);
      });

      it('should detect jsx with alias', () => {
        const code = `
          import { jsx as jsxFunc } from 'react/jsx-runtime';
          jsxFunc('div', { children: 'Hello' });
        `;

        const callExpr = findCallExpression(code, 'jsxFunc');
        expect(callExpr).not.toBeNull();

        const result = isCreateElement(callExpr!);
        expect(result).toBe(true);
      });

      it('should detect jsx from destructured require', () => {
        const code = `
          const { jsx } = require('react/jsx-runtime');
          jsx('div', { children: 'Hello' });
        `;

        const callExpr = findCallExpression(code, 'jsx');
        expect(callExpr).not.toBeNull();

        const result = isCreateElement(callExpr!);
        expect(result).toBe(true);
      });
    });

    describe('jsxs function', () => {
      it('should detect jsxs from jsx-runtime named import', () => {
        const code = `
          import { jsxs } from 'react/jsx-runtime';
          jsxs('div', { children: ['Hello', ' ', 'World'] });
        `;

        const callExpr = findCallExpression(code, 'jsxs');
        expect(callExpr).not.toBeNull();

        const result = isCreateElement(callExpr!);
        expect(result).toBe(true);
      });

      it('should detect jsxs with alias', () => {
        const code = `
          import { jsxs as jsxsFunc } from 'react/jsx-runtime';
          jsxsFunc('div', { children: ['Hello', ' ', 'World'] });
        `;

        const callExpr = findCallExpression(code, 'jsxsFunc');
        expect(callExpr).not.toBeNull();

        const result = isCreateElement(callExpr!);
        expect(result).toBe(true);
      });

      it('should detect jsxs from destructured require', () => {
        const code = `
          const { jsxs } = require('react/jsx-runtime');
          jsxs('div', { children: ['Hello', ' ', 'World'] });
        `;

        const callExpr = findCallExpression(code, 'jsxs');
        expect(callExpr).not.toBeNull();

        const result = isCreateElement(callExpr!);
        expect(result).toBe(true);
      });
    });

    describe('jsxDEV function', () => {
      it('should detect jsxDEV from jsx-dev-runtime named import', () => {
        const code = `
          import { jsxDEV } from 'react/jsx-dev-runtime';
          jsxDEV('div', { children: 'Hello' }, undefined, false, { fileName: 'test.js', lineNumber: 1 });
        `;

        const callExpr = findCallExpression(code, 'jsxDEV');
        expect(callExpr).not.toBeNull();

        const result = isCreateElement(callExpr!);
        expect(result).toBe(true);
      });

      it('should detect jsxDEV with alias', () => {
        const code = `
          import { jsxDEV as jsxDEVFunc } from 'react/jsx-dev-runtime';
          jsxDEVFunc('div', { children: 'Hello' }, undefined, false, { fileName: 'test.js', lineNumber: 1 });
        `;

        const callExpr = findCallExpression(code, 'jsxDEVFunc');
        expect(callExpr).not.toBeNull();

        const result = isCreateElement(callExpr!);
        expect(result).toBe(true);
      });

      it('should detect jsxDEV from destructured require', () => {
        const code = `
          const { jsxDEV } = require('react/jsx-dev-runtime');
          jsxDEV('div', { children: 'Hello' }, undefined, false, { fileName: 'test.js', lineNumber: 1 });
        `;

        const callExpr = findCallExpression(code, 'jsxDEV');
        expect(callExpr).not.toBeNull();

        const result = isCreateElement(callExpr!);
        expect(result).toBe(true);
      });
    });
  });

  describe('Member expression scenarios', () => {
    it('should detect React.createElement from default import', () => {
      const code = `
        import React from 'react';
        React.createElement('div', null, 'Hello');
      `;

      const callExpr = findMemberCallExpression(code, 'React', 'createElement');
      expect(callExpr).not.toBeNull();

      const result = isCreateElement(callExpr!);
      expect(result).toBe(true);
    });

    it('should detect React.createElement from namespace import', () => {
      const code = `
        import * as React from 'react';
        React.createElement('div', null, 'Hello');
      `;

      const callExpr = findMemberCallExpression(code, 'React', 'createElement');
      expect(callExpr).not.toBeNull();

      const result = isCreateElement(callExpr!);
      expect(result).toBe(true);
    });

    it('should detect React.createElement from CJS require', () => {
      const code = `
        const React = require('react');
        React.createElement('div', null, 'Hello');
      `;

      const callExpr = findMemberCallExpression(code, 'React', 'createElement');
      expect(callExpr).not.toBeNull();

      const result = isCreateElement(callExpr!);
      expect(result).toBe(true);
    });
  });

  describe('Mixed scenarios', () => {
    it('should detect multiple React element creators in same file', () => {
      const code = `
        import React from 'react';
        import { jsx, jsxs } from 'react/jsx-runtime';
        import { jsxDEV } from 'react/jsx-dev-runtime';
        
        React.createElement('div', null, 'Hello');
        jsx('span', { children: 'World' });
        jsxs('div', { children: ['Hello', ' ', 'World'] });
        jsxDEV('p', { children: 'Debug' }, undefined, false, {});
      `;

      const createElementCall = findMemberCallExpression(
        code,
        'React',
        'createElement'
      );
      const jsxCall = findCallExpression(code, 'jsx');
      const jsxsCall = findCallExpression(code, 'jsxs');
      const jsxDEVCall = findCallExpression(code, 'jsxDEV');

      expect(createElementCall).not.toBeNull();
      expect(jsxCall).not.toBeNull();
      expect(jsxsCall).not.toBeNull();
      expect(jsxDEVCall).not.toBeNull();

      expect(isCreateElement(createElementCall!)).toBe(true);
      expect(isCreateElement(jsxCall!)).toBe(true);
      expect(isCreateElement(jsxsCall!)).toBe(true);
      expect(isCreateElement(jsxDEVCall!)).toBe(true);
    });

    it('should handle mixed import styles in same file', () => {
      const code = `
        import React from 'react';
        const { jsx } = require('react/jsx-runtime');
        
        React.createElement('div', null, 'Hello');
        jsx('span', { children: 'World' });
      `;

      const createElementCall = findMemberCallExpression(
        code,
        'React',
        'createElement'
      );
      const jsxCall = findCallExpression(code, 'jsx');

      expect(createElementCall).not.toBeNull();
      expect(jsxCall).not.toBeNull();

      expect(isCreateElement(createElementCall!)).toBe(true);
      expect(isCreateElement(jsxCall!)).toBe(true);
    });
  });

  describe('Real-world example patterns', () => {
    it('should detect React.createElement in getEntityNames example', () => {
      const code = `
        import React from 'react';
        import Link from 'next/link';
        import { Branch, Num, Var } from 'gt-react';

        export function getEntityNames({ entities, onClick }) {
          const alpha = 'Alpha';
          
          return (
            React.createElement(
              Link,
              null,
              React.createElement(Branch, {
                branch: alpha != null,
                true: React.createElement(Var, null, alpha),
                false: 'Unknown entity',
              })
            )
          );
        }
      `;

      const callExpr = findMemberCallExpression(code, 'React', 'createElement');
      expect(callExpr).not.toBeNull();

      const result = isCreateElement(callExpr!);
      expect(result).toBe(true);
    });

    it('should detect jsx runtime functions in compiled JSX', () => {
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        
        function Component() {
          return jsxs('div', {
            children: [
              jsx('h1', { children: 'Title' }),
              jsx('p', { children: 'Content' })
            ]
          });
        }
      `;

      const jsxCall = findCallExpression(code, 'jsx');
      const jsxsCall = findCallExpression(code, 'jsxs');

      expect(jsxCall).not.toBeNull();
      expect(jsxsCall).not.toBeNull();

      expect(isCreateElement(jsxCall!)).toBe(true);
      expect(isCreateElement(jsxsCall!)).toBe(true);
    });

    it('should detect jsxDEV in development builds', () => {
      const code = `
        import { jsxDEV } from 'react/jsx-dev-runtime';
        
        function Component() {
          return jsxDEV('div', {
            children: jsxDEV('span', { children: 'Hello' }, undefined, false, {
              fileName: 'Component.jsx',
              lineNumber: 4,
              columnNumber: 12
            })
          }, undefined, false, {
            fileName: 'Component.jsx',
            lineNumber: 3,
            columnNumber: 10
          });
        }
      `;

      const callExpr = findCallExpression(code, 'jsxDEV');
      expect(callExpr).not.toBeNull();

      const result = isCreateElement(callExpr!);
      expect(result).toBe(true);
    });
  });

  describe('Negative test cases', () => {
    it('should return false for non-React function calls', () => {
      const code = `
        function customFunction() {}
        customFunction('div', null, 'Hello');
      `;

      const callExpr = findCallExpression(code, 'customFunction');
      expect(callExpr).not.toBeNull();

      const result = isCreateElement(callExpr!);
      expect(result).toBe(false);
    });

    it('should return false for wrong import source', () => {
      const code = `
        import { createElement } from 'vue';
        createElement('div', null, 'Hello');
      `;

      const callExpr = findCallExpression(code, 'createElement');
      expect(callExpr).not.toBeNull();

      const result = isCreateElement(callExpr!);
      expect(result).toBe(false);
    });

    it('should return false for wrong function name', () => {
      const code = `
        import { wrongFunction } from 'react';
        wrongFunction('div', null, 'Hello');
      `;

      const callExpr = findCallExpression(code, 'wrongFunction');
      expect(callExpr).not.toBeNull();

      const result = isCreateElement(callExpr!);
      expect(result).toBe(false);
    });

    it('should return false for local function with same name', () => {
      const code = `
        function createElement() { return null; }
        createElement('div', null, 'Hello');
      `;

      const callExpr = findCallExpression(code, 'createElement');
      expect(callExpr).not.toBeNull();

      const result = isCreateElement(callExpr!);
      expect(result).toBe(false);
    });

    it('should return false for member expression on non-React object', () => {
      const code = `
        const MyObject = { createElement: () => {} };
        MyObject.createElement('div', null, 'Hello');
      `;

      const callExpr = findMemberCallExpression(
        code,
        'MyObject',
        'createElement'
      );
      expect(callExpr).not.toBeNull();

      const result = isCreateElement(callExpr!);
      expect(result).toBe(false);
    });

    it('should return false for jsx from wrong import source', () => {
      const code = `
        import { jsx } from 'preact/jsx-runtime';
        jsx('div', { children: 'Hello' });
      `;

      const callExpr = findCallExpression(code, 'jsx');
      expect(callExpr).not.toBeNull();

      const result = isCreateElement(callExpr!);
      expect(result).toBe(false);
    });

    it('should return false for jsxDEV from wrong import source', () => {
      const code = `
        import { jsxDEV } from 'preact/jsx-dev-runtime';
        jsxDEV('div', { children: 'Hello' });
      `;

      const callExpr = findCallExpression(code, 'jsxDEV');
      expect(callExpr).not.toBeNull();

      const result = isCreateElement(callExpr!);
      expect(result).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle complex interop wrappers', () => {
      const code = `
        function interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
        const React = interopRequireDefault(require('react')).default;
        React.createElement('div', null, 'Hello');
      `;

      const callExpr = findMemberCallExpression(code, 'React', 'createElement');
      expect(callExpr).not.toBeNull();

      const result = isCreateElement(callExpr!);
      expect(result).toBe(true);
    });

    it('should handle React function calls without arguments', () => {
      const code = `
        import React from 'react';
        React.createElement();
      `;

      const callExpr = findMemberCallExpression(code, 'React', 'createElement');
      expect(callExpr).not.toBeNull();

      const result = isCreateElement(callExpr!);
      expect(result).toBe(true);
    });

    it('should handle jsx function calls with complex arguments', () => {
      const code = `
        import { jsx } from 'react/jsx-runtime';
        jsx(Component, { 
          prop1: variable,
          prop2: { nested: { object: true } },
          prop3: [1, 2, 3],
          children: jsx('span', { children: 'nested' })
        });
      `;

      const callExpr = findCallExpression(code, 'jsx');
      expect(callExpr).not.toBeNull();

      const result = isCreateElement(callExpr!);
      expect(result).toBe(true);
    });
  });
});
