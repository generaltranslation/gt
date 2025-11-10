import { describe, it, expect } from 'vitest';
import * as t from '@babel/types';
import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import {
  identifierReferencesImport,
  memberExpressionReferencesImport,
} from '../validateIdentifier.js';

function createTestCode(code: string) {
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
  });
  return ast;
}

function findIdentifier(
  code: string,
  identifierName: string
): NodePath<t.Identifier> | null {
  const ast = createTestCode(code);
  let foundIdentifier: NodePath<t.Identifier> | null = null;

  traverse(ast, {
    Identifier(path) {
      if (path.node.name === identifierName && !foundIdentifier) {
        foundIdentifier = path;
      }
    },
  });

  return foundIdentifier;
}

function findMemberExpression(
  code: string,
  objectName: string,
  propertyName: string
): NodePath<t.MemberExpression> | null {
  const ast = createTestCode(code);
  let foundMemberExpression: NodePath<t.MemberExpression> | null = null;

  traverse(ast, {
    MemberExpression(path) {
      if (
        path.node.object.type === 'Identifier' &&
        path.node.object.name === objectName &&
        path.node.property.type === 'Identifier' &&
        path.node.property.name === propertyName &&
        !foundMemberExpression
      ) {
        foundMemberExpression = path;
      }
    },
  });

  return foundMemberExpression;
}

