import { RuleTester } from '@typescript-eslint/rule-tester';
import { unstableStaticBranch } from '../index.js';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

// Run at the top level: RuleTester registers its own tests, which vitest
// never runs when they are registered from inside another test.
ruleTester.run('unstable-static-branch', unstableStaticBranch, {
  valid: [
    // Static text and part`...`, inline or behind a const
    `import { t, plural, part, n } from 'gt-react/unstable';
    t\`\${plural({ count }, { '=0': 'None', one: \`One\`, other: part\`\${n} from \${{ name }}\` })}\`;`,
    `import { t, select, part } from '@generaltranslation/react-core/unstable';
    const admins = part\`admins of \${{ team }}\`;
    t\`\${select({ role }, { admin: admins, other: 'everyone' })}\`;`,
    // Aliased imports
    `import { t, selectordinal as ordinal, part as p, n } from 'gt-next/unstable';
    t\`\${ordinal({ place }, { one: p\`\${n}st\`, other: p\`\${n}th\` })}\`;`,
    // Legacy and non-GT plural, which take other branch shapes
    `import { plural } from 'some-lib';
    plural(count, { other: \`\${count} items\` });`,
    // Spread branches are left to the CLI
    `import { plural } from 'gt-react/unstable';
    plural({ count }, { ...branches, other: 'Many' });`,
  ],
  invalid: [
    {
      // A template with values: wrap it in part and import part
      code: `import { t, plural, n } from 'gt-react/unstable';
t\`\${plural({ count }, { one: 'One', other: \`\${count} items\` })}\`;`,
      output: `import { t, plural, n, part } from 'gt-react/unstable';
t\`\${plural({ count }, { one: 'One', other: part\`\${count} items\` })}\`;`,
      errors: [{ messageId: 'needsPart' }],
    },
    {
      // Constant values pass TypeScript, so only the rule sees them
      code: `import { t, select, part as p } from 'gt-i18n/unstable';
const fixed = 'Ada';
t\`\${select({ role }, { admin: \`for \${fixed}\`, other: 'everyone' })}\`;`,
      output: `import { t, select, part as p } from 'gt-i18n/unstable';
const fixed = 'Ada';
t\`\${select({ role }, { admin: p\`for \${fixed}\`, other: 'everyone' })}\`;`,
      errors: [{ messageId: 'needsPart' }],
    },
    {
      // Two branches: the second fix reuses the part the first one imports
      code: `import { plural } from 'gt-node/unstable';
plural({ n }, { one: \`\${a}\`, other: \`\${b}\` });`,
      output: [
        `import { plural, part } from 'gt-node/unstable';
plural({ n }, { one: part\`\${a}\`, other: \`\${b}\` });`,
        `import { plural, part } from 'gt-node/unstable';
plural({ n }, { one: part\`\${a}\`, other: part\`\${b}\` });`,
      ],
      errors: [{ messageId: 'needsPart' }, { messageId: 'needsPart' }],
    },
    {
      // `part` already means something else here, so there is no fix
      code: `import { plural } from 'gt-react/unstable';
const part = (s) => s;
plural({ n }, { other: \`\${n} items\` });`,
      output: null,
      errors: [{ messageId: 'needsPart' }],
    },
    {
      // A type-only part can't run as a tag, so there is no fix
      code: `import type { part } from 'gt-react/unstable';
import { plural } from 'gt-react/unstable';
type Part = typeof part;
plural({ n }, { other: \`\${n} items\` });`,
      output: null,
      errors: [{ messageId: 'needsPart' }],
    },
    {
      // An inline type-only alias is skipped; part is imported as a value
      code: `import { plural, type part as p } from 'gt-react/unstable';
plural({ n }, { other: \`\${n} items\` });`,
      output: `import { plural, type part as p, part } from 'gt-react/unstable';
plural({ n }, { other: part\`\${n} items\` });`,
      errors: [{ messageId: 'needsPart' }],
    },
    {
      // part`...` can't take `as const`, so there is no fix
      code: `import { plural } from 'gt-react/unstable';
plural({ n }, { other: \`\${n} items\` as const });`,
      output: null,
      errors: [{ messageId: 'needsPart' }],
    },
    {
      // Branches the CLI can't read statically
      code: `import { plural, part } from 'gt-react/unstable';
const label = 'Many';
const text = \`Many\`;
plural({ n }, { one: label, few: text, many: getLabel(), other: flag ? part\`a\` : part\`b\` });`,
      output: null,
      errors: [
        { messageId: 'notStatic' },
        { messageId: 'notStatic' },
        { messageId: 'notStatic' },
        { messageId: 'notStatic' },
      ],
    },
    {
      // The CLI only follows a const bound directly to part, not destructured
      code: `import { plural, part } from 'gt-react/unstable';
const { strings: [branch] } = part\`Hi\`;
plural({ n }, { other: branch });`,
      output: null,
      errors: [{ messageId: 'notStatic' }],
    },
  ],
});
