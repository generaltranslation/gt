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
// 1. Matched braces in static text
// ===================================================================

// gt("a{b}c" + name)
// → gt("a'{'b'}'c{var0}", { var0: name })
// Each brace independently ICU-quoted
describe('brace-escaping: matched braces in static text', () => {
  ruleTester.run('brace-matched', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("a{b}c" + name);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("a'{'b'}'c{var0}", { var0: name });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 2. Reversed braces (} before {) in static text
// ===================================================================

// gt("a}b{c" + name)
// → gt("a'}'b'{'c{var0}", { var0: name })
// } before { — the fix that prompted self-contained quoting
describe('brace-escaping: reversed braces } before { in static text', () => {
  ruleTester.run('brace-reversed', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("a}b{c" + name);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("a'}'b'{'c{var0}", { var0: name });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 3. Multiple adjacent braces
// ===================================================================

// gt("}}{{" + name)
// → gt("'}''}''{''{'{var0}", { var0: name })
// Each brace gets its own quote pair: '}'  '}'  '{'  '{'
// Adjacent quotes merge: '}' + '}' → '}''}', '{' + '{' → '{''{'.
// The final ' of the last '{' sits right before the ICU placeholder {var0}.
describe('brace-escaping: multiple adjacent braces }}{{', () => {
  ruleTester.run('brace-adjacent', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("}}{{" + name);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("'}''}''{''{'{var0}", { var0: name });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 4. Apostrophe in static text (should be doubled)
// ===================================================================

// gt("a'b" + name)
// → gt("a''b{var0}", { var0: name })
// Single apostrophe doubled for ICU escaping
describe('brace-escaping: apostrophe in static text is doubled', () => {
  ruleTester.run('brace-apostrophe', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("a'b" + name);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("a''b{var0}", { var0: name });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 5. Apostrophe + braces — apostrophe doubled, braces quoted
// ===================================================================

// gt("a'{b}'c" + name)
// → gt("a'''{'b'}'''c{var0}", { var0: name })
// escapeICUText("a'{b}'c"):
//   Step 1 (' → ''): "a''{b}''c"
//   Step 2 ({ → '{'): "a'''{'b}''c"
//   Step 3 (} → '}'): "a'''{'b'}'''c"
describe('brace-escaping: apostrophe + braces combination', () => {
  ruleTester.run('brace-apostrophe-combo', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("a'{b}'c" + name);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("a'''{'b'}'''c{var0}", { var0: name });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 6. Lone open brace
// ===================================================================

// gt("{" + name)
// → gt("'{'{var0}", { var0: name })
// Single { becomes '{'
describe('brace-escaping: lone open brace', () => {
  ruleTester.run('brace-lone-open', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("{" + name);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("'{'{var0}", { var0: name });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 7. Lone close brace
// ===================================================================

// gt("}" + name)
// → gt("'}'{var0}", { var0: name })
// Single } becomes '}'
describe('brace-escaping: lone close brace', () => {
  ruleTester.run('brace-lone-close', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("}" + name);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("'}'{var0}", { var0: name });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 8. Select branch value containing }
// ===================================================================

// gt("" + (x === "a" ? "val}" : "ok"))
// → gt("{var0, select, a {val'}'} other {ok}}", { var0: x })
// The } in "val}" must be ICU-escaped within the select branch
describe('brace-escaping: select branch value containing }', () => {
  ruleTester.run('brace-select-branch-close', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("" + (x === "a" ? "val}" : "ok"));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("{var0, select, a {val'}'} other {ok}}", { var0: x });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 9. Select "other" value containing {
// ===================================================================

// gt("" + (x === "a" ? "ok" : "val{"))
// → gt("{var0, select, a {ok} other {val'{'}}", { var0: x })
// The { in "val{" must be ICU-escaped in the other branch
describe('brace-escaping: select other value containing {', () => {
  ruleTester.run('brace-select-other-open', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("" + (x === "a" ? "ok" : "val{"));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("{var0, select, a {ok} other {val'{'}}", { var0: x });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 10. Select branch with apostrophe
// ===================================================================

// gt("" + (x === "a" ? "it's" : "ok"))
// → gt("{var0, select, a {it''s} other {ok}}", { var0: x })
// Apostrophe doubled in select branch value
describe('brace-escaping: select branch with apostrophe', () => {
  ruleTester.run('brace-select-branch-apostrophe', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("" + (x === "a" ? "it's" : "ok"));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("{var0, select, a {it''s} other {ok}}", { var0: x });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 11. Multiple braces in static text — realistic regex-like content
// ===================================================================

// gt("regex /[a-z]{2,4}/ " + name)
// → gt("regex /[a-z]'{'2,4'}'/ {var0}", { var0: name })
// Realistic regex-like content; { and } independently ICU-quoted
describe('brace-escaping: realistic regex-like content with braces', () => {
  ruleTester.run('brace-regex-content', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("regex /[a-z]{2,4}/ " + name);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("regex /[a-z]'{'2,4'}'/ {var0}", { var0: name });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 12. Template literal path with braces (derive triggers template output)
// ===================================================================

// gt("a{b}" + derive(x) + name)
// → gt(`a'{'b'}'${derive(x)}{var0}`, { var0: name })
// Braces in static text ICU-quoted; derive triggers template literal output.
// In template literal output, escapeTemplateLiteral(escapeICUText(value)):
//   escapeICUText("a{b}") = "a'{'b'}'"
//   escapeTemplateLiteral("a'{'b'}'") = "a'{'b'}'" (no backticks or ${ to escape)
describe('brace-escaping: braces in static text with derive path', () => {
  ruleTester.run('brace-derive-template', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT, derive } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt("a{b}" + derive(x) + name);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT, derive } from 'gt-react';
          function C() {
            const gt = useGT();
            return gt(\`a'{'b'}'\${derive(x)}{var0}\`, { var0: name });
          }
        `,
      },
    ],
  });
});