describe('validateIdentifier', () => {
  describe('ESM imports', () => {
    describe('named imports', () => {
      it('should validate named import identifier', () => {
        const code = `
          import { createElement } from 'react';
          createElement();
        `;

        const identifier = findIdentifier(code, 'createElement');
        expect(identifier).not.toBeNull();

        const result = identifierReferencesImport({
          identifier: identifier!,
          importSource: 'react',
          importName: 'createElement',
        });

        expect(result).toBe(true);
      });

      it('should validate named import with alias', () => {
        const code = `
          import { createElement as ce } from 'react';
          ce();
        `;

        const identifier = findIdentifier(code, 'ce');
        expect(identifier).not.toBeNull();

        const result = identifierReferencesImport({
          identifier: identifier!,
          importSource: 'react',
          importName: 'createElement',
        });

        expect(result).toBe(true);
      });

      it('should not validate named import with wrong import name', () => {
        const code = `
          import { createElement } from 'react';
          createElement();
        `;

        const identifier = findIdentifier(code, 'createElement');
        expect(identifier).not.toBeNull();

        const result = identifierReferencesImport({
          identifier: identifier!,
          importSource: 'react',
          importName: 'jsx',
        });

        expect(result).toBe(false);
      });

      it('should not validate named import with wrong source', () => {
        const code = `
          import { createElement } from 'react';
          createElement();
        `;

        const identifier = findIdentifier(code, 'createElement');
        expect(identifier).not.toBeNull();

        const result = identifierReferencesImport({
          identifier: identifier!,
          importSource: 'vue',
          importName: 'createElement',
        });

        expect(result).toBe(false);
      });
    });

    describe('default imports', () => {
      it('should validate default import identifier', () => {
        const code = `
          import React from 'react';
          React.createElement();
        `;

        const identifier = findIdentifier(code, 'React');
        expect(identifier).not.toBeNull();

        const result = identifierReferencesImport({
          identifier: identifier!,
          importSource: 'react',
        });

        expect(result).toBe(true);
      });

      it('should not validate default import with importName specified', () => {
        const code = `
          import React from 'react';
          React.createElement();
        `;

        const identifier = findIdentifier(code, 'React');
        expect(identifier).not.toBeNull();

        const result = identifierReferencesImport({
          identifier: identifier!,
          importSource: 'react',
          importName: 'createElement',
        });

        expect(result).toBe(false);
      });
    });

    describe('namespace imports', () => {
      it('should validate namespace import identifier', () => {
        const code = `
          import * as React from 'react';
          React.createElement();
        `;

        const identifier = findIdentifier(code, 'React');
        expect(identifier).not.toBeNull();

        const result = identifierReferencesImport({
          identifier: identifier!,
          importSource: 'react',
        });

        expect(result).toBe(true);
      });

      it('should not validate namespace import with importName specified', () => {
        const code = `
          import * as React from 'react';
          React.createElement();
        `;

        const identifier = findIdentifier(code, 'React');
        expect(identifier).not.toBeNull();

        const result = identifierReferencesImport({
          identifier: identifier!,
          importSource: 'react',
          importName: 'createElement',
        });

        expect(result).toBe(false);
      });
    });

    describe('jsx runtime imports', () => {
      it('should validate jsx function from jsx-runtime', () => {
        const code = `
          import { jsx } from 'react/jsx-runtime';
          jsx();
        `;

        const identifier = findIdentifier(code, 'jsx');
        expect(identifier).not.toBeNull();

        const result = identifierReferencesImport({
          identifier: identifier!,
          importSource: 'react/jsx-runtime',
          importName: 'jsx',
        });

        expect(result).toBe(true);
      });

      it('should validate jsxs function from jsx-runtime', () => {
        const code = `
          import { jsxs } from 'react/jsx-runtime';
          jsxs();
        `;

        const identifier = findIdentifier(code, 'jsxs');
        expect(identifier).not.toBeNull();

        const result = identifierReferencesImport({
          identifier: identifier!,
          importSource: 'react/jsx-runtime',
          importName: 'jsxs',
        });

        expect(result).toBe(true);
      });

      it('should validate jsxDEV function from jsx-dev-runtime', () => {
        const code = `
          import { jsxDEV } from 'react/jsx-dev-runtime';
          jsxDEV();
        `;

        const identifier = findIdentifier(code, 'jsxDEV');
        expect(identifier).not.toBeNull();

        const result = identifierReferencesImport({
          identifier: identifier!,
          importSource: 'react/jsx-dev-runtime',
          importName: 'jsxDEV',
        });

        expect(result).toBe(true);
      });
    });
  });

  describe('CommonJS imports', () => {
    describe('require with identifier assignment', () => {
      it('should validate simple require assignment', () => {
        const code = `
          const React = require('react');
          React.createElement();
        `;

        const identifier = findIdentifier(code, 'React');
        expect(identifier).not.toBeNull();

        const result = identifierReferencesImport({
          identifier: identifier!,
          importSource: 'react',
        });

        expect(result).toBe(true);
      });

      it('should not validate require with importName specified for plain require', () => {
        const code = `
          const React = require('react');
          React.createElement();
        `;

        const identifier = findIdentifier(code, 'React');
        expect(identifier).not.toBeNull();

        const result = identifierReferencesImport({
          identifier: identifier!,
          importSource: 'react',
          importName: 'createElement',
        });

        expect(result).toBe(false);
      });
    });

    describe('require with property access', () => {
      it('should validate require with .default property', () => {
        const code = `
          const React = require('react').default;
          React.createElement();
        `;

        const identifier = findIdentifier(code, 'React');
        expect(identifier).not.toBeNull();

        const result = identifierReferencesImport({
          identifier: identifier!,
          importSource: 'react',
          importName: 'default',
        });

        expect(result).toBe(true);
      });

      it('should validate require with specific property', () => {
        const code = `
          const createElement = require('react').createElement;
          createElement();
        `;

        const identifier = findIdentifier(code, 'createElement');
        expect(identifier).not.toBeNull();

        const result = identifierReferencesImport({
          identifier: identifier!,
          importSource: 'react',
          importName: 'createElement',
        });

        expect(result).toBe(true);
      });
    });

    describe('require with destructuring', () => {
      it('should validate destructured require', () => {
        const code = `
          const { createElement } = require('react');
          createElement();
        `;

        const identifier = findIdentifier(code, 'createElement');
        expect(identifier).not.toBeNull();

        const result = identifierReferencesImport({
          identifier: identifier!,
          importSource: 'react',
          importName: 'createElement',
        });

        expect(result).toBe(true);
      });

      it('should validate destructured require with alias', () => {
        const code = `
          const { createElement: ce } = require('react');
          ce();
        `;

        const identifier = findIdentifier(code, 'ce');
        expect(identifier).not.toBeNull();

        const result = identifierReferencesImport({
          identifier: identifier!,
          importSource: 'react',
          importName: 'createElement',
        });

        expect(result).toBe(true);
      });

      it('should not validate destructured require without importName', () => {
        const code = `
          const { createElement } = require('react');
          createElement();
        `;

        const identifier = findIdentifier(code, 'createElement');
        expect(identifier).not.toBeNull();

        const result = identifierReferencesImport({
          identifier: identifier!,
          importSource: 'react',
        });

        expect(result).toBe(false);
      });
    });

    describe('interop wrappers', () => {
      it('should validate interopRequireDefault wrapper', () => {
        const code = `
          function interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
          const React = interopRequireDefault(require('react'));
          React();
        `;

        const identifier = findIdentifier(code, 'React');
        expect(identifier).not.toBeNull();

        const result = identifierReferencesImport({
          identifier: identifier!,
          importSource: 'react',
        });

        expect(result).toBe(true);
      });

      it('should validate interop wrapper with .default access', () => {
        const code = `
          function interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
          const React = interopRequireDefault(require('react')).default;
          React();
        `;

        const identifier = findIdentifier(code, 'React');
        expect(identifier).not.toBeNull();

        const result = identifierReferencesImport({
          identifier: identifier!,
          importSource: 'react',
          importName: 'default',
        });

        expect(result).toBe(true);
      });

      it('should validate nested interop wrappers', () => {
        const code = `
          function interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
          function wrapperFunction(e) { return e; }
          const React = wrapperFunction(interopRequireDefault(require('react')));
          React();
        `;

        const identifier = findIdentifier(code, 'React');
        expect(identifier).not.toBeNull();

        const result = identifierReferencesImport({
          identifier: identifier!,
          importSource: 'react',
        });

        expect(result).toBe(true);
      });

      it('should validate optional chaining with interop', () => {
        const code = `
          function interopRequire(e) { return e && e.__esModule ? e : { default: e }; }
          const React = interopRequire(require('react'))?.default;
          React();
        `;

        const identifier = findIdentifier(code, 'React');
        expect(identifier).not.toBeNull();

        const result = identifierReferencesImport({
          identifier: identifier!,
          importSource: 'react',
          importName: 'default',
        });

        expect(result).toBe(true);
      });
    });
  });

  describe('edge cases', () => {
    it('should return false for identifier without binding', () => {
      const code = `
        nonExistentFunction();
      `;

      const identifier = findIdentifier(code, 'nonExistentFunction');
      expect(identifier).not.toBeNull();

      const result = identifierReferencesImport({
        identifier: identifier!,
        importSource: 'react',
        importName: 'createElement',
      });

      expect(result).toBe(false);
    });

    it('should return false for locally declared identifier', () => {
      const code = `
        function createElement() {}
        createElement();
      `;

      const identifier = findIdentifier(code, 'createElement');
      expect(identifier).not.toBeNull();

      const result = identifierReferencesImport({
        identifier: identifier!,
        importSource: 'react',
        importName: 'createElement',
      });

      expect(result).toBe(false);
    });

    it('should return false for variable declaration', () => {
      const code = `
        const createElement = () => {};
        createElement();
      `;

      const identifier = findIdentifier(code, 'createElement');
      expect(identifier).not.toBeNull();

      const result = identifierReferencesImport({
        identifier: identifier!,
        importSource: 'react',
        importName: 'createElement',
      });

      expect(result).toBe(false);
    });

    it('should handle mixed import types in same file', () => {
      const code = `
        import { jsx } from 'react/jsx-runtime';
        const React = require('react');
        jsx();
        React.createElement();
      `;

      const jsxIdentifier = findIdentifier(code, 'jsx');
      expect(jsxIdentifier).not.toBeNull();

      const jsxResult = identifierReferencesImport({
        identifier: jsxIdentifier!,
        importSource: 'react/jsx-runtime',
        importName: 'jsx',
      });

      expect(jsxResult).toBe(true);

      const reactIdentifier = findIdentifier(code, 'React');
      expect(reactIdentifier).not.toBeNull();

      const reactResult = identifierReferencesImport({
        identifier: reactIdentifier!,
        importSource: 'react',
      });

      expect(reactResult).toBe(true);
    });
  });

  describe('different library examples', () => {
    it('should work with custom libraries - ESM named import', () => {
      const code = `
        import { customFunction } from 'my-lib';
        customFunction();
      `;

      const identifier = findIdentifier(code, 'customFunction');
      expect(identifier).not.toBeNull();

      const result = identifierReferencesImport({
        identifier: identifier!,
        importSource: 'my-lib',
        importName: 'customFunction',
      });

      expect(result).toBe(true);
    });

    it('should work with custom libraries - CJS require', () => {
      const code = `
        const { customFunction } = require('my-lib');
        customFunction();
      `;

      const identifier = findIdentifier(code, 'customFunction');
      expect(identifier).not.toBeNull();

      const result = identifierReferencesImport({
        identifier: identifier!,
        importSource: 'my-lib',
        importName: 'customFunction',
      });

      expect(result).toBe(true);
    });

    it('should work with scoped packages', () => {
      const code = `
        import { helper } from '@my-org/my-package';
        helper();
      `;

      const identifier = findIdentifier(code, 'helper');
      expect(identifier).not.toBeNull();

      const result = identifierReferencesImport({
        identifier: identifier!,
        importSource: '@my-org/my-package',
        importName: 'helper',
      });

      expect(result).toBe(true);
    });
  });

  describe('getIdentifiers example', () => {
    it('should identify all components in the complete getIdentifiers example', () => {
      const code = `
        import React from 'react';
        import Link from 'next/link';
        import { Branch, Num, Var } from 'gt-react';

        export function getIdentifiers({ entities, onClick }) {
          const alpha = 'Alpha';
          const beta = 'Beta';
          const gamma = 'Gamma';
          const delta = 'Delta';

          const randomValue = Math.random();

          switch (entities.length) {
            case 0:
              return null;

            case 1:
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

            case 2:
              return (
                React.createElement(
                  React.Fragment,
                  null,
                  React.createElement(
                    Link,
                    null,
                    React.createElement(Branch, {
                      branch: beta != null,
                      true: React.createElement(Var, null, beta),
                      false: 'Unknown entity',
                    })
                  ),
                  'and ',
                  randomValue,
                  React.createElement(
                    Link,
                    null,
                    React.createElement(Branch, {
                      branch: gamma != null,
                      true: React.createElement(Var, null, gamma),
                      false: 'another one',
                    })
                  )
                )
              );

            default:
              return (
                React.createElement(
                  React.Fragment,
                  null,
                  React.createElement(
                    Link,
                    null,
                    React.createElement(Branch, {
                      branch: delta != null,
                      true: React.createElement(Var, null, delta),
                      false: 'Unknown entity',
                    })
                  ),
                  'and ',
                  React.createElement(Num, null, entities.length - 1),
                  ' others'
                )
              );
          }
        }
      `;

      // Test React default import
      const reactId = findIdentifier(code, 'React');
      expect(reactId).not.toBeNull();

      const reactResult = identifierReferencesImport({
        identifier: reactId!,
        importSource: 'react',
      });
      expect(reactResult).toBe(true);

      // Test React.createElement member expression
      const reactCreateElement = findMemberExpression(
        code,
        'React',
        'createElement'
      );
      expect(reactCreateElement).not.toBeNull();

      const createElementResult = memberExpressionReferencesImport({
        memberExpression: reactCreateElement!,
        propertyName: 'createElement',
        importSource: 'react',
      });
      expect(createElementResult).toBe(true);

      // Test React.Fragment member expression
      const reactFragment = findMemberExpression(code, 'React', 'Fragment');
      expect(reactFragment).not.toBeNull();

      const fragmentResult = memberExpressionReferencesImport({
        memberExpression: reactFragment!,
        propertyName: 'Fragment',
        importSource: 'react',
      });
      expect(fragmentResult).toBe(true);

      // Test Link component from next/link
      const linkId = findIdentifier(code, 'Link');
      expect(linkId).not.toBeNull();

      const linkResult = identifierReferencesImport({
        identifier: linkId!,
        importSource: 'next/link',
      });
      expect(linkResult).toBe(true);

      // Test Branch component from gt-react
      const branchId = findIdentifier(code, 'Branch');
      expect(branchId).not.toBeNull();

      const branchResult = identifierReferencesImport({
        identifier: branchId!,
        importSource: 'gt-react',
        importName: 'Branch',
      });
      expect(branchResult).toBe(true);

      // Test Var component from gt-react
      const varId = findIdentifier(code, 'Var');
      expect(varId).not.toBeNull();

      const varResult = identifierReferencesImport({
        identifier: varId!,
        importSource: 'gt-react',
        importName: 'Var',
      });
      expect(varResult).toBe(true);

      // Test Num component from gt-react
      const numId = findIdentifier(code, 'Num');
      expect(numId).not.toBeNull();

      const numResult = identifierReferencesImport({
        identifier: numId!,
        importSource: 'gt-react',
        importName: 'Num',
      });
      expect(numResult).toBe(true);
    });
  });

  describe('Member expression comprehensive testing', () => {
    describe('React member expressions', () => {
      it('should identify React.createElement with default import', () => {
        const code = `
          import React from 'react';
          React.createElement('div', { className: 'test' }, 'Hello');
        `;

        const memberExpr = findMemberExpression(code, 'React', 'createElement');
        expect(memberExpr).not.toBeNull();

        const result = memberExpressionReferencesImport({
          memberExpression: memberExpr!,
          propertyName: 'createElement',
          importSource: 'react',
        });

        expect(result).toBe(true);
      });

      it('should identify React.Fragment with namespace import', () => {
        const code = `
          import * as React from 'react';
          React.createElement(React.Fragment, null, 'Content');
        `;

        const fragmentExpr = findMemberExpression(code, 'React', 'Fragment');
        expect(fragmentExpr).not.toBeNull();

        const result = memberExpressionReferencesImport({
          memberExpression: fragmentExpr!,
          propertyName: 'Fragment',
          importSource: 'react',
        });

        expect(result).toBe(true);
      });

      it('should identify React.Component with default import', () => {
        const code = `
          import React from 'react';
          class MyComponent extends React.Component {}
        `;

        const componentExpr = findMemberExpression(code, 'React', 'Component');
        expect(componentExpr).not.toBeNull();

        const result = memberExpressionReferencesImport({
          memberExpression: componentExpr!,
          propertyName: 'Component',
          importSource: 'react',
        });

        expect(result).toBe(true);
      });

      it('should identify React.PureComponent', () => {
        const code = `
          import React from 'react';
          class MyComponent extends React.PureComponent {}
        `;

        const pureComponentExpr = findMemberExpression(
          code,
          'React',
          'PureComponent'
        );
        expect(pureComponentExpr).not.toBeNull();

        const result = memberExpressionReferencesImport({
          memberExpression: pureComponentExpr!,
          propertyName: 'PureComponent',
          importSource: 'react',
        });

        expect(result).toBe(true);
      });

      it('should identify React.memo', () => {
        const code = `
          import React from 'react';
          const MemoComponent = React.memo(() => <div>Hello</div>);
        `;

        const memoExpr = findMemberExpression(code, 'React', 'memo');
        expect(memoExpr).not.toBeNull();

        const result = memberExpressionReferencesImport({
          memberExpression: memoExpr!,
          propertyName: 'memo',
          importSource: 'react',
        });

        expect(result).toBe(true);
      });
    });

    describe('CommonJS member expressions', () => {
      it('should identify React.createElement from require', () => {
        const code = `
          const React = require('react');
          React.createElement('div', null, 'Hello');
        `;

        const memberExpr = findMemberExpression(code, 'React', 'createElement');
        expect(memberExpr).not.toBeNull();

        const result = memberExpressionReferencesImport({
          memberExpression: memberExpr!,
          propertyName: 'createElement',
          importSource: 'react',
        });

        expect(result).toBe(true);
      });

      it('should identify member expression from require with interop', () => {
        const code = `
          function interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
          const React = interopRequireDefault(require('react')).default;
          React.createElement('div', null, 'Hello');
        `;

        const memberExpr = findMemberExpression(code, 'React', 'createElement');
        expect(memberExpr).not.toBeNull();

        const result = memberExpressionReferencesImport({
          memberExpression: memberExpr!,
          propertyName: 'createElement',
          importSource: 'react',
        });

        expect(result).toBe(true);
      });
    });

    describe('Third-party library member expressions', () => {
      it('should identify lodash utility functions', () => {
        const code = `
          import _ from 'lodash';
          const result = _.map(array, fn);
        `;

        const memberExpr = findMemberExpression(code, '_', 'map');
        expect(memberExpr).not.toBeNull();

        const result = memberExpressionReferencesImport({
          memberExpression: memberExpr!,
          propertyName: 'map',
          importSource: 'lodash',
        });

        expect(result).toBe(true);
      });

      it('should identify moment.js functions', () => {
        const code = `
          import moment from 'moment';
          const now = moment.now();
        `;

        const memberExpr = findMemberExpression(code, 'moment', 'now');
        expect(memberExpr).not.toBeNull();

        const result = memberExpressionReferencesImport({
          memberExpression: memberExpr!,
          propertyName: 'now',
          importSource: 'moment',
        });

        expect(result).toBe(true);
      });

      it('should identify custom library member expressions', () => {
        const code = `
          import MyLib from 'my-custom-lib';
          MyLib.doSomething();
        `;

        const memberExpr = findMemberExpression(code, 'MyLib', 'doSomething');
        expect(memberExpr).not.toBeNull();

        const result = memberExpressionReferencesImport({
          memberExpression: memberExpr!,
          propertyName: 'doSomething',
          importSource: 'my-custom-lib',
        });

        expect(result).toBe(true);
      });
    });

    describe('GT React member expressions (if they exist)', () => {
      it('should handle GT React namespace imports', () => {
        const code = `
          import * as GT from 'gt-react';
          React.createElement(GT.Branch, { branch: true, true: 'Yes', false: 'No' });
        `;

        const memberExpr = findMemberExpression(code, 'GT', 'Branch');
        expect(memberExpr).not.toBeNull();

        const result = memberExpressionReferencesImport({
          memberExpression: memberExpr!,
          propertyName: 'Branch',
          importSource: 'gt-react',
        });

        expect(result).toBe(true);
      });
    });

    describe('Edge cases and negative tests', () => {
      it('should return false for non-matching property names', () => {
        const code = `
          import React from 'react';
          React.createElement('div', null, 'Hello');
        `;

        const memberExpr = findMemberExpression(code, 'React', 'createElement');
        expect(memberExpr).not.toBeNull();

        const result = memberExpressionReferencesImport({
          memberExpression: memberExpr!,
          propertyName: 'wrongProperty',
          importSource: 'react',
        });

        expect(result).toBe(false);
      });

      it('should return false for non-matching import sources', () => {
        const code = `
          import React from 'react';
          React.createElement('div', null, 'Hello');
        `;

        const memberExpr = findMemberExpression(code, 'React', 'createElement');
        expect(memberExpr).not.toBeNull();

        const result = memberExpressionReferencesImport({
          memberExpression: memberExpr!,
          propertyName: 'createElement',
          importSource: 'vue',
        });

        expect(result).toBe(false);
      });

      it('should return false for locally declared objects', () => {
        const code = `
          const React = { createElement: () => {} };
          React.createElement('div', null, 'Hello');
        `;

        const memberExpr = findMemberExpression(code, 'React', 'createElement');
        expect(memberExpr).not.toBeNull();

        const result = memberExpressionReferencesImport({
          memberExpression: memberExpr!,
          propertyName: 'createElement',
          importSource: 'react',
        });

        expect(result).toBe(false);
      });

      it('should return false when object has no binding', () => {
        const code = `
          NonExistentObject.someMethod();
        `;

        const memberExpr = findMemberExpression(
          code,
          'NonExistentObject',
          'someMethod'
        );
        expect(memberExpr).not.toBeNull();

        const result = memberExpressionReferencesImport({
          memberExpression: memberExpr!,
          propertyName: 'someMethod',
          importSource: 'some-lib',
        });

        expect(result).toBe(false);
      });
    });

    describe('Complex nested scenarios', () => {
      it('should identify member expressions in nested React.createElement calls', () => {
        const code = `
          import React from 'react';
          import { Branch, Var } from 'gt-react';
          
          React.createElement(
            React.Fragment,
            null,
            React.createElement(Branch, {
              branch: true,
              true: React.createElement(Var, null, 'value'),
              false: React.createElement(React.Fragment, null, 'fallback')
            })
          );
        `;

        // Test multiple React.createElement calls
        const createElementExpr = findMemberExpression(
          code,
          'React',
          'createElement'
        );
        expect(createElementExpr).not.toBeNull();

        const createElementResult = memberExpressionReferencesImport({
          memberExpression: createElementExpr!,
          propertyName: 'createElement',
          importSource: 'react',
        });

        // Test React.Fragment references
        const fragmentExpr = findMemberExpression(code, 'React', 'Fragment');
        expect(fragmentExpr).not.toBeNull();

        const fragmentResult = memberExpressionReferencesImport({
          memberExpression: fragmentExpr!,
          propertyName: 'Fragment',
          importSource: 'react',
        });

        expect(createElementResult).toBe(true);
        expect(fragmentResult).toBe(true);
      });

      it('should handle chained member expressions', () => {
        const code = `
          import utils from 'my-utils';
          const result = utils.string.capitalize('hello');
        `;

        // Only test the first level member expression (utils.string)
        const memberExpr = findMemberExpression(code, 'utils', 'string');
        expect(memberExpr).not.toBeNull();

        const result = memberExpressionReferencesImport({
          memberExpression: memberExpr!,
          propertyName: 'string',
          importSource: 'my-utils',
        });

        expect(result).toBe(true);
      });
    });

    describe('Mixed import types with member expressions', () => {
      it('should handle ESM and CJS imports in same file', () => {
        const code = `
          import React from 'react';
          const lodash = require('lodash');
          
          React.createElement('div', null, lodash.map([1, 2, 3], x => x * 2));
        `;

        const reactMember = findMemberExpression(
          code,
          'React',
          'createElement'
        );
        const lodashMember = findMemberExpression(code, 'lodash', 'map');

        expect(reactMember).not.toBeNull();
        expect(lodashMember).not.toBeNull();

        const reactResult = memberExpressionReferencesImport({
          memberExpression: reactMember!,
          propertyName: 'createElement',
          importSource: 'react',
        });

        const lodashResult = memberExpressionReferencesImport({
          memberExpression: lodashMember!,
          propertyName: 'map',
          importSource: 'lodash',
        });

        expect(reactResult).toBe(true);
        expect(lodashResult).toBe(true);
      });
    });
  });
});
