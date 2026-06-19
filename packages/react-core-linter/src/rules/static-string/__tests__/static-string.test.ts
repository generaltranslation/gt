import { RuleTester } from '@typescript-eslint/rule-tester';
import { describe, it } from 'vitest';
import { staticString } from '../index.js';

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

describe('static-string rule', () => {
  it('should have basic functionality', () => {
    ruleTester.run('static-string', staticString, {
      valid: [
        {
          code: `
            function Component() {
              return <div>Hello world</div>;
            }
          `,
          options: [{ libs: ['@generaltranslation/react-core/hooks'] }],
        },
        {
          code: `
            import { useGT } from '@generaltranslation/react-core/hooks';
            function Component() {
              const gt = useGT();
              return gt("Hello world");
            }
          `,
          options: [{ libs: ['@generaltranslation/react-core/hooks'] }],
        },
        {
          code: `
            import { useGT } from '@generaltranslation/react-core/hooks';
            import { derive } from '@generaltranslation/react-core/pure';
            function Component() {
              const gt = useGT();
              return gt("Hello " + derive("world"));
            }
          `,
          options: [
            {
              libs: [
                '@generaltranslation/react-core/hooks',
                '@generaltranslation/react-core/pure',
              ],
            },
          ],
        },
      ],
      invalid: [
        {
          code: `
            import { useGT } from '@generaltranslation/react-core/hooks';
            function Component() {
              const gt = useGT();
              const name = "World";
              return gt("Hello " + name);
            }
          `,
          options: [{ libs: ['@generaltranslation/react-core/hooks'] }],
          errors: [
            {
              messageId: 'variableInterpolationRequired',
            },
          ],
        },
        {
          code: `
            import { useGT } from '@generaltranslation/react-core/hooks';
            function Component() {
              const gt = useGT();
              const name = "World";
              return gt(\`Hello \${name}!\`);
            }
          `,
          options: [{ libs: ['@generaltranslation/react-core/hooks'] }],
          errors: [
            {
              messageId: 'variableInterpolationRequired',
            },
          ],
        },
      ],
    });
  });

  it('should allow msg() with static string arrays', () => {
    ruleTester.run('static-string', staticString, {
      valid: [
        {
          code: `
            import { msg } from 'gt-i18n';
            const items = msg(["Hello", "World"]);
          `,
          options: [{ libs: ['gt-i18n'] }],
        },
        {
          code: `
            import { msg } from 'gt-i18n';
            const items = msg(["Hello", \`World\`]);
          `,
          options: [{ libs: ['gt-i18n'] }],
        },
      ],
      invalid: [
        {
          code: `
            import { msg } from 'gt-i18n';
            const name = "World";
            const items = msg(["Hello", name]);
          `,
          options: [{ libs: ['gt-i18n'] }],
          errors: [
            {
              messageId: 'staticStringRequired',
            },
          ],
        },
        {
          code: `
            import { msg } from 'gt-i18n';
            const arr = ["Hello"];
            const items = msg(["Hello", ...arr]);
          `,
          options: [{ libs: ['gt-i18n'] }],
          errors: [
            {
              messageId: 'staticStringRequired',
            },
          ],
        },
      ],
    });
  });

  it('should allow derive()', () => {
    ruleTester.run('static-string', staticString, {
      valid: [
        {
          code: `
            import { useGT } from '@generaltranslation/react-core/hooks';
            import { derive } from '@generaltranslation/react-core/pure';
            function Component() {
              const gt = useGT();
              return gt("Hello " + derive("world"));
            }
          `,
          options: [
            {
              libs: [
                '@generaltranslation/react-core/hooks',
                '@generaltranslation/react-core/pure',
              ],
            },
          ],
        },
      ],
      invalid: [],
    });
  });

  it('should NOT allow gt() with arrays', () => {
    ruleTester.run('static-string', staticString, {
      valid: [],
      invalid: [
        {
          code: `
            import { useGT } from '@generaltranslation/react-core/hooks';
            function Component() {
              const gt = useGT();
              return gt(["Hello", "World"]);
            }
          `,
          options: [{ libs: ['@generaltranslation/react-core/hooks'] }],
          errors: [
            {
              messageId: 'staticStringRequired',
            },
          ],
        },
      ],
    });
  });
});
