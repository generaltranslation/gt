import { RuleTester } from '@typescript-eslint/rule-tester';
import { staticBranch } from '../index.js';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

// Run at the top level: RuleTester registers its own tests, which vitest
// never runs when they are registered from inside another test.
ruleTester.run('static-branch', staticBranch, {
  valid: [
    // Static text and part`...`, inline or behind a const
    `import { t, plural, part, n } from 'gt-react';
    t\`\${plural({ count }, { '=0': 'None', one: \`One\`, other: part\`\${n} from \${{ name }}\` })}\`;`,
    `import { t, select, part } from '@generaltranslation/react-core/pure';
    const admins = part\`admins of \${{ team }}\`;
    t\`\${select({ role }, { admin: admins, other: 'everyone' })}\`;`,
    // Aliased imports
    `import { t, selectordinal as ordinal, part as p, n } from 'gt-next';
    t\`\${ordinal({ place }, { one: p\`\${n}st\`, other: p\`\${n}th\` })}\`;`,
    // A non-GT plural, which takes other branch shapes
    `import { plural } from 'some-lib';
    plural(count, { other: \`\${count} items\` });`,
    // `__proto__:` sets the prototype and adds no branch
    `import { plural } from 'gt-react';
    plural({ n }, { __proto__: null, other: 'Many' });`,
    // Spread branches are left to the CLI
    `import { plural } from 'gt-react';
    plural({ count }, { ...branches, other: 'Many' });`,
  ],
  invalid: [
    {
      // Branches inside a deferred msg template are checked too
      code: `import { msg, plural, select } from 'gt-react';
msg\`\${plural({ count }, { other: \`\${count} items\` })}\`;
msg({ context: 'role' })\`\${select({ role }, { admin: label, other: 'everyone' })}\`;`,
      errors: [
        {
          messageId: 'needsPart',
          suggestions: [
            {
              messageId: 'wrapInPart',
              output: `import { msg, plural, select, part } from 'gt-react';
msg\`\${plural({ count }, { other: part\`\${count} items\` })}\`;
msg({ context: 'role' })\`\${select({ role }, { admin: label, other: 'everyone' })}\`;`,
            },
          ],
        },
        { messageId: 'notStatic' },
      ],
    },
    {
      // A template with values: wrap it in part and import part
      code: `import { t, plural, n } from 'gt-react';
t\`\${plural({ count }, { one: 'One', other: \`\${count} items\` })}\`;`,
      errors: [
        {
          messageId: 'needsPart',
          suggestions: [
            {
              messageId: 'wrapInPart',
              output: `import { t, plural, n, part } from 'gt-react';
t\`\${plural({ count }, { one: 'One', other: part\`\${count} items\` })}\`;`,
            },
          ],
        },
      ],
    },
    {
      // Constant values pass TypeScript, so only the rule sees them
      code: `import { t, select, part as p } from 'gt-i18n';
const fixed = 'Ada';
t\`\${select({ role }, { admin: \`for \${fixed}\`, other: 'everyone' })}\`;`,
      errors: [
        {
          messageId: 'needsPart',
          suggestions: [
            {
              messageId: 'wrapInPart',
              output: `import { t, select, part as p } from 'gt-i18n';
const fixed = 'Ada';
t\`\${select({ role }, { admin: p\`for \${fixed}\`, other: 'everyone' })}\`;`,
            },
          ],
        },
      ],
    },
    {
      // Two branches: each suggestion wraps its own branch. An array value
      // renders as text but makes part`...` throw, so this is not an autofix.
      code: `import { plural } from 'gt-node';
plural({ n }, { one: \`\${a}\`, other: \`\${[1, 2]}\` });`,
      errors: [
        {
          messageId: 'needsPart',
          suggestions: [
            {
              messageId: 'wrapInPart',
              output: `import { plural, part } from 'gt-node';
plural({ n }, { one: part\`\${a}\`, other: \`\${[1, 2]}\` });`,
            },
          ],
        },
        {
          messageId: 'needsPart',
          suggestions: [
            {
              messageId: 'wrapInPart',
              output: `import { plural, part } from 'gt-node';
plural({ n }, { one: \`\${a}\`, other: part\`\${[1, 2]}\` });`,
            },
          ],
        },
      ],
    },
    {
      // `part` already means something else here, so there is no fix
      code: `import { plural } from 'gt-react';
const part = (s) => s;
plural({ n }, { other: \`\${n} items\` });`,
      errors: [{ messageId: 'needsPart', suggestions: [] }],
    },
    {
      // A type-only part can't run as a tag, so there is no fix
      code: `import type { part } from 'gt-react';
import { plural } from 'gt-react';
type Part = typeof part;
plural({ n }, { other: \`\${n} items\` });`,
      errors: [{ messageId: 'needsPart', suggestions: [] }],
    },
    {
      // An inline type-only alias is skipped; part is imported as a value
      code: `import { plural, type part as p } from 'gt-react';
plural({ n }, { other: \`\${n} items\` });`,
      errors: [
        {
          messageId: 'needsPart',
          suggestions: [
            {
              messageId: 'wrapInPart',
              output: `import { plural, type part as p, part } from 'gt-react';
plural({ n }, { other: part\`\${n} items\` });`,
            },
          ],
        },
      ],
    },
    {
      // part`...` can't take `as const`, so there is no fix
      code: `import { plural } from 'gt-react';
plural({ n }, { other: \`\${n} items\` as const });`,
      errors: [{ messageId: 'needsPart', suggestions: [] }],
    },
    {
      // Branches the CLI can't read statically
      code: `import { plural, part } from 'gt-react';
const label = 'Many';
const text = \`Many\`;
plural({ n }, { one: label, few: text, many: getLabel(), other: flag ? part\`a\` : part\`b\` });`,
      errors: [
        { messageId: 'notStatic' },
        { messageId: 'notStatic' },
        { messageId: 'notStatic' },
        { messageId: 'notStatic' },
      ],
    },
    {
      // A getter or method named __proto__ adds an own property, not a prototype
      code: `import { select } from 'gt-react';
select({ role }, { get __proto__() { return 'Many'; }, __proto__() {}, other: 'Other' });`,
      errors: [{ messageId: 'notStatic' }, { messageId: 'notStatic' }],
    },
    {
      // The CLI only follows a const bound to part itself, not a wrapped one
      code: `import { plural, part } from 'gt-react';
const branch = part\`Many\` satisfies unknown;
plural({ n }, { other: branch });`,
      errors: [{ messageId: 'notStatic' }],
    },
    {
      // The CLI only follows a const bound directly to part, not destructured
      code: `import { plural, part } from 'gt-react';
const { strings: [branch] } = part\`Hi\`;
plural({ n }, { other: branch });`,
      errors: [{ messageId: 'notStatic' }],
    },
  ],
});
