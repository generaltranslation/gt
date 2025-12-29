import { RuleTester } from '@typescript-eslint/rule-tester';
import { describe, it } from 'vitest';
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

describe('static-jsx rule', () => {
  it('should pass with static content in T component', () => {
    ruleTester.run('static-jsx', staticJsx, {
      valid: [
        {
          code: `
            import { T } from '@generaltranslation/react-core';
            function Component() {
              return <T>Hello world</T>;
            }
          `,
          options: [{ libs: ['@generaltranslation/react-core'] }],
        },
        {
          code: `
            import { T } from '@generaltranslation/react-core';
            function Component() {
              return <T>{"static string"}</T>;
            }
          `,
          options: [{ libs: ['@generaltranslation/react-core'] }],
        },
        {
          code: `
            import { T } from '@generaltranslation/react-core';
            function Component() {
              return <T>{123}</T>;
            }
          `,
          options: [{ libs: ['@generaltranslation/react-core'] }],
        },
        {
          code: `
            import { T } from '@generaltranslation/react-core';
            function Component() {
              return <T>{\`template literal\`}</T>;
            }
          `,
          options: [{ libs: ['@generaltranslation/react-core'] }],
        },
      ],
      invalid: [
        {
          code: `
            import { T } from '@generaltranslation/react-core';
            function Component({ name }) {
              return <T>{name}</T>;
            }
          `,
          options: [{ libs: ['@generaltranslation/react-core'] }],
          errors: [
            {
              messageId: 'dynamicContent',
            },
          ],
        },
        {
          code: `
            import { T } from '@generaltranslation/react-core';
            function Component() {
              const variable = "dynamic";
              return <T>{variable}</T>;
            }
          `,
          options: [{ libs: ['@generaltranslation/react-core'] }],
          errors: [
            {
              messageId: 'dynamicContent',
            },
          ],
        },
        {
          code: `
            import { T } from '@generaltranslation/react-core';
            function Component() {
              return <T>{someFunction()}</T>;
            }
          `,
          options: [{ libs: ['@generaltranslation/react-core'] }],
          errors: [
            {
              messageId: 'dynamicContent',
            },
          ],
        },
        {
          code: `
            import { T } from '@generaltranslation/react-core';
            function Component({ user }) {
              return <T>{\`Hello \${user.name}\`}</T>;
            }
          `,
          options: [{ libs: ['@generaltranslation/react-core'] }],
          errors: [
            {
              messageId: 'dynamicContent',
            },
          ],
        },
      ],
    });
  });

  it('should ignore non-T components', () => {
    ruleTester.run('static-jsx ignore non-T', staticJsx, {
      valid: [
        {
          code: `
            function Component({ name }) {
              return <div>{name}</div>;
            }
          `,
          options: [{ libs: ['@generaltranslation/react-core'] }],
        },
        {
          code: `
            import { OtherComponent } from 'some-library';
            function Component({ name }) {
              return <OtherComponent>{name}</OtherComponent>;
            }
          `,
          options: [{ libs: ['@generaltranslation/react-core'] }],
        },
      ],
      invalid: [],
    });
  });

  it('should work with different library imports', () => {
    ruleTester.run('static-jsx different libraries', staticJsx, {
      valid: [
        {
          code: `
            import { T } from 'gt-react';
            function Component() {
              return <T>Static content</T>;
            }
          `,
          options: [{ libs: ['gt-react'] }],
        },
      ],
      invalid: [
        {
          code: `
            import { T } from 'gt-react';
            function Component({ name }) {
              return <T>{name}</T>;
            }
          `,
          options: [{ libs: ['gt-react'] }],
          errors: [
            {
              messageId: 'dynamicContent',
            },
          ],
        },
      ],
    });
  });

  it('should handle nested T components', () => {
    ruleTester.run('static-jsx nested components', staticJsx, {
      valid: [
        {
          code: `
            import { T } from '@generaltranslation/react-core';
            function Component() {
              return (
                <div>
                  <T>Outer static</T>
                  <T>Inner static</T>
                </div>
              );
            }
          `,
          options: [{ libs: ['@generaltranslation/react-core'] }],
        },
      ],
      invalid: [
        {
          code: `
            import { T } from '@generaltranslation/react-core';
            function Component({ name }) {
              return (
                <div>
                  <T>Static content</T>
                  <T>{name}</T>
                </div>
              );
            }
          `,
          options: [{ libs: ['@generaltranslation/react-core'] }],
          errors: [
            {
              messageId: 'dynamicContent',
            },
          ],
        },
      ],
    });
  });
});
