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
      ],
      invalid: [
        // TODO: Add invalid test cases when rule logic is implemented
      ],
    });
  });
});