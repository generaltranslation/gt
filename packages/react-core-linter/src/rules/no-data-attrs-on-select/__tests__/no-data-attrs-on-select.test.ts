import { RuleTester } from '@typescript-eslint/rule-tester';
import { noDataAttrsOnSelect } from '../index.js';

// RuleTester.run() registers its own describe/it blocks (vitest globals), so
// it must be called at the top level. Inside it() the cases never execute.
const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

const errors = [{ messageId: 'noDataAttrsOnSelect' as const }];

ruleTester.run('no-data-attrs-on-select', noDataAttrsOnSelect, {
  valid: [
    {
      name: 'Select without data-* attributes',
      code: `
        import { Select } from 'gt-react';
        const el = <Select value={val} morning={<p>morning</p>}>default</Select>;
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
        const el = <Plural data-testid="x" n={1} one={<p>one</p>}>default</Plural>;
      `,
    },
    {
      name: 'Select from a library outside libs',
      code: `
        import { Select } from 'gt-react';
        const el = <Select data-testid="x" value={val}>default</Select>;
      `,
      options: [{ libs: ['gt-next'] }],
    },
  ],
  invalid: [
    {
      name: 'data-* attribute on Select',
      code: `
        import { Select } from 'gt-react';
        const el = <Select data-testid="x" value={val} morning={<p>morning</p>}>default</Select>;
      `,
      errors,
    },
    {
      name: 'data-* attribute on aliased Select with explicit libs',
      code: `
        import { Select as B } from 'gt-next';
        const el = <B data-track="y" value={val} morning={<p>morning</p>}>default</B>;
      `,
      options: [{ libs: ['gt-next'] }],
      errors,
    },
  ],
});
