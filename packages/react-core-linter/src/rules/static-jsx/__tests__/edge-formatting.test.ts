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
// 1. String with single quote (special char inside double-quoted attr)
// ===================================================================
describe('edge-formatting: single quote inside double-quoted attribute', () => {
  ruleTester.run('single-quote-in-attr', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ cond }) {
            return <T>{cond ? "it's" : "other"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ cond }) {
            return <T><Branch branch={cond} true="it's">other</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 2. Alternate is empty string → children is empty text node
// ===================================================================
describe('edge-formatting: alternate is empty string', () => {
  ruleTester.run('alternate-empty-string', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ cond }) {
            return <T>{cond ? "yes" : ""}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ cond }) {
            return <T><Branch branch={cond} true="yes"></Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 3. Both branches are static template literals
// ===================================================================
describe('edge-formatting: both branches static template literals', () => {
  ruleTester.run('both-template-literals', staticJsx, {
    valid: [],
    invalid: [
      {
        code: [
          "import { T } from 'gt-react';",
          'function C({ cond }) {',
          '  return <T>{cond ? `hello` : `world`}</T>;',
          '}',
        ].join('\n'),
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: [
          "import { T, Branch } from 'gt-react';",
          'function C({ cond }) {',
          '  return <T><Branch branch={cond} true="hello">world</Branch></T>;',
          '}',
        ].join('\n'),
      },
    ],
  });
});

// ===================================================================
// 4. Consequent is JSX with nested elements
// ===================================================================
describe('edge-formatting: consequent JSX with nested elements', () => {
  ruleTester.run('nested-jsx-elements', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ cond }) {
            return <T>{cond ? <div><span>text</span></div> : "plain"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ cond }) {
            return <T><Branch branch={cond} true={<div><span>text</span></div>}>plain</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 5. Alternate is JSX fragment
// ===================================================================
describe('edge-formatting: alternate is JSX fragment', () => {
  ruleTester.run('alternate-jsx-fragment', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ cond }) {
            return <T>{cond ? "text" : <>fragment</>}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ cond }) {
            return <T><Branch branch={cond} true="text"><>fragment</></Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 6. Consequent is self-closing JSX element
// ===================================================================
describe('edge-formatting: consequent is self-closing JSX', () => {
  ruleTester.run('self-closing-jsx', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ cond }) {
            return <T>{cond ? <img src="x" /> : "text"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ cond }) {
            return <T><Branch branch={cond} true={<img src="x" />}>text</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 7. Both branches null → neither has translatable content → Var
// ===================================================================
describe('edge-formatting: both branches null falls back to Var', () => {
  ruleTester.run('both-null-var-fallback', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ cond }) {
            return <T>{cond ? null : null}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-react';
          function C({ cond }) {
            return <T><Var>{cond ? null : null}</Var></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 8. Consequent null, alternate string → Branch
//    null Literal: formatAsPropValue sees staticStringValue → null
//    (typeof null !== 'string'), not branchable → {null}
//    formatAsChildren("text") → "text" (raw string)
// ===================================================================
describe('edge-formatting: consequent null, alternate string', () => {
  ruleTester.run('consequent-null-alternate-string', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ cond }) {
            return <T>{cond ? null : "text"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ cond }) {
            return <T><Branch branch={cond} true={null}>text</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 9. Alternate is undefined → Identifier, not translatable
//    formatAsChildren returns {undefined} (expression container).
//    After first fix, {undefined} inside Branch children triggers
//    a second error → wrapped in Var.
// ===================================================================
describe('edge-formatting: alternate is undefined identifier', () => {
  ruleTester.run('alternate-undefined', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ cond }) {
            return <T>{cond ? "yes" : undefined}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: [
          `
          import { T, Branch } from 'gt-react';
          function C({ cond }) {
            return <T><Branch branch={cond} true="yes">{undefined}</Branch></T>;
          }
        `,
          `
          import { T, Branch, Var } from 'gt-react';
          function C({ cond }) {
            return <T><Branch branch={cond} true="yes"><Var>{undefined}</Var></Branch></T>;
          }
        `,
        ],
      },
    ],
  });
});

// ===================================================================
// 10. Consequent is array expression → dynamic, becomes {[1,2,3]}
//     in prop value. After first fix, the expression container
//     {[1,2,3]} in Branch attribute triggers a second error that
//     wraps it as <Var>{[1,2,3]}</Var> (replacing the container).
// ===================================================================
describe('edge-formatting: consequent is array expression', () => {
  ruleTester.run('consequent-array', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ cond }) {
            return <T>{cond ? [1,2,3] : "text"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: [
          `
          import { T, Branch } from 'gt-react';
          function C({ cond }) {
            return <T><Branch branch={cond} true={[1,2,3]}>text</Branch></T>;
          }
        `,
          `
          import { T, Branch, Var } from 'gt-react';
          function C({ cond }) {
            return <T><Branch branch={cond} true=<Var>{[1,2,3]}</Var>>text</Branch></T>;
          }
        `,
        ],
      },
    ],
  });
});

// ===================================================================
// 11. Consequent is object expression → double braces {{}}.
//     After first fix, the expression container in Branch attribute
//     triggers a second error → Var wrapping replaces the container.
// ===================================================================
describe('edge-formatting: consequent is object expression', () => {
  ruleTester.run('consequent-object', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ cond }) {
            return <T>{cond ? {a: 1} : "text"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: [
          `
          import { T, Branch } from 'gt-react';
          function C({ cond }) {
            return <T><Branch branch={cond} true={{a: 1}}>text</Branch></T>;
          }
        `,
          `
          import { T, Branch, Var } from 'gt-react';
          function C({ cond }) {
            return <T><Branch branch={cond} true=<Var>{{a: 1}}</Var>>text</Branch></T>;
          }
        `,
        ],
      },
    ],
  });
});

// ===================================================================
// 12. Alternate is number literal → formatAsChildren returns {42}.
//     Number 42 is a Literal (in ALLOWED_JSX_EXPRESSIONS), so
//     no second error is triggered — single output only.
// ===================================================================
describe('edge-formatting: alternate is number literal', () => {
  ruleTester.run('alternate-number', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ cond }) {
            return <T>{cond ? "text" : 42}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ cond }) {
            return <T><Branch branch={cond} true="text">{42}</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 13. Alternate is boolean literal → formatAsChildren returns {true}.
//     Boolean true is a Literal (in ALLOWED_JSX_EXPRESSIONS), so
//     no second error is triggered — single output only.
// ===================================================================
describe('edge-formatting: alternate is boolean literal', () => {
  ruleTester.run('alternate-boolean', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ cond }) {
            return <T>{cond ? "text" : true}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ cond }) {
            return <T><Branch branch={cond} true="text">{true}</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 14. Long string values are preserved exactly
// ===================================================================
describe('edge-formatting: long string values preserved', () => {
  ruleTester.run('long-string-values', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ cond }) {
            return <T>{cond ? "This is a very long string that should be preserved exactly" : "short"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ cond }) {
            return <T><Branch branch={cond} true="This is a very long string that should be preserved exactly">short</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 15. String with unicode characters
// ===================================================================
describe('edge-formatting: string with unicode characters', () => {
  ruleTester.run('unicode-strings', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ cond }) {
            return <T>{cond ? "héllo" : "wörld"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ cond }) {
            return <T><Branch branch={cond} true="héllo">wörld</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 16. String with escaped newline
//     "line1\nline2" in source has JS value "line1" + newline + "line2"
//     formatAsPropValue uses the JS value, producing a literal
//     newline in the attribute value.
// ===================================================================
describe('edge-formatting: string with escaped newline', () => {
  ruleTester.run('escaped-newline', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ cond }) {
            return <T>{cond ? "line1\\nline2" : "other"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ cond }) {
            return <T><Branch branch={cond} true="line1\nline2">other</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 17. JSX with dynamic expression in attribute
//     {url} in href of <a> is NOT inside the T scope (JSXOpeningElement
//     pushes 'no-T'), so only the ternary itself triggers an error.
//     Single error, single output.
// ===================================================================
describe('edge-formatting: JSX with expression in attribute (single error)', () => {
  ruleTester.run('jsx-attr-expression', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ cond, url }) {
            return <T>{cond ? <a href={url}>Link</a> : "text"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ cond, url }) {
            return <T><Branch branch={cond} true={<a href={url}>Link</a>}>text</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 18. Parenthesized ternary — parens are not in the AST, the fix
//     replaces the entire JSXExpressionContainer node.
// ===================================================================
describe('edge-formatting: parenthesized ternary', () => {
  ruleTester.run('parenthesized-ternary', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ cond }) {
            return <T>{(cond ? "a" : "b")}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ cond }) {
            return <T><Branch branch={cond} true="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 19. Ternary inside nested JSX within T
// ===================================================================
describe('edge-formatting: ternary inside nested JSX within T', () => {
  ruleTester.run('ternary-in-nested-jsx', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ cond }) {
            return <T><p>{cond ? "a" : "b"}</p></T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ cond }) {
            return <T><p><Branch branch={cond} true="a">b</Branch></p></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 20. Consequent string, alternate null → self-closing Branch
// ===================================================================
describe('edge-formatting: consequent string, alternate null → self-closing', () => {
  ruleTester.run('string-then-null-self-closing', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ cond }) {
            return <T>{cond ? "visible" : null}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ cond }) {
            return <T><Branch branch={cond} true="visible" /></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 21. Consequent empty string, alternate non-empty string
// ===================================================================
describe('edge-formatting: consequent empty string, alternate non-empty', () => {
  ruleTester.run('empty-string-consequent', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ cond }) {
            return <T>{cond ? "" : "fallback"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ cond }) {
            return <T><Branch branch={cond} true="">fallback</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 22. Both branches are empty strings
// ===================================================================
describe('edge-formatting: both branches empty strings', () => {
  ruleTester.run('both-empty-strings', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ cond }) {
            return <T>{cond ? "" : ""}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ cond }) {
            return <T><Branch branch={cond} true=""></Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 23. Consequent is JSX fragment, alternate is string
// ===================================================================
describe('edge-formatting: consequent JSX fragment, alternate string', () => {
  ruleTester.run('consequent-fragment', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ cond }) {
            return <T>{cond ? <>frag content</> : "plain"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ cond }) {
            return <T><Branch branch={cond} true={<>frag content</>}>plain</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 24. Logical AND with static template literal
// ===================================================================
describe('edge-formatting: logical AND with template literal', () => {
  ruleTester.run('logical-and-template', staticJsx, {
    valid: [],
    invalid: [
      {
        code: [
          "import { T } from 'gt-react';",
          'function C({ show }) {',
          '  return <T>{show && `visible`}</T>;',
          '}',
        ].join('\n'),
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: [
          "import { T, Branch } from 'gt-react';",
          'function C({ show }) {',
          '  return <T><Branch branch={!!show} true="visible" /></T>;',
          '}',
        ].join('\n'),
      },
    ],
  });
});

// ===================================================================
// 25. Logical AND with JSX fragment
// ===================================================================
describe('edge-formatting: logical AND with JSX fragment', () => {
  ruleTester.run('logical-and-fragment', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ show }) {
            return <T>{show && <>fragment</>}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ show }) {
            return <T><Branch branch={!!show} true={<>fragment</>} /></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 26. Ternary with call expression in consequent (dynamic), string
//     alternate → one branch translatable → Branch.
//     After first fix, {getLabel()} inside Branch attribute triggers
//     a second error → Var wrapping replaces the expression container.
// ===================================================================
describe('edge-formatting: call expression consequent, string alternate', () => {
  ruleTester.run('call-expr-consequent', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ cond }) {
            return <T>{cond ? getLabel() : "default"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: [
          `
          import { T, Branch } from 'gt-react';
          function C({ cond }) {
            return <T><Branch branch={cond} true={getLabel()}>default</Branch></T>;
          }
        `,
          `
          import { T, Branch, Var } from 'gt-react';
          function C({ cond }) {
            return <T><Branch branch={cond} true=<Var>{getLabel()}</Var>>default</Branch></T>;
          }
        `,
        ],
      },
    ],
  });
});

// ===================================================================
// 27. Ternary with member expression in alternate (dynamic), string
//     consequent → one branch translatable → Branch.
//     After first fix, {obj.value} inside Branch children triggers
//     a second error → wrapped in Var.
// ===================================================================
describe('edge-formatting: string consequent, member expression alternate', () => {
  ruleTester.run('member-expr-alternate', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ cond, obj }) {
            return <T>{cond ? "label" : obj.value}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: [
          `
          import { T, Branch } from 'gt-react';
          function C({ cond, obj }) {
            return <T><Branch branch={cond} true="label">{obj.value}</Branch></T>;
          }
        `,
          `
          import { T, Branch, Var } from 'gt-react';
          function C({ cond, obj }) {
            return <T><Branch branch={cond} true="label"><Var>{obj.value}</Var></Branch></T>;
          }
        `,
        ],
      },
    ],
  });
});

// ===================================================================
// 28. Nested ternary where inner alternate is null → self-closing
//     inner Branch
// ===================================================================
describe('edge-formatting: nested ternary with null inner alternate', () => {
  ruleTester.run('nested-ternary-null-alternate', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ a, b }) {
            return <T>{a ? "x" : b ? "y" : null}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ a, b }) {
            return <T><Branch branch={a} true="x"><Branch branch={b} true="y" /></Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 29. Nested ternary in prop position (consequent is nested ternary)
// ===================================================================
describe('edge-formatting: consequent is nested ternary', () => {
  ruleTester.run('consequent-nested-ternary', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ a, b }) {
            return <T>{a ? (b ? "x" : "y") : "z"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ a, b }) {
            return <T><Branch branch={a} true={<Branch branch={b} true="x">y</Branch>}>z</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 30. String with backslash
//     "path\\to\\file" in source → JS value "path\to\file" (literal
//     backslashes). formatAsPropValue outputs the JS value directly.
// ===================================================================
describe('edge-formatting: string with backslash', () => {
  ruleTester.run('string-backslash', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ cond }) {
            return <T>{cond ? "path\\\\to\\\\file" : "other"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ cond }) {
            return <T><Branch branch={cond} true="path\\to\\file">other</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 31. String with ampersand → literal & in value
// ===================================================================
describe('edge-formatting: string with ampersand', () => {
  ruleTester.run('string-ampersand', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ cond }) {
            return <T>{cond ? "Tom & Jerry" : "other"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ cond }) {
            return <T><Branch branch={cond} true="Tom & Jerry">other</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 32. String with angle brackets
// ===================================================================
describe('edge-formatting: string with angle brackets', () => {
  ruleTester.run('string-angle-brackets', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ cond }) {
            return <T>{cond ? "a < b > c" : "other"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ cond }) {
            return <T><Branch branch={cond} true="a < b > c">other</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 33. Equality with numeric literal → String(1) = "1" which starts
//     with a digit, failing VALID_JSX_PROP_NAME. Falls back to
//     using the entire binary expression as branch value.
// ===================================================================
describe('edge-formatting: equality with numeric literal', () => {
  ruleTester.run('equality-numeric-literal', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ val }) {
            return <T>{val === 1 ? "one" : "other"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ val }) {
            return <T><Branch branch={val === 1} true="one">other</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 34. Equality with hyphenated string value → valid JSX prop name
// ===================================================================
describe('edge-formatting: equality with hyphenated string value', () => {
  ruleTester.run('equality-hyphenated-prop', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ status }) {
            return <T>{status === "in-progress" ? "Working" : "Done"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ status }) {
            return <T><Branch branch={status} in-progress="Working">Done</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 35. Equality with space in string value → fails VALID_JSX_PROP_NAME
//     regex → falls back to using entire expression as branch value.
// ===================================================================
describe('edge-formatting: equality with space in string value', () => {
  ruleTester.run('equality-space-in-value', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ status }) {
            return <T>{status === "in progress" ? "Working" : "Done"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ status }) {
            return <T><Branch branch={status === "in progress"} true="Working">Done</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 36. Ternary with JSX elements on both sides
// ===================================================================
describe('edge-formatting: JSX elements on both branches', () => {
  ruleTester.run('jsx-both-branches', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ cond }) {
            return <T>{cond ? <strong>yes</strong> : <em>no</em>}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ cond }) {
            return <T><Branch branch={cond} true={<strong>yes</strong>}><em>no</em></Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 37. Logical AND with self-closing JSX
// ===================================================================
describe('edge-formatting: logical AND with self-closing JSX', () => {
  ruleTester.run('logical-and-self-closing', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ show }) {
            return <T>{show && <hr />}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ show }) {
            return <T><Branch branch={!!show} true={<hr />} /></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 38. Multiple ternaries in same T — ESLint applies fixes one at a
//     time. First pass fixes the first ternary; second pass (after
//     re-lint) fixes the second.
// ===================================================================
describe('edge-formatting: multiple ternaries in same T (iterative fix)', () => {
  ruleTester.run('multiple-ternaries', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ a, b }) {
            return <T>{a ? "yes" : "no"} and {b ? "on" : "off"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [
          { messageId: 'dynamicContent' },
          { messageId: 'dynamicContent' },
        ],
        output: [
          `
          import { T, Branch } from 'gt-react';
          function C({ a, b }) {
            return <T><Branch branch={a} true="yes">no</Branch> and {b ? "on" : "off"}</T>;
          }
        `,
          `
          import { T, Branch } from 'gt-react';
          function C({ a, b }) {
            return <T><Branch branch={a} true="yes">no</Branch> and <Branch branch={b} true="on">off</Branch></T>;
          }
        `,
        ],
      },
    ],
  });
});

// ===================================================================
// 39. Binary expression consequent — not translatable, but alternate
//     is string → one branch translatable → Branch.
//     After first fix, {x + 1} in Branch attribute triggers a second
//     error → Var wrapping replaces the expression container.
// ===================================================================
describe('edge-formatting: binary expression consequent', () => {
  ruleTester.run('binary-expr-consequent', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ cond, x }) {
            return <T>{cond ? x + 1 : "none"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: [
          `
          import { T, Branch } from 'gt-react';
          function C({ cond, x }) {
            return <T><Branch branch={cond} true={x + 1}>none</Branch></T>;
          }
        `,
          `
          import { T, Branch, Var } from 'gt-react';
          function C({ cond, x }) {
            return <T><Branch branch={cond} true=<Var>{x + 1}</Var>>none</Branch></T>;
          }
        `,
        ],
      },
    ],
  });
});

// ===================================================================
// 40. String with only whitespace as alternate children
// ===================================================================
describe('edge-formatting: string with only whitespace', () => {
  ruleTester.run('whitespace-string', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ cond }) {
            return <T>{cond ? "hello" : " "}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ cond }) {
            return <T><Branch branch={cond} true="hello"> </Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 41. Deeply nested ternary (3 levels)
// ===================================================================
describe('edge-formatting: triple-nested ternary', () => {
  ruleTester.run('triple-nested-ternary', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ a, b, c }) {
            return <T>{a ? "w" : b ? "x" : c ? "y" : "z"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ a, b, c }) {
            return <T><Branch branch={a} true="w"><Branch branch={b} true="x"><Branch branch={c} true="y">z</Branch></Branch></Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 42. Logical AND with complex left side (a && b && "both")
//     The outer LogicalExpression has left=a&&b, right="both".
//     generateLogicalAnd uses source text of left: "a && b".
// ===================================================================
describe('edge-formatting: logical AND with complex left side', () => {
  ruleTester.run('logical-and-complex-left', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ a, b }) {
            return <T>{a && b && "both"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ a, b }) {
            return <T><Branch branch={!!a && b} true="both" /></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 43. JSX with multiple attributes preserved in prop value
// ===================================================================
describe('edge-formatting: JSX with multiple attributes in prop', () => {
  ruleTester.run('jsx-multi-attrs', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ cond }) {
            return <T>{cond ? <input type="text" disabled /> : "none"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ cond }) {
            return <T><Branch branch={cond} true={<input type="text" disabled />}>none</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 44. Equality with boolean literal true → literal.value is true
//     (not null), String(true) = "true", passes VALID_JSX_PROP_NAME.
//     So propName = "true", which matches default behavior.
// ===================================================================
describe('edge-formatting: equality with boolean literal true', () => {
  ruleTester.run('equality-boolean-true', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ flag }) {
            return <T>{flag === true ? "on" : "off"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ flag }) {
            return <T><Branch branch={flag} true="on">off</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 45. String consequent containing curly braces → in prop value,
//     the curly braces are inside double quotes so treated as literal
//     characters in JSX attributes.
// ===================================================================
describe('edge-formatting: string with curly braces in prop value', () => {
  ruleTester.run('string-curly-braces', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ cond }) {
            return <T>{cond ? "{value}" : "other"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ cond }) {
            return <T><Branch branch={cond} true="{value}">other</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 46. Alternate string with curly braces → formatAsChildren returns
//     the raw JS value "{braces}". In the output JSX, this is parsed
//     as an expression container {braces}, causing a subsequent error
//     that wraps it in Var.
// ===================================================================
describe('edge-formatting: alternate string with curly braces as children', () => {
  ruleTester.run('alternate-string-curly-braces', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ cond }) {
            return <T>{cond ? "text" : "{braces}"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ cond }) {
            return <T><Branch branch={cond} true="text">&#123;braces&#125;</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 47. Equality with boolean literal false → String(false) = "false",
//     which passes VALID_JSX_PROP_NAME.
// ===================================================================
describe('edge-formatting: equality with boolean literal false', () => {
  ruleTester.run('equality-boolean-false', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ flag }) {
            return <T>{flag === false ? "off" : "on"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ flag }) {
            return <T><Branch branch={flag} false="off">on</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 48. Ternary with string in both positions inside deeply nested JSX
// ===================================================================
describe('edge-formatting: ternary inside multiply-nested JSX in T', () => {
  ruleTester.run('deep-nested-jsx-ternary', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ cond }) {
            return <T><div><span>{cond ? "a" : "b"}</span></div></T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ cond }) {
            return <T><div><span><Branch branch={cond} true="a">b</Branch></span></div></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 49. Logical AND with nested ternary → Branch with nested Branch
//     in prop value
// ===================================================================
describe('edge-formatting: logical AND with nested ternary', () => {
  ruleTester.run('logical-and-nested-ternary', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ show, type }) {
            return <T>{show && (type === "a" ? "Alpha" : "Beta")}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ show, type }) {
            return <T><Branch branch={!!show} true={<Branch branch={type} a="Alpha">Beta</Branch>} /></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 50. Equality with underscore-prefixed prop name → valid
// ===================================================================
describe('edge-formatting: equality with underscore-prefixed value', () => {
  ruleTester.run('equality-underscore-prop', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ role }) {
            return <T>{role === "_admin" ? "Admin" : "User"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ role }) {
            return <T><Branch branch={role} _admin="Admin">User</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 51. Equality with dollar-sign prefixed prop name → valid
// ===================================================================
describe('edge-formatting: equality with dollar-sign-prefixed value', () => {
  ruleTester.run('equality-dollar-prop', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ currency }) {
            return <T>{currency === "$usd" ? "Dollar" : "Other"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ currency }) {
            return <T><Branch branch={currency} $usd="Dollar">Other</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 52. Equality with string containing special chars (dot) → fails
//     VALID_JSX_PROP_NAME → full expression as branch
// ===================================================================
describe('edge-formatting: equality with dot in string value', () => {
  ruleTester.run('equality-dot-in-value', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ version }) {
            return <T>{version === "v1.0" ? "Legacy" : "Current"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ version }) {
            return <T><Branch branch={version === "v1.0"} true="Legacy">Current</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 53. Both branches JSX fragments → prop uses expression container,
//     children uses raw fragment source
// ===================================================================
describe('edge-formatting: both branches JSX fragments', () => {
  ruleTester.run('both-fragments', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ cond }) {
            return <T>{cond ? <>yes</> : <>no</>}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ cond }) {
            return <T><Branch branch={cond} true={<>yes</>}><>no</></Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 54. Consequent is a numeric literal, alternate is string
//     Number is not a string literal → formatAsPropValue returns
//     {sourceText}. Number has no translatable content but the
//     alternate string does → isBranchableConditional returns true.
// ===================================================================
describe('edge-formatting: numeric consequent, string alternate', () => {
  ruleTester.run('numeric-consequent', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ cond }) {
            return <T>{cond ? 0 : "zero"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ cond }) {
            return <T><Branch branch={cond} true={0}>zero</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 55. Negated condition with equality → double swap.
//     !(x === "a") → extractBranchInfo first matches the equality
//     (propName="a", swap=false), then the ! flips swap to true.
//     With swap=true: consequent/alternate are swapped.
// ===================================================================
describe('edge-formatting: negated equality condition', () => {
  ruleTester.run('negated-equality', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ x }) {
            return <T>{!(x === "a") ? "not-A" : "is-A"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ x }) {
            return <T><Branch branch={x} a="is-A">not-A</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 56. Double negation → swap flips twice back to original
// ===================================================================
describe('edge-formatting: double negation condition', () => {
  ruleTester.run('double-negation', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ cond }) {
            return <T>{!!cond ? "yes" : "no"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ cond }) {
            return <T><Branch branch={cond} true="yes">no</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 57. != operator → swap=true, so branches are swapped
// ===================================================================
describe('edge-formatting: != operator swaps branches', () => {
  ruleTester.run('not-equal-loose', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ status }) {
            return <T>{status != "done" ? "pending" : "complete"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ status }) {
            return <T><Branch branch={status} done="complete">pending</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 58. Ternary with template literal consequent, JSX alternate
// ===================================================================
describe('edge-formatting: template literal consequent, JSX alternate', () => {
  ruleTester.run('template-consequent-jsx-alternate', staticJsx, {
    valid: [],
    invalid: [
      {
        code: [
          "import { T } from 'gt-react';",
          'function C({ cond }) {',
          '  return <T>{cond ? `text` : <b>bold</b>}</T>;',
          '}',
        ].join('\n'),
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: [
          "import { T, Branch } from 'gt-react';",
          'function C({ cond }) {',
          '  return <T><Branch branch={cond} true="text"><b>bold</b></Branch></T>;',
          '}',
        ].join('\n'),
      },
    ],
  });
});

// ===================================================================
// 59. Equality with empty string → propName "" fails
//     VALID_JSX_PROP_NAME (doesn't start with letter/$/_ ) →
//     falls back to full expression as branch value
// ===================================================================
describe('edge-formatting: equality with empty string literal', () => {
  ruleTester.run('equality-empty-string', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ val }) {
            return <T>{val === "" ? "empty" : "has-value"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ val }) {
            return <T><Branch branch={val === ""} true="empty">has-value</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 60. Ternary with JSX element alternate containing only text
// ===================================================================
describe('edge-formatting: JSX element alternate as children', () => {
  ruleTester.run('jsx-alternate-children', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function C({ cond }) {
            return <T>{cond ? "plain" : <em>italic</em>}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function C({ cond }) {
            return <T><Branch branch={cond} true="plain"><em>italic</em></Branch></T>;
          }
        `,
      },
    ],
  });
});
