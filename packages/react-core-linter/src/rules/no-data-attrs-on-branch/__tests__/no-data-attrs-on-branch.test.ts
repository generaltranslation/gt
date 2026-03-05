import { RuleTester } from '@typescript-eslint/rule-tester';
import { describe, it } from 'vitest';
import { noDataAttrsOnBranch } from '../index.js';

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

describe('no-data-attrs-on-branch rule', () => {
  it('should allow Branch with normal props and no data-* attributes', () => {
    ruleTester.run('no-data-attrs-on-branch', noDataAttrsOnBranch, {
      valid: [
        {
          code: `
            import { Branch } from 'gt-react';
            function Component() {
              const val = 'morning';
              return <Branch branch={val} morning={<p>morning</p>}>default</Branch>;
            }
          `,
          options: [{ libs: ['gt-react'] }],
        },
      ],
      invalid: [],
    });
  });

  it('should allow data-* attributes on non-Branch components', () => {
    ruleTester.run('no-data-attrs-on-branch', noDataAttrsOnBranch, {
      valid: [
        {
          code: `
            function Component() {
              return <div data-testid="x">hello</div>;
            }
          `,
          options: [{ libs: ['gt-react'] }],
        },
      ],
      invalid: [],
    });
  });

  it('should allow data-* attributes on Plural component', () => {
    ruleTester.run('no-data-attrs-on-branch', noDataAttrsOnBranch, {
      valid: [
        {
          code: `
            import { Plural } from 'gt-react';
            function Component() {
              return <Plural data-testid="x" n={1} singular={<p>one</p>}>default</Plural>;
            }
          `,
          options: [{ libs: ['gt-react'] }],
        },
      ],
      invalid: [],
    });
  });

  it('should report error for data-* attributes on Branch', () => {
    ruleTester.run('no-data-attrs-on-branch', noDataAttrsOnBranch, {
      valid: [],
      invalid: [
        {
          code: `
            import { Branch } from 'gt-react';
            function Component() {
              const val = 'morning';
              return <Branch data-testid="x" branch={val} morning={<p>morning</p>}>default</Branch>;
            }
          `,
          options: [{ libs: ['gt-react'] }],
          errors: [
            {
              messageId: 'noDataAttrsOnBranch',
            },
          ],
        },
      ],
    });
  });

  it('should report error for data-* attributes on aliased Branch', () => {
    ruleTester.run('no-data-attrs-on-branch', noDataAttrsOnBranch, {
      valid: [],
      invalid: [
        {
          code: `
            import { Branch as B } from 'gt-next';
            function Component() {
              const val = 'morning';
              return <B data-track="y" branch={val} morning={<p>morning</p>}>default</B>;
            }
          `,
          options: [{ libs: ['gt-next'] }],
          errors: [
            {
              messageId: 'noDataAttrsOnBranch',
            },
          ],
        },
      ],
    });
  });
});
