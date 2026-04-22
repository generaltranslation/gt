import { RuleTester } from '@typescript-eslint/rule-tester';
import { describe } from 'vitest';
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

// ===================================================================
// 1. Valid ICU strings — no errors
// ===================================================================

describe('icu-validation: valid ICU strings pass', () => {
  ruleTester.run('valid-icu', staticString, {
    valid: [
      // Simple string, no ICU syntax
      {
        code: `
          import { useGT } from 'gt-react';
          function C() { const gt = useGT(); return gt("Hello world"); }
        `,
        options: [{ libs: ['gt-react'] }],
      },
      // ICU variable placeholder
      {
        code: `
          import { useGT } from 'gt-react';
          function C() { const gt = useGT(); return gt("Hello {name}!"); }
        `,
        options: [{ libs: ['gt-react'] }],
      },
      // ICU select
      {
        code: `
          import { useGT } from 'gt-react';
          function C() { const gt = useGT(); return gt("{gender, select, male {He} female {She} other {They}}"); }
        `,
        options: [{ libs: ['gt-react'] }],
      },
      // ICU plural
      {
        code: `
          import { useGT } from 'gt-react';
          function C() { const gt = useGT(); return gt("{count, plural, =0 {none} one {one item} other {{count} items}}"); }
        `,
        options: [{ libs: ['gt-react'] }],
      },
      // Static template literal with valid ICU
      {
        code: `
          import { useGT } from 'gt-react';
          function C() { const gt = useGT(); return gt(\`Hello {name}!\`); }
        `,
        options: [{ libs: ['gt-react'] }],
      },
      // Static concat producing valid ICU
      {
        code: `
          import { useGT } from 'gt-react';
          function C() { const gt = useGT(); return gt("Hello " + "{name}!"); }
        `,
        options: [{ libs: ['gt-react'] }],
      },
      // msg() with valid ICU
      {
        code: `
          import { msg } from 'gt-react';
          const greeting = msg("Hello {name}!");
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// 2. Invalid ICU strings — parse errors reported
// ===================================================================

// gt("Hello {name")  — unclosed brace
describe('icu-validation: unclosed brace in ICU string', () => {
  ruleTester.run('invalid-icu-unclosed', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() { const gt = useGT(); return gt("Hello {name"); }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'invalidICUFormat' }],
      },
    ],
  });
});

// gt("Hello {name, select, }")  — malformed select
describe('icu-validation: malformed ICU select', () => {
  ruleTester.run('invalid-icu-select', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() { const gt = useGT(); return gt("Hello {name, select, }"); }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'invalidICUFormat' }],
      },
    ],
  });
});

// gt("Hello {}")  — empty placeholder
describe('icu-validation: empty ICU placeholder', () => {
  ruleTester.run('invalid-icu-empty', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() { const gt = useGT(); return gt("Hello {}"); }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'invalidICUFormat' }],
      },
    ],
  });
});

// msg("Count: {count, plural, }")  — malformed plural
describe('icu-validation: malformed ICU plural via msg()', () => {
  ruleTester.run('invalid-icu-plural-msg', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { msg } from 'gt-react';
          const label = msg("Count: {count, plural, }");
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'invalidICUFormat' }],
      },
    ],
  });
});

// gt("Hello {name")  via static concat — "Hello " + "{name"
describe('icu-validation: invalid ICU via static concat', () => {
  ruleTester.run('invalid-icu-concat', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() { const gt = useGT(); return gt("Hello " + "{name"); }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'invalidICUFormat' }],
      },
    ],
  });
});

// gt("Hello {name")  via static template literal
describe('icu-validation: invalid ICU via static template literal', () => {
  ruleTester.run('invalid-icu-template', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() { const gt = useGT(); return gt(\`Hello {name\`); }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'invalidICUFormat' }],
      },
    ],
  });
});

// ===================================================================
// 3. Non-ICU format — skip validation
// ===================================================================

// gt("Hello {unclosed", { $format: "STRING" })  — STRING format, no ICU validation
describe('icu-validation: $format STRING skips ICU validation', () => {
  ruleTester.run('format-string-skip', staticString, {
    valid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() { const gt = useGT(); return gt("Hello {unclosed", { $format: "STRING" }); }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// gt("Hello {unclosed", { $format: "I18NEXT" })  — I18NEXT format, no ICU validation
describe('icu-validation: $format I18NEXT skips ICU validation', () => {
  ruleTester.run('format-i18next-skip', staticString, {
    valid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() { const gt = useGT(); return gt("Hello {unclosed", { $format: "I18NEXT" }); }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// gt("Hello {unclosed", { $format: "ICU" })  — explicit ICU format, DOES validate
describe('icu-validation: $format ICU still validates', () => {
  ruleTester.run('format-icu-validates', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() { const gt = useGT(); return gt("Hello {unclosed", { $format: "ICU" }); }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'invalidICUFormat' }],
      },
    ],
  });
});

// ===================================================================
// 4. derive()/declareStatic() — skip ICU validation
// ===================================================================

// gt("Hello {unclosed" + derive(x))  — has derive, skip validation
describe('icu-validation: derive in concat skips ICU validation', () => {
  ruleTester.run('derive-skip', staticString, {
    valid: [
      {
        code: `
          import { useGT, derive } from 'gt-react';
          function C() { const gt = useGT(); return gt("Hello {unclosed" + derive(x)); }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// 5. Array of strings — each element validated independently
// ===================================================================

// msg(["Hello {name}", "Bye {"])  — second element is invalid ICU
describe('icu-validation: array of strings validates each element', () => {
  ruleTester.run('array-icu-validation', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { msg } from 'gt-react';
          const items = msg(["Hello {name}", "Bye {"]);
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'invalidICUFormat' }],
      },
    ],
  });
});

// ===================================================================
// 6. Template literal with static expressions — ICU validation applies
// ===================================================================

// gt(`${"hello {unclosed"}`)  — all expressions are static, merged string is invalid ICU
describe('icu-validation: template literal with static expression validates ICU', () => {
  ruleTester.run('template-static-expr-icu', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() { const gt = useGT(); return gt(\`\${"hello {unclosed"}\`); }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'invalidICUFormat' }],
      },
    ],
  });
});

// gt(`${"Hello "} ${"world"}`)  — all static expressions, valid merged string
describe('icu-validation: template literal with all-static expressions and valid ICU passes', () => {
  ruleTester.run('template-static-expr-valid', staticString, {
    valid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() { const gt = useGT(); return gt(\`\${"Hello "} \${"world"}\`); }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});
