import { RuleTester } from '@typescript-eslint/rule-tester';
import { describe } from 'vitest';
import { staticJsx } from '../index.js';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
});

/**
 * Tests for auto-import of Var when the static-jsx auto-fix wraps
 * dynamic content in <Var>. The fix must also add `Var` to the
 * existing GT import declaration so the fixed code actually compiles.
 *
 * NOTE: ruleTester.run() is called directly inside describe(), NOT
 * wrapped in it(). Wrapping in it() causes output assertions to be
 * silently swallowed by the test framework.
 */

describe('static-jsx auto-fix should add Var import', () => {
  ruleTester.run('auto-import Var from gt-react', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ name }) {
            return <T>{name}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-react';
          function Component({ name }) {
            return <T><Var>{name}</Var></T>;
          }
        `,
      },
    ],
  });

  ruleTester.run('auto-import Var from react-core', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from '@generaltranslation/react-core';
          function Component({ name }) {
            return <T>{name}</T>;
          }
        `,
        options: [{ libs: ['@generaltranslation/react-core'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from '@generaltranslation/react-core';
          function Component({ name }) {
            return <T><Var>{name}</Var></T>;
          }
        `,
      },
    ],
  });

  ruleTester.run('auto-import Var from gt-next', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-next';
          function Component() {
            return <T>{getLabel()}</T>;
          }
        `,
        options: [{ libs: ['gt-next'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-next';
          function Component() {
            return <T><Var>{getLabel()}</Var></T>;
          }
        `,
      },
    ],
  });

  ruleTester.run('auto-import Var alongside existing specifiers', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T, Num } from 'gt-react';
          function Component({ name }) {
            return <T>{name}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Num, Var } from 'gt-react';
          function Component({ name }) {
            return <T><Var>{name}</Var></T>;
          }
        `,
      },
    ],
  });
});

describe('static-jsx auto-fix should not duplicate existing Var import', () => {
  ruleTester.run('Var already imported', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T, Var } from 'gt-react';
          function Component({ name }) {
            return <T>{name}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-react';
          function Component({ name }) {
            return <T><Var>{name}</Var></T>;
          }
        `,
      },
    ],
  });
});

describe('static-jsx auto-fix should respect aliased Var import', () => {
  ruleTester.run('Var imported as alias', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T, Var as V } from 'gt-react';
          function Component({ name }) {
            return <T>{name}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var as V } from 'gt-react';
          function Component({ name }) {
            return <T><V>{name}</V></T>;
          }
        `,
      },
    ],
  });
});
