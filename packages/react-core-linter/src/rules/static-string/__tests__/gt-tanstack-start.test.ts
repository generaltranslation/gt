import { RuleTester } from '@typescript-eslint/rule-tester';
import { staticString } from '../index.js';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

// Run at the top level: RuleTester registers its own tests, which vitest
// never runs when they are registered from inside another test.
ruleTester.run('static-string', staticString, {
  valid: [],
  invalid: [
    {
      code: `
        import { useGT } from 'gt-tanstack-start';
        function Component() {
          const gt = useGT();
          const name = 'World';
          return gt('Hello ' + name);
        }
      `,
      output: `
        import { useGT } from 'gt-tanstack-start';
        function Component() {
          const gt = useGT();
          const name = 'World';
          return gt("Hello {var0}", { var0: name });
        }
      `,
      errors: [{ messageId: 'variableInterpolationRequired' }],
    },
  ],
});
