import { RuleTester } from '@typescript-eslint/rule-tester';
import { describe } from 'vitest';
import { staticJsx } from '../index.js';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

// ===================================================================
// 1. Basic === with string
// ===================================================================

describe('edge-equality: basic === with string literal', () => {
  ruleTester.run('eq-basic-strict', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ status }) {
            return <T>{status === "active" ? "on" : "off"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ status }) {
            return <T><Branch branch={status} active="on">off</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 2. Reversed === operands
// ===================================================================

describe('edge-equality: reversed === (literal on left)', () => {
  ruleTester.run('eq-reversed-strict', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ status }) {
            return <T>{"active" === status ? "on" : "off"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ status }) {
            return <T><Branch branch={status} active="on">off</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 3. !== with string (branches swapped)
// ===================================================================

describe('edge-equality: !== swaps consequent and alternate', () => {
  ruleTester.run('eq-strict-inequality', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ status }) {
            return <T>{status !== "active" ? "other" : "on"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ status }) {
            return <T><Branch branch={status} active="on">other</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 4. != with string (same as !==)
// ===================================================================

describe('edge-equality: != swaps same as !==', () => {
  ruleTester.run('eq-loose-inequality', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ status }) {
            return <T>{status != "active" ? "other" : "on"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ status }) {
            return <T><Branch branch={status} active="on">other</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 5. == with string (same as ===)
// ===================================================================

describe('edge-equality: == extracts prop name like ===', () => {
  ruleTester.run('eq-loose-equality', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ status }) {
            return <T>{status == "active" ? "on" : "off"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ status }) {
            return <T><Branch branch={status} active="on">off</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 6. Comparison with number literal (invalid prop name)
// ===================================================================

describe('edge-equality: number literal fails prop name regex -> fallback', () => {
  ruleTester.run('eq-number-literal', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === 42 ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x === 42} true="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 7. Comparison with 0 (digit start -> invalid prop name)
// ===================================================================

describe('edge-equality: 0 starts with digit -> fallback', () => {
  ruleTester.run('eq-zero', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === 0 ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x === 0} true="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 8. Comparison with negative number (-1 is UnaryExpression, not Literal)
// ===================================================================

describe('edge-equality: negative number is not Literal -> fallback', () => {
  ruleTester.run('eq-negative-number', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === -1 ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x === -1} true="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 9. Comparison with true (prop name "true" is valid)
// ===================================================================

describe('edge-equality: boolean true -> prop name "true" is valid', () => {
  ruleTester.run('eq-boolean-true', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === true ? "yes" : "no"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x} true="yes">no</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 10. Comparison with false (prop name "false" is valid)
// ===================================================================

describe('edge-equality: boolean false -> prop name "false" is valid', () => {
  ruleTester.run('eq-boolean-false', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === false ? "off" : "on"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x} false="off">on</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 11. Comparison with null (literal.value != null fails -> fallback)
// ===================================================================

describe('edge-equality: null fails value != null check -> fallback', () => {
  ruleTester.run('eq-null', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === null ? "none" : "some"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x === null} true="none">some</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 12. Comparison with empty string (fails regex -> fallback)
// ===================================================================

describe('edge-equality: empty string fails regex -> fallback', () => {
  ruleTester.run('eq-empty-string', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === "" ? "empty" : "full"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x === ""} true="empty">full</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 13. Comparison with string containing spaces (fails regex -> fallback)
// ===================================================================

describe('edge-equality: string with spaces fails regex -> fallback', () => {
  ruleTester.run('eq-string-with-spaces', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === "hello world" ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x === "hello world"} true="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 14. Comparison with string containing dots (dots not in regex -> fallback)
// ===================================================================

describe('edge-equality: string with dots fails regex -> fallback', () => {
  ruleTester.run('eq-string-with-dots', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === "a.b" ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x === "a.b"} true="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 15. Comparison with hyphenated string (hyphens valid in regex)
// ===================================================================

describe('edge-equality: hyphenated string is valid prop name -> extracted', () => {
  ruleTester.run('eq-hyphenated-string', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === "my-value" ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x} my-value="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 16. Comparison with underscore-prefixed string (valid prop name)
// ===================================================================

describe('edge-equality: underscore-prefixed string is valid -> extracted', () => {
  ruleTester.run('eq-underscore-string', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === "_private" ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x} _private="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 17. Comparison with dollar-prefixed string (valid prop name)
// ===================================================================

describe('edge-equality: dollar-prefixed string is valid -> extracted', () => {
  ruleTester.run('eq-dollar-string', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === "$price" ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x} $price="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 18. Comparison with uppercase-starting string (valid prop name)
// ===================================================================

describe('edge-equality: uppercase string is valid -> extracted', () => {
  ruleTester.run('eq-uppercase-string', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === "Admin" ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x} Admin="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 19. Member expression on left side of ===
// ===================================================================

describe('edge-equality: member expression on left -> branch={obj.status}', () => {
  ruleTester.run('eq-member-expression', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ obj }) {
            return <T>{obj.status === "active" ? "on" : "off"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ obj }) {
            return <T><Branch branch={obj.status} active="on">off</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 20. Chained member expression on left side
// ===================================================================

describe('edge-equality: chained member expression -> branch={user.profile.role}', () => {
  ruleTester.run('eq-chained-member', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ user }) {
            return <T>{user.profile.role === "admin" ? "yes" : "no"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ user }) {
            return <T><Branch branch={user.profile.role} admin="yes">no</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 21. Function call on left side of ===
// ===================================================================

describe('edge-equality: function call on left -> branch={getStatus()}', () => {
  ruleTester.run('eq-function-call', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component() {
            return <T>{getStatus() === "active" ? "on" : "off"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component() {
            return <T><Branch branch={getStatus()} active="on">off</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 22. Negated equality: !(x === "val") -> unwrap !, swap
// ===================================================================

describe('edge-equality: negated equality !(x === "val") -> unwrap and swap', () => {
  ruleTester.run('eq-negated-equality', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{!(x === "val") ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x} val="b">a</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 23. Double negation: !!(x === "val") -> double unwrap, no swap
// ===================================================================

describe('edge-equality: double negation !!(x === "val") -> no swap', () => {
  ruleTester.run('eq-double-negation', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{!!(x === "val") ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x} val="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 24. Comparison with numeric string (starts with digit -> fails regex)
// ===================================================================

describe('edge-equality: numeric string "42" starts with digit -> fallback', () => {
  ruleTester.run('eq-numeric-string', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === "42" ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x === "42"} true="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 25. Both sides are string literals: "a" === "b"
//     Loop first tries [variable=left="a", literal=right="b"]:
//     "b" is Literal with valid prop name. branchExpr=getText(left)='"a"',
//     propName="b". Result: branch={"a"} b="yes">no
// ===================================================================

describe('edge-equality: both sides are string literals -> first literal match wins', () => {
  ruleTester.run('eq-both-literals', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component() {
            return <T>{"a" === "b" ? "yes" : "no"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component() {
            return <T><Branch branch={"a"} b="yes">no</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 26. Comparison with template literal (TemplateLiteral is not Literal)
// ===================================================================

describe('edge-equality: template literal is not Literal node -> fallback', () => {
  ruleTester.run('eq-template-literal', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === \`val\` ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x === \`val\`} true="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 27. Non-equality operators (>, <, >=, <=) -> fallback
// ===================================================================

describe('edge-equality: greater-than operator is not equality -> fallback', () => {
  ruleTester.run('eq-greater-than', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x > 0 ? "positive" : "non-positive"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x > 0} true="positive">non-positive</Branch></T>;
          }
        `,
      },
    ],
  });
});

describe('edge-equality: less-than operator is not equality -> fallback', () => {
  ruleTester.run('eq-less-than', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x < 10 ? "small" : "large"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x < 10} true="small">large</Branch></T>;
          }
        `,
      },
    ],
  });
});

describe('edge-equality: >= operator is not equality -> fallback', () => {
  ruleTester.run('eq-gte', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x >= 5 ? "high" : "low"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x >= 5} true="high">low</Branch></T>;
          }
        `,
      },
    ],
  });
});

describe('edge-equality: <= operator is not equality -> fallback', () => {
  ruleTester.run('eq-lte', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x <= 5 ? "low" : "high"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x <= 5} true="low">high</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 28. Complex test expression (logical AND in test) -> fallback
// ===================================================================

describe('edge-equality: binary AND in test -> not simple equality -> fallback', () => {
  ruleTester.run('eq-logical-and-test', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x, y }) {
            return <T>{x === "a" && y === "b" ? "both" : "nope"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x, y }) {
            return <T><Branch branch={x === "a" && y === "b"} true="both">nope</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// Additional edge cases
// ===================================================================

// Reversed !== (literal on left)
describe('edge-equality: reversed !== with literal on left -> same swap behavior', () => {
  ruleTester.run('eq-reversed-strict-inequality', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ status }) {
            return <T>{"active" !== status ? "other" : "on"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ status }) {
            return <T><Branch branch={status} active="on">other</Branch></T>;
          }
        `,
      },
    ],
  });
});

// Negated !== (double inversion: !== swaps, ! swaps again -> no swap)
describe('edge-equality: negated !== -> double swap cancels out', () => {
  ruleTester.run('eq-negated-inequality', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{!(x !== "val") ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x} val="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// Triple negation: !!!(x === "val") -> swap once
describe('edge-equality: triple negation !!!(x === "val") -> net swap', () => {
  ruleTester.run('eq-triple-negation', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{!!!(x === "val") ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x} val="b">a</Branch></T>;
          }
        `,
      },
    ],
  });
});

// String with special characters: slash
describe('edge-equality: string with slash fails regex -> fallback', () => {
  ruleTester.run('eq-string-with-slash', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === "a/b" ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x === "a/b"} true="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// String with colon
describe('edge-equality: string with colon fails regex -> fallback', () => {
  ruleTester.run('eq-string-with-colon', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === "key:val" ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x === "key:val"} true="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// String starting with hyphen (invalid: must start with [a-zA-Z_$])
describe('edge-equality: string starting with hyphen fails regex -> fallback', () => {
  ruleTester.run('eq-string-starts-with-hyphen', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === "-invalid" ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x === "-invalid"} true="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// Single character valid prop name
describe('edge-equality: single character string is valid prop name', () => {
  ruleTester.run('eq-single-char', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === "a" ? "alpha" : "other"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x} a="alpha">other</Branch></T>;
          }
        `,
      },
    ],
  });
});

// Computed member expression on left
describe('edge-equality: computed member expression on left', () => {
  ruleTester.run('eq-computed-member', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ obj, key }) {
            return <T>{obj[key] === "active" ? "on" : "off"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ obj, key }) {
            return <T><Branch branch={obj[key]} active="on">off</Branch></T>;
          }
        `,
      },
    ],
  });
});

// Logical OR in test (not equality, not unary, not binary eq)
describe('edge-equality: logical OR in test -> fallback', () => {
  ruleTester.run('eq-logical-or-test', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ a, b }) {
            return <T>{a || b ? "yes" : "no"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ a, b }) {
            return <T><Branch branch={a || b} true="yes">no</Branch></T>;
          }
        `,
      },
    ],
  });
});

// undefined is an Identifier, not a Literal -> fallback
describe('edge-equality: undefined is Identifier, not Literal -> fallback', () => {
  ruleTester.run('eq-undefined', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === undefined ? "undef" : "defined"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x === undefined} true="undef">defined</Branch></T>;
          }
        `,
      },
    ],
  });
});

// !== with null on right -> null fails value != null check,
// then tries [right=null, left=x]: x is Identifier (not Literal) -> fallback
// Since operator is !==, swap would be true, but we fall through to fallback
// which returns swap: false
describe('edge-equality: !== null -> fallback (null fails check)', () => {
  ruleTester.run('eq-strict-inequality-null', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x !== null ? "present" : "absent"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x !== null} true="present">absent</Branch></T>;
          }
        `,
      },
    ],
  });
});

// Negated simple identifier: !x ? "a" : "b"
// Unwrap ! -> x is not binary eq, not unary ! -> fallback with swap
// Inner: branchExpr=x, propName="true", swap=false
// After !: swap flipped to true
// So consequent/alternate swap: branch={x} true="b">a
describe('edge-equality: negated simple identifier !x -> swap branches', () => {
  ruleTester.run('eq-negated-identifier', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{!x ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x} true="b">a</Branch></T>;
          }
        `,
      },
    ],
  });
});

// Equality with JSX branches (not just strings)
describe('edge-equality: equality extraction with JSX branches', () => {
  ruleTester.run('eq-jsx-branches', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ role }) {
            return <T>{role === "admin" ? <b>Admin</b> : <i>User</i>}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ role }) {
            return <T><Branch branch={role} admin={<b>Admin</b>}><i>User</i></Branch></T>;
          }
        `,
      },
    ],
  });
});

// !== with JSX branches (swap applied to JSX)
describe('edge-equality: !== with JSX branches swaps correctly', () => {
  ruleTester.run('eq-inequality-jsx-branches', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ role }) {
            return <T>{role !== "admin" ? <i>User</i> : <b>Admin</b>}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ role }) {
            return <T><Branch branch={role} admin={<b>Admin</b>}><i>User</i></Branch></T>;
          }
        `,
      },
    ],
  });
});

// Equality with null alternate branch
describe('edge-equality: equality with null alternate -> self-closing', () => {
  ruleTester.run('eq-null-alternate', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ status }) {
            return <T>{status === "active" ? "on" : null}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ status }) {
            return <T><Branch branch={status} active="on" /></T>;
          }
        `,
      },
    ],
  });
});

// !== with null alternate (swap: consequent becomes alternate, null becomes consequent)
// Original: status !== "active" ? "other" : null
// Swap=true -> consequent=null, alternate="other"
// propValue = formatAsPropValue(null) -> null is not a string -> {null}
// Wait, let me re-check. consequent after swap = expr.alternate = null (Literal)
// formatAsPropValue(null literal) -> staticStringValue returns null (typeof null !== 'string')
// It's not a branchable conditional or logical and. It's not a JSXElement.
// So it returns `{null}`.
// Wait actually: consequent = swap ? expr.alternate : expr.consequent
// expr.alternate = null (the Literal null), expr.consequent = "other"
// swap=true -> consequent = null literal, alternate = "other"
// formatAsPropValue(null literal) -> staticStringValue: expr is Literal, but value is null, not string -> returns null
// Not branchable -> returns `{null}`
// formatAsChildren("other") -> staticStringValue returns "other" -> returns "other"
// So: <Branch branch={status} active={null}>other</Branch>
describe('edge-equality: !== with null alternate -> swap puts null in prop value', () => {
  ruleTester.run('eq-inequality-null-alternate', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ status }) {
            return <T>{status !== "active" ? "other" : null}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ status }) {
            return <T><Branch branch={status} active={null}>other</Branch></T>;
          }
        `,
      },
    ],
  });
});

// === with null consequent (swap=false, consequent is null)
// formatAsPropValue(null literal) -> {null}
// formatAsChildren(alternate) -> formatAsChildren checks if literal === null -> returns null (self-closing)
// Wait: consequent=null (Literal null), alternate="other"
// propValue = formatAsPropValue(null literal) -> {null}
// children = formatAsChildren("other" literal) -> "other"
// Result: <Branch branch={status === null} true={null}>other</Branch>
// Wait but null fails the extractBranchInfo check (literal.value != null)
// So it falls back: branchExpr = "status === null", propName = "true", swap = false
describe('edge-equality: === null as consequent -> fallback with null prop value', () => {
  ruleTester.run('eq-null-consequent', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ status }) {
            return <T>{status === null ? null : "other"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ status }) {
            return <T><Branch branch={status === null} true={null}>other</Branch></T>;
          }
        `,
      },
    ],
  });
});

// String with @ symbol (not in regex)
describe('edge-equality: string with @ fails regex -> fallback', () => {
  ruleTester.run('eq-string-with-at', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === "@user" ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x === "@user"} true="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// String with # symbol
describe('edge-equality: string with # fails regex -> fallback', () => {
  ruleTester.run('eq-string-with-hash', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === "#tag" ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x === "#tag"} true="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// camelCase valid prop name
describe('edge-equality: camelCase string is valid prop name -> extracted', () => {
  ruleTester.run('eq-camel-case', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === "myValue" ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x} myValue="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ALL_CAPS valid prop name
describe('edge-equality: ALL_CAPS string is valid prop name -> extracted', () => {
  ruleTester.run('eq-all-caps', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === "ACTIVE" ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x} ACTIVE="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// Reversed != (literal on left)
describe('edge-equality: reversed != with literal on left', () => {
  ruleTester.run('eq-reversed-loose-inequality', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ status }) {
            return <T>{"active" != status ? "other" : "on"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ status }) {
            return <T><Branch branch={status} active="on">other</Branch></T>;
          }
        `,
      },
    ],
  });
});

// Reversed == (literal on left)
describe('edge-equality: reversed == with literal on left', () => {
  ruleTester.run('eq-reversed-loose-equality', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ status }) {
            return <T>{"active" == status ? "on" : "off"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ status }) {
            return <T><Branch branch={status} active="on">off</Branch></T>;
          }
        `,
      },
    ],
  });
});

// Optional chaining member expression on left
describe('edge-equality: optional chaining member expression', () => {
  ruleTester.run('eq-optional-chaining', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ user }) {
            return <T>{user?.role === "admin" ? "yes" : "no"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ user }) {
            return <T><Branch branch={user?.role} admin="yes">no</Branch></T>;
          }
        `,
      },
    ],
  });
});

// Typeof comparison (typeof is UnaryExpression, not Literal)
describe('edge-equality: typeof on left is valid variable expression', () => {
  ruleTester.run('eq-typeof', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{typeof x === "string" ? "text" : "other"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={typeof x} string="text">other</Branch></T>;
          }
        `,
      },
    ],
  });
});

// Comparison with NaN (NaN is an Identifier, not a Literal)
describe('edge-equality: NaN is Identifier, not Literal -> fallback', () => {
  ruleTester.run('eq-nan', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === NaN ? "invalid" : "valid"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x === NaN} true="invalid">valid</Branch></T>;
          }
        `,
      },
    ],
  });
});

// Comparison with Infinity (Identifier, not Literal)
describe('edge-equality: Infinity is Identifier, not Literal -> fallback', () => {
  ruleTester.run('eq-infinity', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === Infinity ? "inf" : "finite"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x === Infinity} true="inf">finite</Branch></T>;
          }
        `,
      },
    ],
  });
});

// Comparison with BigInt literal (not a Literal node in ESTree)
describe('edge-equality: BigInt literal -> fallback', () => {
  ruleTester.run('eq-bigint', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === 1n ? "one" : "other"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x === 1n} true="one">other</Branch></T>;
          }
        `,
      },
    ],
  });
});

// String with only underscores
describe('edge-equality: string of underscores is valid prop name -> extracted', () => {
  ruleTester.run('eq-underscores-only', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === "___" ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x} ___="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// Single dollar sign
describe('edge-equality: single $ is valid prop name -> extracted', () => {
  ruleTester.run('eq-single-dollar', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === "$" ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x} $="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// Parenthesized equality: (x === "val") ? "a" : "b"
// The test expression is the BinaryExpression inside parens (parens are not AST nodes)
describe('edge-equality: parenthesized equality extracts correctly', () => {
  ruleTester.run('eq-parenthesized', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{(x === "val") ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x} val="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// Regex string: "^abc$" -> has ^ and $ in middle, but starts with ^
// ^ is not in [a-zA-Z_$] at start position... wait, actually $ IS valid at start
// but ^ is not. So "^abc$" fails the regex
describe('edge-equality: string starting with ^ fails regex -> fallback', () => {
  ruleTester.run('eq-caret-string', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ x }) {
            return <T>{x === "^abc" ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ x }) {
            return <T><Branch branch={x === "^abc"} true="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// Equality comparison in nested ternary alternate
describe('edge-equality: equality in nested ternary alternate position', () => {
  ruleTester.run('eq-nested-alternate-equality', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ a, b }) {
            return <T>{a ? "first" : b === "x" ? "second" : "third"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ a, b }) {
            return <T><Branch branch={a} true="first"><Branch branch={b} x="second">third</Branch></Branch></T>;
          }
        `,
      },
    ],
  });
});

// Inequality (swap) in nested ternary
describe('edge-equality: !== in nested ternary -> swap in nested level', () => {
  ruleTester.run('eq-nested-inequality', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ a, b }) {
            return <T>{a !== "x" ? b === "y" ? "B" : "C" : "A"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        // a !== "x" -> swap: consequent becomes "A", alternate becomes (b === "y" ? "B" : "C")
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ a, b }) {
            return <T><Branch branch={a} x="A"><Branch branch={b} y="B">C</Branch></Branch></T>;
          }
        `,
      },
    ],
  });
});
