/**
 * Tests for no-unwrapped-dynamic-content rule
 */

import { RuleTester } from 'eslint';
import { noUnwrappedDynamicContent } from '../rules/no-unwrapped-dynamic-content';

// Configure RuleTester with JSX support
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
} as any); // Type assertion to work around ESLint type issues

ruleTester.run('no-unwrapped-dynamic-content', noUnwrappedDynamicContent, {
  valid: [
    // No GT-Next imports
    {
      code: `<div>{someVariable}</div>`,
    },

    // Properly wrapped dynamic content
    {
      code: `
        import { T, Var } from 'gt-next';
        <T>Hello <Var>{userName}</Var>!</T>
      `,
    },

    // Using different variable components
    {
      code: `
        import { T, DateTime, Num, Currency } from 'gt-next';
        function Component() {
          return (
            <T>
              Today is <DateTime>{date}</DateTime> and the price is <Currency>{price}</Currency>
              with <Num>{count}</Num> items.
            </T>
          );
        }
      `,
    },

    // Namespace imports with proper wrapping
    {
      code: `
        import * as GT from 'gt-next';
        <GT.T>Hello <GT.Var>{userName}</GT.Var>!</GT.T>
      `,
    },

    // Variable assignments with proper wrapping
    {
      code: `
        import { T, Var } from 'gt-next';
        const MyT = T;
        const MyVar = Var;
        <MyT>Hello <MyVar>{userName}</MyVar>!</MyT>
      `,
    },

    // Static content in T component (no dynamic content)
    {
      code: `
        import { T } from 'gt-next';
        <T>Hello World!</T>
      `,
    },

    // Dynamic content outside T component
    {
      code: `
        import { T } from 'gt-next';
        function Component() {
          return (
            <div>
              <T>Hello World!</T>
              <p>{someVariable}</p>
            </div>
          );
        }
      `,
    },
  ],

  invalid: [
    // Unwrapped dynamic content in T component
    {
      code: `
        import { T } from 'gt-next';
        <T>Hello {userName}!</T>
      `,
      errors: [
        {
          messageId: 'unwrappedDynamicContent',
          type: 'JSXExpressionContainer',
        },
      ],
    },

    // Multiple unwrapped dynamic content
    {
      code: `
        import { T } from 'gt-next';
        <T>Hello {userName}, you have {count} messages!</T>
      `,
      errors: [
        {
          messageId: 'unwrappedDynamicContent',
          type: 'JSXExpressionContainer',
        },
        {
          messageId: 'unwrappedDynamicContent',
          type: 'JSXExpressionContainer',
        },
      ],
    },

    // Namespace import with unwrapped content
    {
      code: `
        import * as GT from 'gt-next';
        <GT.T>Hello {userName}!</GT.T>
      `,
      errors: [
        {
          messageId: 'unwrappedDynamicContent',
          type: 'JSXExpressionContainer',
        },
      ],
    },

    // Variable assignment with unwrapped content
    {
      code: `
        import { T } from 'gt-next';
        const MyT = T;
        <MyT>Hello {userName}!</MyT>
      `,
      errors: [
        {
          messageId: 'unwrappedDynamicContent',
          type: 'JSXExpressionContainer',
        },
      ],
    },

    // Mixed wrapped and unwrapped content
    {
      code: `
        import { T, Var } from 'gt-next';
        <T>Hello <Var>{userName}</Var>, you have {count} messages!</T>
      `,
      errors: [
        {
          messageId: 'unwrappedDynamicContent',
          type: 'JSXExpressionContainer',
        },
      ],
    },

    // Imports from different GT modules
    {
      code: `
        import { T } from 'gt-next/client';
        <T>Hello {userName}!</T>
      `,
      errors: [
        {
          messageId: 'unwrappedDynamicContent',
          type: 'JSXExpressionContainer',
        },
      ],
    },

    {
      code: `
        import { T } from 'gt-next/server';
        <T>Hello {userName}!</T>
      `,
      errors: [
        {
          messageId: 'unwrappedDynamicContent',
          type: 'JSXExpressionContainer',
        },
      ],
    },
  ],
});