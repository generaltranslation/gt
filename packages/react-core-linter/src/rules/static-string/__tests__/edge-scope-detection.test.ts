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
// 1. gt from wrong library is ignored
//    useGT imported from a non-GT library should not trigger the rule
// ===================================================================

describe('scope: gt from wrong library is ignored', () => {
  ruleTester.run('wrong-lib-gt', staticString, {
    valid: [
      {
        code: `
          import { useGT } from 'some-other-lib';
          function Component() {
            const gt = useGT();
            return gt("hi" + name);
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// 2. msg from wrong library is ignored
//    msg imported from a non-GT library should not trigger the rule
// ===================================================================

describe('scope: msg from wrong library is ignored', () => {
  ruleTester.run('wrong-lib-msg', staticString, {
    valid: [
      {
        code: `
          import { msg } from 'not-gt-react';
          const x = msg("hi" + name);
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// 3. Multiple GT imports — gt from one lib, msg from another
//    Both should be detected when both libs are in the options
// ===================================================================

describe('scope: multiple GT imports from different libs are both checked', () => {
  ruleTester.run('multi-lib-gt-msg', staticString, {
    valid: [],
    invalid: [
      {
        // gt from gt-react, msg from gt-next — both should error
        code: `
          import { useGT } from 'gt-react';
          import { msg } from 'gt-next';
          function Component() {
            const gt = useGT();
            const a = gt("hi" + name);
            const b = msg("bye" + name);
          }
        `,
        options: [{ libs: ['gt-react', 'gt-next'] }],
        errors: [
          { messageId: 'variableInterpolationRequired' },
          { messageId: 'variableInterpolationRequired' },
        ],
        output: `
          import { useGT } from 'gt-react';
          import { msg } from 'gt-next';
          function Component() {
            const gt = useGT();
            const a = gt("hi{var0}", { var0: name });
            const b = msg("bye{var0}", { var0: name });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 4. Non-GT function named `gt` (locally defined, not from a GT import)
//    Should be ignored since isGTCallbackFunction checks for useGT/getGT init
// ===================================================================

describe('scope: locally defined function named gt is ignored', () => {
  ruleTester.run('local-gt-function', staticString, {
    valid: [
      {
        code: `
          function gt(s) { return s; }
          gt("hi" + name);
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// 5. Non-GT function named `msg` (locally defined arrow function)
//    Should be ignored since isMsgFunction requires an ImportBinding
// ===================================================================

describe('scope: locally defined arrow function named msg is ignored', () => {
  ruleTester.run('local-msg-arrow', staticString, {
    valid: [
      {
        code: `
          const msg = (s) => s;
          msg("hi" + name);
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// 6. useGT() result assigned to a non-standard name
//    isGTCallbackFunction traces the variable init, so any name works
// ===================================================================

describe('scope: useGT result assigned to non-standard variable name is still detected', () => {
  ruleTester.run('useGT-renamed-var', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const notGt = useGT();
            return notGt("hi" + name);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const notGt = useGT();
            return notGt("hi{var0}", { var0: name });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 7. useGT() result named `translate` with template literal
//    Variable name does not matter — dynamic template should be caught
// ===================================================================

describe('scope: useGT result named translate with template literal is detected', () => {
  ruleTester.run('useGT-translate-template', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const translate = useGT();
            return translate(\`hi \${name}\`);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const translate = useGT();
            return translate("hi {var0}", { var0: name });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 8. gt() called with no arguments
//    Should be silently ignored (early return at node.arguments.length === 0)
// ===================================================================

describe('scope: gt called with no arguments is valid', () => {
  ruleTester.run('gt-no-args', staticString, {
    valid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt();
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// 9. gt() with only spread argument
//    SpreadElement as first argument should report an error (no auto-fix)
// ===================================================================

describe('scope: gt with spread argument reports error', () => {
  ruleTester.run('gt-spread-arg', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt(...args);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
      },
    ],
  });
});

// ===================================================================
// 10. Multiple gt() calls in same component — both with dynamic content
//     Each call should independently produce an error
// ===================================================================

describe('scope: multiple gt calls in same component both report errors', () => {
  ruleTester.run('multi-gt-calls', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            const a = gt("hello " + name);
            const b = gt(\`bye \${name}\`);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [
          { messageId: 'variableInterpolationRequired' },
          { messageId: 'variableInterpolationRequired' },
        ],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            const a = gt("hello {var0}", { var0: name });
            const b = gt("bye {var0}", { var0: name });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 11. Nested component scopes — each has its own useGT
//     Both inner and outer gt calls should be independently detected
// ===================================================================

describe('scope: nested components with independent useGT scopes', () => {
  ruleTester.run('nested-scopes', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Outer() {
            const gt = useGT();
            const outerText = gt("outer " + outerName);
            function Inner() {
              const gt = useGT();
              const innerText = gt("inner " + innerName);
            }
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [
          { messageId: 'variableInterpolationRequired' },
          { messageId: 'variableInterpolationRequired' },
        ],
        output: `
          import { useGT } from 'gt-react';
          function Outer() {
            const gt = useGT();
            const outerText = gt("outer {var0}", { var0: outerName });
            function Inner() {
              const gt = useGT();
              const innerText = gt("inner {var0}", { var0: innerName });
            }
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 12. gt-next with getGT (await pattern)
//     `const gt = await getGT()` should be detected when gt-next is in libs
// ===================================================================

describe('scope: gt-next getGT with await is detected', () => {
  ruleTester.run('getGT-await', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { getGT } from 'gt-next';
          async function ServerComponent() {
            const gt = await getGT();
            return gt("hi" + name);
          }
        `,
        options: [{ libs: ['gt-next'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { getGT } from 'gt-next';
          async function ServerComponent() {
            const gt = await getGT();
            return gt("hi{var0}", { var0: name });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 13. gt-next getGT WITHOUT await
//     `const gt = getGT()` (no await) is still detected by the rule.
//     isGTCallbackFunction Case 1 matches any direct CallExpression of
//     useGT/getGT, so it does not distinguish awaited vs non-awaited
//     getGT calls. This is arguably a minor implementation quirk — at
//     runtime getGT() returns a Promise, not the function — but the
//     linter still flags it.
// ===================================================================

describe('scope: gt-next getGT without await is still detected (implementation does not distinguish)', () => {
  ruleTester.run('getGT-no-await', staticString, {
    valid: [],
    invalid: [
      {
        // getGT() without await — isGTCallbackFunction Case 1 still matches
        // because getGT is in GT_CALLBACK_DECLARATOR_FUNCTION_NAMES and the
        // init is a direct CallExpression
        code: `
          import { getGT } from 'gt-next';
          async function ServerComponent() {
            const gt = getGT();
            return gt("hi" + name);
          }
        `,
        options: [{ libs: ['gt-next'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { getGT } from 'gt-next';
          async function ServerComponent() {
            const gt = getGT();
            return gt("hi{var0}", { var0: name });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 14. msg() at module scope (not inside a function)
//     msg is detected via direct import, not via useGT — module-level is fine
// ===================================================================

describe('scope: msg at module scope is detected', () => {
  ruleTester.run('msg-module-scope', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { msg } from 'gt-react';
          const x = msg("hi" + name);
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { msg } from 'gt-react';
          const x = msg("hi{var0}", { var0: name });
        `,
      },
    ],
  });
});

// ===================================================================
// 15. gt-react-native library support
//     useGT from gt-react-native should be detected when that lib is in options
// ===================================================================

describe('scope: gt-react-native useGT is detected with correct libs', () => {
  ruleTester.run('react-native-lib', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react-native';
          function Component() {
            const gt = useGT();
            return gt("hi" + name);
          }
        `,
        options: [{ libs: ['gt-react-native'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react-native';
          function Component() {
            const gt = useGT();
            return gt("hi{var0}", { var0: name });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 16. Aliased msg import
//     `import { msg as register }` — isMsgFunction resolves the original
//     import name, so it should still be detected
// ===================================================================

describe('scope: aliased msg import is detected', () => {
  ruleTester.run('aliased-msg', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { msg as register } from 'gt-react';
          const x = register("hi" + name);
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { msg as register } from 'gt-react';
          const x = register("hi{var0}", { var0: name });
        `,
      },
    ],
  });
});
