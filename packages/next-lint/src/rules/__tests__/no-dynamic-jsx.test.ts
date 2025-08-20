/**
 * Tests for no-dynamic-jsx rule
 */

import { RuleTester } from 'eslint';
import { noDynamicJsx } from '../no-dynamic-jsx';

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

ruleTester.run('no-dynamic-jsx', noDynamicJsx, {
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

    // JSX attributes with expressions should be ignored
    {
      code: `
        import { T } from 'gt-next';
        function Component() {
          const width = 16;
          const height = 20;
          return (
            <T>
              <Image width={width} height={height} src="/logo.png" />
              Static text content
            </T>
          );
        }
      `,
    },

    // Complex JSX with attributes and static content
    {
      code: `
        import { T } from 'gt-next';
        function Component() {
          const size = 24;
          const name = 'logo';
          return (
            <T>
              <div className="container">
                <Image 
                  width={size} 
                  height={size * 2}
                  alt={name + '.png'}
                  data-testid={\`image-\${name}\`}
                />
                Welcome to our site
              </div>
            </T>
          );
        }
      `,
    },

    // Nested JSX with attributes
    {
      code: `
        import { T } from 'gt-next';
        function Component() {
          return (
            <T>
              <div className={dynamicClass}>
                <span style={{ color: dynamicColor }}>
                  <Icon size={iconSize} />
                  Static content
                </span>
              </div>
            </T>
          );
        }
      `,
    },

    // Template literal without interpolation (allowed)
    {
      code: `
        import { T } from 'gt-next';
        <T>{\`Hello World!\`}</T>
      `,
    },

    // Template literal without interpolation with static text
    {
      code: `
        import { T } from 'gt-next';
        <T>Welcome {\`to our site\`}!</T>
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
          messageId: 'dynamicJsx',
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
          messageId: 'dynamicJsx',
          type: 'JSXExpressionContainer',
        },
        {
          messageId: 'dynamicJsx',
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
          messageId: 'dynamicJsx',
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
          messageId: 'dynamicJsx',
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
          messageId: 'dynamicJsx',
          type: 'JSXExpressionContainer',
        },
      ],
    },

    // JSX with attributes (ignored) but also direct content expressions (flagged)
    {
      code: `
        import { T } from 'gt-next';
        function Component() {
          return (
            <T>
              <Image width={16} height={20} />
              Hello {userName}!
            </T>
          );
        }
      `,
      errors: [
        {
          messageId: 'dynamicJsx',
          type: 'JSXExpressionContainer',
        },
      ],
    },

    // Complex case: attributes ignored, but direct expressions flagged
    {
      code: `
        import { T } from 'gt-next';
        function Component() {
          return (
            <T>
              <div className={dynamicClass} style={{ color: 'red' }}>
                You have {count} items
                <Icon size={iconSize} />
                Welcome {userName}
              </div>
            </T>
          );
        }
      `,
      errors: [
        {
          messageId: 'dynamicJsx',
          type: 'JSXExpressionContainer',
        },
        {
          messageId: 'dynamicJsx',
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
          messageId: 'dynamicJsx',
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
          messageId: 'dynamicJsx',
          type: 'JSXExpressionContainer',
        },
      ],
    },
  ],
});
