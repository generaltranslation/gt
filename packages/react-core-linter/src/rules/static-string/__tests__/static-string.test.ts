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
          options: [{ libs: ['@generaltranslation/react-core'] }],
        },
        {
          code: `
            import { useGT } from '@generaltranslation/react-core';
            function Component() {
              const gt = useGT();
              return gt("Hello world");
            }
          `,
          options: [{ libs: ['@generaltranslation/react-core'] }],
        },
        {
          code: `
            import { useGT, declareStatic } from '@generaltranslation/react-core';
            function Component() {
              const gt = useGT();
              return gt("Hello " + declareStatic("world"));
            }
          `,
          options: [{ libs: ['@generaltranslation/react-core'] }],
        },
      ],
      invalid: [
        {
          code: `
            import { useGT } from '@generaltranslation/react-core';
            function Component() {
              const gt = useGT();
              const name = "World";
              return gt("Hello " + name);
            }
          `,
          options: [{ libs: ['@generaltranslation/react-core'] }],
          errors: [
            {
              messageId: 'variableInterpolationRequired',
            },
          ],
        },
        {
          code: `
            import { useGT } from '@generaltranslation/react-core';
            function Component() {
              const gt = useGT();
              const name = "World";
              return gt(\`Hello \${name}!\`);
            }
          `,
          options: [{ libs: ['@generaltranslation/react-core'] }],
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

  it('should NOT allow gt() with arrays', () => {
    ruleTester.run('static-string', staticString, {
      valid: [],
      invalid: [
        {
          code: `
            import { useGT } from '@generaltranslation/react-core';
            function Component() {
              const gt = useGT();
              return gt(["Hello", "World"]);
            }
          `,
          options: [{ libs: ['@generaltranslation/react-core'] }],
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
