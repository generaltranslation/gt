/**
 * Tests for no-dynamic-string rule
 */

import { RuleTester } from 'eslint';
import { noDynamicString } from '../no-dynamic-string';

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
} as any);

ruleTester.run('no-dynamic-string', noDynamicString, {
  valid: [
    // No GT imports - should not trigger
    {
      code: `
        const message = \`Hello \${name}\`;
        t(message);
      `,
    },

    // String literals are allowed
    {
      code: `
        import { useGT } from 'gt-next';
        const t = useGT();
        t('Hello, world!');
      `,
    },

    // String literals with variables in second parameter
    {
      code: `
        import { useGT } from 'gt-next';
        const t = useGT();
        t('Hello, {name}!', { name: 'Alice' });
      `,
    },

    // ICU format strings
    {
      code: `
        import { getGT } from 'gt-next/server';
        async function test() {
          const t = await getGT();
          t('There are {count, plural, =0 {no items} =1 {one item} other {{count} items}}', { count: 5 });
        }
      `,
    },

    // Aliased imports
    {
      code: `
        import { useGT as myUseGT } from 'gt-next';
        async function test() {
          const t = myUseGT();
          t('Hello, world!');
        }
      `,
    },

    // Namespace imports with string literals
    {
      code: `
        import * as GT from 'gt-next';
        const t = GT.useGT();
        t('Hello, world!');
      `,
    },

    // Multiple assignment levels with string literal
    {
      code: `
        import { useGT } from 'gt-next';
        const getTranslation = useGT();
        const t = getTranslation;
        t('Hello, world!');
      `,
    },

    // Mixed imports from different modules
    {
      code: `
        import { useGT } from 'gt-next/client';
        import { getGT } from 'gt-next/server';
        async function test() {
          const t1 = useGT();
          const t2 = await getGT();
          t1('Client message');
          t2('Server message');
        }
      `,
    },
  ],

  invalid: [
    // Template literals
    {
      code: `
        import { useGT } from 'gt-next';
        const t = useGT();
        const name = 'Alice';
        t(\`Hello, \${name}!\`);
      `,
      errors: [
        {
          messageId: 'dynamicString',
          type: 'TemplateLiteral',
        },
      ],
    },

    // String concatenation
    {
      code: `
        import { useGT } from 'gt-next';
        const t = useGT();
        const name = 'Alice';
        t('Hello, ' + name + '!');
      `,
      errors: [
        {
          messageId: 'dynamicString',
          type: 'BinaryExpression',
        },
      ],
    },

    // Function calls as arguments
    {
      code: `
        import { useGT } from 'gt-next';
        function getMessage() { return 'Hello'; }
        function test() {
          const t = useGT();
          t(getMessage());
        }
      `,
      errors: [
        {
          messageId: 'dynamicString',
          type: 'CallExpression',
        },
      ],
    },

    // Conditional expressions
    {
      code: `
        import { useGT } from 'gt-next';
        const t = useGT();
        const name = 'Alice';
        t(name ? \`Hello, \${name}\` : 'Hello');
      `,
      errors: [
        {
          messageId: 'dynamicString',
          type: 'ConditionalExpression',
        },
      ],
    },

    // Variable references
    {
      code: `
        import { useGT } from 'gt-next';
        const t = useGT();
        const message = 'Hello, world!';
        t(message);
      `,
      errors: [
        {
          messageId: 'dynamicString',
          type: 'Identifier',
        },
      ],
    },

    // Aliased function with dynamic content
    {
      code: `
        import { useGT as myUseGT } from 'gt-next';
        const name = 'Alice';
        function test() {
          const t = myUseGT();
          t(\`Hello, \${name}!\`);
        }
      `,
      errors: [
        {
          messageId: 'dynamicString',
          type: 'TemplateLiteral',
        },
      ],
    },

    // Namespace import with dynamic content
    {
      code: `
        import * as GT from 'gt-next';
        const name = 'Alice';
        function test() {
          const t = GT.useGT();
          t('Hello, ' + name);
        }
      `,
      errors: [
        {
          messageId: 'dynamicString',
          type: 'BinaryExpression',
        },
      ],
    },

    // Assignment chain with dynamic content
    {
      code: `
        import { useGT } from 'gt-next';
        const getTranslation = useGT();
        const t = getTranslation;
        const name = 'Alice';
        t(\`Hello, \${name}!\`);
      `,
      errors: [
        {
          messageId: 'dynamicString',
          type: 'TemplateLiteral',
        },
      ],
    },

    // Multiple violations
    {
      code: `
        import { useGT, getGT } from 'gt-next';
        async function test() {
          const t1 = useGT();
          const t2 = await getGT();
          const name = 'Alice';
          t1(\`Hello, \${name}!\`);
          t2('Hello, ' + name);
        }
      `,
      errors: [
        {
          messageId: 'dynamicString',
          type: 'TemplateLiteral',
        },
        {
          messageId: 'dynamicString',
          type: 'BinaryExpression',
        },
      ],
    },

    // Different GT modules
    {
      code: `
        import { getGT } from 'gt-next/server';
        async function test() {
          const t = await getGT();
          const message = 'Dynamic message';
          t(message);
        }
      `,
      errors: [
        {
          messageId: 'dynamicString',
          type: 'Identifier',
        },
      ],
    },

    // Client module with template literal
    {
      code: `
        import { useGT } from 'gt-next/client';
        const t = useGT();
        const greeting = 'Hello';
        t(\`\${greeting}, world!\`);
      `,
      errors: [
        {
          messageId: 'dynamicString',
          type: 'TemplateLiteral',
        },
      ],
    },
    // Inside Jsx
    {
      code: `
        import { useGT } from 'gt-next/client';
        const t = useGT();
        const greeting = 'Hello';
        <div>{ t(\`\${greeting}, world!\`) }</div>
      `,
      errors: [
        {
          messageId: 'dynamicString',
          type: 'TemplateLiteral',
        },
      ],
    },
  ],
});
