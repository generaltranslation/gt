import { RuleTester } from '@typescript-eslint/rule-tester';
import { noDataAttrsOnBranch } from '../index.js';

// RuleTester.run() registers its own describe/it blocks (vitest globals), so
// it must be called at the top level. Inside it() the cases never execute.
const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

const errors = [{ messageId: 'noDataAttrsOnBranch' as const }];

ruleTester.run('no-data-attrs-on-branch', noDataAttrsOnBranch, {
  valid: [
    {
      name: 'Branch without data-* attributes',
      code: `
        import { Branch } from 'gt-react';
        const el = <Branch branch={val} morning={<p>morning</p>}>default</Branch>;
      `,
    },
    {
      name: 'data-* attribute on a plain element',
      code: 'const el = <div data-testid="x">hello</div>;',
    },
    {
      name: 'data-* attribute on Plural',
      code: `
        import { Plural } from 'gt-react';
        const el = <Plural data-testid="x" n={1} singular={<p>one</p>}>default</Plural>;
      `,
    },
    {
      name: 'Branch from a library outside libs',
      code: `
        import { Branch } from 'gt-react';
        const el = <Branch data-testid="x" branch={val}>default</Branch>;
      `,
      options: [{ libs: ['gt-next'] }],
    },
  ],
  invalid: [
    {
      name: 'data-* attribute on Branch',
      code: `
        import { Branch } from 'gt-react';
        const el = <Branch data-testid="x" branch={val} morning={<p>morning</p>}>default</Branch>;
      `,
      errors,
    },
    {
      name: 'data-* attribute on aliased Branch with explicit libs',
      code: `
        import { Branch as B } from 'gt-next';
        const el = <B data-track="y" branch={val} morning={<p>morning</p>}>default</B>;
      `,
      options: [{ libs: ['gt-next'] }],
      errors,
    },
  ],
});
