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
// 1. Branch import added when only T is imported
// ===================================================================

describe('edge-imports: Branch added when only T is imported', () => {
  ruleTester.run('branch-add-with-only-T', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond }) {
            return <T>{cond ? "yes" : "no"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ cond }) {
            return <T><Branch branch={cond} true="yes">no</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 2. Branch import added when T and other components are imported
// ===================================================================

describe('edge-imports: Branch added alongside T, Num, Currency', () => {
  ruleTester.run('branch-add-with-multiple-specifiers', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T, Num, Currency } from 'gt-react';
          function Component({ cond }) {
            return <T>{cond ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Num, Currency, Branch } from 'gt-react';
          function Component({ cond }) {
            return <T><Branch branch={cond} true="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 3. Branch already imported — no duplicate
// ===================================================================

describe('edge-imports: Branch already imported, no duplicate added', () => {
  ruleTester.run('branch-no-duplicate', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T, Branch } from 'gt-react';
          function Component({ cond }) {
            return <T>{cond ? "yes" : "no"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ cond }) {
            return <T><Branch branch={cond} true="yes">no</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 4. Branch imported with alias — use alias
// ===================================================================

describe('edge-imports: Branch imported as alias B, fix uses B', () => {
  ruleTester.run('branch-alias-used', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T, Branch as B } from 'gt-react';
          function Component({ cond }) {
            return <T>{cond ? "yes" : "no"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch as B } from 'gt-react';
          function Component({ cond }) {
            return <T><B branch={cond} true="yes">no</B></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 5. Var import added for non-ternary dynamic content
// ===================================================================

describe('edge-imports: Var added when only T is imported (identifier)', () => {
  ruleTester.run('var-add-for-identifier', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ name }) {
            return <T>{name}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-react';
          function Component({ name }) {
            return <T><Var>{name}</Var></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 6. Var already imported — no duplicate
// ===================================================================

describe('edge-imports: Var already imported, no duplicate added', () => {
  ruleTester.run('var-no-duplicate', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T, Var } from 'gt-react';
          function Component({ name }) {
            return <T>{name}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-react';
          function Component({ name }) {
            return <T><Var>{name}</Var></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 7. Var imported with alias — use alias
// ===================================================================

describe('edge-imports: Var imported as alias V, fix uses V', () => {
  ruleTester.run('var-alias-used', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T, Var as V } from 'gt-react';
          function Component({ name }) {
            return <T>{name}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var as V } from 'gt-react';
          function Component({ name }) {
            return <T><V>{name}</V></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 8. Both Branch and Var needed in same file (multi-pass)
//    First pass: wraps dynamic identifier in Var (adds Var import)
//    Second pass: wraps ternary in Branch (adds Branch import)
// ===================================================================

describe('edge-imports: both Branch and Var needed in same file (multi-pass)', () => {
  ruleTester.run('both-branch-and-var-multi-pass', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ cond, name }) {
            return <T>{cond ? "hello" : "bye"}{name}</T>;
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
          function Component({ cond, name }) {
            return <T><Branch branch={cond} true="hello">bye</Branch>{name}</T>;
          }
        `,
          `
          import { T, Branch, Var } from 'gt-react';
          function Component({ cond, name }) {
            return <T><Branch branch={cond} true="hello">bye</Branch><Var>{name}</Var></T>;
          }
        `,
        ],
      },
    ],
  });
});

// ===================================================================
// 9. Import from gt-next
// ===================================================================

describe('edge-imports: Branch import added from gt-next', () => {
  ruleTester.run('branch-from-gt-next', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-next';
          function Component({ cond }) {
            return <T>{cond ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-next'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-next';
          function Component({ cond }) {
            return <T><Branch branch={cond} true="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 10. Import from @generaltranslation/react-core
// ===================================================================

describe('edge-imports: Branch import added from @generaltranslation/react-core', () => {
  ruleTester.run('branch-from-react-core', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from '@generaltranslation/react-core';
          function Component({ cond }) {
            return <T>{cond ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['@generaltranslation/react-core'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from '@generaltranslation/react-core';
          function Component({ cond }) {
            return <T><Branch branch={cond} true="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 11. Import from gt-react-native
// ===================================================================

describe('edge-imports: Branch import added from gt-react-native', () => {
  ruleTester.run('branch-from-gt-react-native', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react-native';
          function Component({ cond }) {
            return <T>{cond ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react-native'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react-native';
          function Component({ cond }) {
            return <T><Branch branch={cond} true="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 12. Multiple GT imports from different libs — adds to first GT import
// ===================================================================

describe('edge-imports: multiple GT imports, Branch added to first GT import', () => {
  ruleTester.run('branch-added-to-first-gt-import', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          import { Var } from 'gt-next';
          function Component({ cond }) {
            return <T>{cond ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react', 'gt-next'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          import { Var } from 'gt-next';
          function Component({ cond }) {
            return <T><Branch branch={cond} true="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 13. T imported with alias — <Trans> triggers rule and fix
// ===================================================================

describe('edge-imports: T aliased as Trans, fix works with <Trans>', () => {
  ruleTester.run('t-alias-ternary', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T as Trans } from 'gt-react';
          function Component({ cond }) {
            return <Trans>{cond ? "a" : "b"}</Trans>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T as Trans, Branch } from 'gt-react';
          function Component({ cond }) {
            return <Trans><Branch branch={cond} true="a">b</Branch></Trans>;
          }
        `,
      },
    ],
  });
});

describe('edge-imports: T aliased as Trans, Var fix works with <Trans>', () => {
  ruleTester.run('t-alias-var', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T as Trans } from 'gt-react';
          function Component({ name }) {
            return <Trans>{name}</Trans>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T as Trans, Var } from 'gt-react';
          function Component({ name }) {
            return <Trans><Var>{name}</Var></Trans>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 14. Branch imported from different GT import than T — uses existing
// ===================================================================

describe('edge-imports: Branch in separate GT import, no duplicate added', () => {
  ruleTester.run('branch-in-separate-import', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          import { Branch } from 'gt-react';
          function Component({ cond }) {
            return <T>{cond ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T } from 'gt-react';
          import { Branch } from 'gt-react';
          function Component({ cond }) {
            return <T><Branch branch={cond} true="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

describe('edge-imports: Var in separate GT import from different lib, no duplicate added', () => {
  ruleTester.run('var-in-separate-lib-import', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          import { Var } from 'gt-next';
          function Component({ name }) {
            return <T>{name}</T>;
          }
        `,
        options: [{ libs: ['gt-react', 'gt-next'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T } from 'gt-react';
          import { Var } from 'gt-next';
          function Component({ name }) {
            return <T><Var>{name}</Var></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 15. Only default import from GT — no named specifiers to append to
//     The fixer finds no named specifiers, so it does not add an import
//     but still uses the canonical component name in the JSX.
//     NOTE: This case does not actually trigger the rule because the
//     default import is not recognized as T. So this is a valid case
//     (no error produced).
// ===================================================================

describe('edge-imports: default import from GT does not trigger rule', () => {
  ruleTester.run('default-import-no-trigger', staticJsx, {
    valid: [
      {
        code: `
          import GT from 'gt-react';
          function Component({ name }) {
            return <GT>{name}</GT>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// 16. GT import with type specifiers mixed in
//     type specifiers are ImportSpecifier nodes but with importKind === 'type'.
//     The fixer filters for ImportSpecifier, so type specifiers count.
//     The new import is appended after the last named specifier.
// ===================================================================

describe('edge-imports: GT import with type specifier, Branch added after last specifier', () => {
  ruleTester.run('type-specifier-mixed-branch', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T, type SomeType } from 'gt-react';
          function Component({ cond }) {
            return <T>{cond ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, type SomeType, Branch } from 'gt-react';
          function Component({ cond }) {
            return <T><Branch branch={cond} true="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

describe('edge-imports: GT import with type specifier, Var added after last specifier', () => {
  ruleTester.run('type-specifier-mixed-var', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T, type SomeType } from 'gt-react';
          function Component({ name }) {
            return <T>{name}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, type SomeType, Var } from 'gt-react';
          function Component({ name }) {
            return <T><Var>{name}</Var></T>;
          }
        `,
      },
    ],
  });
});

// ===================================================================
// Additional edge cases
// ===================================================================

// Var added alongside existing Branch import (reverse of test 3)
describe('edge-imports: Var added when Branch already imported', () => {
  ruleTester.run('var-added-alongside-branch', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T, Branch } from 'gt-react';
          function Component({ name }) {
            return <T>{name}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch, Var } from 'gt-react';
          function Component({ name }) {
            return <T><Var>{name}</Var></T>;
          }
        `,
      },
    ],
  });
});

// Branch with alias in a different GT import, should use alias
describe('edge-imports: Branch aliased in second GT import, uses alias', () => {
  ruleTester.run('branch-alias-second-import', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          import { Branch as Condition } from 'gt-react';
          function Component({ cond }) {
            return <T>{cond ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T } from 'gt-react';
          import { Branch as Condition } from 'gt-react';
          function Component({ cond }) {
            return <T><Condition branch={cond} true="a">b</Condition></T>;
          }
        `,
      },
    ],
  });
});

// Var with alias in a different GT import, should use alias
describe('edge-imports: Var aliased in second GT import, uses alias', () => {
  ruleTester.run('var-alias-second-import', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          import { Var as Variable } from 'gt-next';
          function Component({ name }) {
            return <T>{name}</T>;
          }
        `,
        options: [{ libs: ['gt-react', 'gt-next'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T } from 'gt-react';
          import { Var as Variable } from 'gt-next';
          function Component({ name }) {
            return <T><Variable>{name}</Variable></T>;
          }
        `,
      },
    ],
  });
});

// Non-GT import interspersed — should not affect GT import detection
describe('edge-imports: non-GT imports between GT imports', () => {
  ruleTester.run('non-gt-imports-interspersed', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import React from 'react';
          import { T } from 'gt-react';
          import { useState } from 'react';
          function Component({ cond }) {
            return <T>{cond ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import React from 'react';
          import { T, Branch } from 'gt-react';
          import { useState } from 'react';
          function Component({ cond }) {
            return <T><Branch branch={cond} true="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// Logical AND also triggers Branch import
describe('edge-imports: logical AND triggers Branch import', () => {
  ruleTester.run('logical-and-branch-import', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ active }) {
            return <T>{active && "Active"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ active }) {
            return <T><Branch branch={!!active} true="Active" /></T>;
          }
        `,
      },
    ],
  });
});

// Logical AND with Branch already imported
describe('edge-imports: logical AND with Branch already imported', () => {
  ruleTester.run('logical-and-branch-no-duplicate', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T, Branch } from 'gt-react';
          function Component({ active }) {
            return <T>{active && "Active"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react';
          function Component({ active }) {
            return <T><Branch branch={!!active} true="Active" /></T>;
          }
        `,
      },
    ],
  });
});

// Logical AND with Branch aliased
describe('edge-imports: logical AND with Branch aliased', () => {
  ruleTester.run('logical-and-branch-alias', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T, Branch as If } from 'gt-react';
          function Component({ active }) {
            return <T>{active && "Active"}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch as If } from 'gt-react';
          function Component({ active }) {
            return <T><If branch={!!active} true="Active" /></T>;
          }
        `,
      },
    ],
  });
});

// Multiple errors of same type — import should only be added once
describe('edge-imports: two Var-needing expressions, import added only once', () => {
  ruleTester.run('multiple-var-errors-single-import', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ first, last }) {
            return <T>{first}{last}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [
          { messageId: 'dynamicContent' },
          { messageId: 'dynamicContent' },
        ],
        output: [
          `
          import { T, Var } from 'gt-react';
          function Component({ first, last }) {
            return <T><Var>{first}</Var>{last}</T>;
          }
        `,
          `
          import { T, Var } from 'gt-react';
          function Component({ first, last }) {
            return <T><Var>{first}</Var><Var>{last}</Var></T>;
          }
        `,
        ],
      },
    ],
  });
});

// Multiple ternary errors — Branch import added only once
describe('edge-imports: two ternary expressions, Branch added only once', () => {
  ruleTester.run('multiple-branch-errors-single-import', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ a, b }) {
            return <T>{a ? "x" : "y"}{b ? "m" : "n"}</T>;
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
          function Component({ a, b }) {
            return <T><Branch branch={a} true="x">y</Branch>{b ? "m" : "n"}</T>;
          }
        `,
          `
          import { T, Branch } from 'gt-react';
          function Component({ a, b }) {
            return <T><Branch branch={a} true="x">y</Branch><Branch branch={b} true="m">n</Branch></T>;
          }
        `,
        ],
      },
    ],
  });
});

// Var from gt-next (not just gt-react)
describe('edge-imports: Var import added from gt-next', () => {
  ruleTester.run('var-from-gt-next', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-next';
          function Component({ name }) {
            return <T>{name}</T>;
          }
        `,
        options: [{ libs: ['gt-next'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-next';
          function Component({ name }) {
            return <T><Var>{name}</Var></T>;
          }
        `,
      },
    ],
  });
});

// Var from gt-react-native
describe('edge-imports: Var import added from gt-react-native', () => {
  ruleTester.run('var-from-gt-react-native', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react-native';
          function Component({ name }) {
            return <T>{name}</T>;
          }
        `,
        options: [{ libs: ['gt-react-native'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-react-native';
          function Component({ name }) {
            return <T><Var>{name}</Var></T>;
          }
        `,
      },
    ],
  });
});

// Var from @generaltranslation/react-core
describe('edge-imports: Var import added from @generaltranslation/react-core', () => {
  ruleTester.run('var-from-react-core', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from '@generaltranslation/react-core';
          function Component({ name }) {
            return <T>{name}</T>;
          }
        `,
        options: [{ libs: ['@generaltranslation/react-core'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from '@generaltranslation/react-core';
          function Component({ name }) {
            return <T><Var>{name}</Var></T>;
          }
        `,
      },
    ],
  });
});

// Branch from gt-react-native
describe('edge-imports: Branch import from gt-react-native with logical AND', () => {
  ruleTester.run('branch-from-gt-react-native-logical', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react-native';
          function Component({ active }) {
            return <T>{active && "Yes"}</T>;
          }
        `,
        options: [{ libs: ['gt-react-native'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-react-native';
          function Component({ active }) {
            return <T><Branch branch={!!active} true="Yes" /></T>;
          }
        `,
      },
    ],
  });
});

// T and Branch both aliased
describe('edge-imports: T aliased and Branch aliased, both used', () => {
  ruleTester.run('both-t-and-branch-aliased', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T as Translate, Branch as If } from 'gt-react';
          function Component({ cond }) {
            return <Translate>{cond ? "yes" : "no"}</Translate>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T as Translate, Branch as If } from 'gt-react';
          function Component({ cond }) {
            return <Translate><If branch={cond} true="yes">no</If></Translate>;
          }
        `,
      },
    ],
  });
});

// T and Var both aliased
describe('edge-imports: T aliased and Var aliased, both used', () => {
  ruleTester.run('both-t-and-var-aliased', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T as Translate, Var as Variable } from 'gt-react';
          function Component({ name }) {
            return <Translate>{name}</Translate>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T as Translate, Var as Variable } from 'gt-react';
          function Component({ name }) {
            return <Translate><Variable>{name}</Variable></Translate>;
          }
        `,
      },
    ],
  });
});

// Non-GT library import should not be used for adding imports
describe('edge-imports: non-GT library with T component is not treated as GT', () => {
  ruleTester.run('non-gt-lib-ignored', staticJsx, {
    valid: [
      {
        code: `
          import { T } from 'some-other-lib';
          function Component({ name }) {
            return <T>{name}</T>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// Multiple named specifiers with aliases — appends after last
describe('edge-imports: import with multiple aliases, Branch appended after last', () => {
  ruleTester.run('multiple-aliases-branch-appended', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T as Translate, Num as Number } from 'gt-react';
          function Component({ cond }) {
            return <Translate>{cond ? "a" : "b"}</Translate>;
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T as Translate, Num as Number, Branch } from 'gt-react';
          function Component({ cond }) {
            return <Translate><Branch branch={cond} true="a">b</Branch></Translate>;
          }
        `,
      },
    ],
  });
});

// Import with gt-i18n library
describe('edge-imports: Var import added from gt-i18n', () => {
  ruleTester.run('var-from-gt-i18n', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-i18n';
          function Component({ name }) {
            return <T>{name}</T>;
          }
        `,
        options: [{ libs: ['gt-i18n'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-i18n';
          function Component({ name }) {
            return <T><Var>{name}</Var></T>;
          }
        `,
      },
    ],
  });
});

// Branch import from gt-i18n
describe('edge-imports: Branch import added from gt-i18n', () => {
  ruleTester.run('branch-from-gt-i18n', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-i18n';
          function Component({ cond }) {
            return <T>{cond ? "a" : "b"}</T>;
          }
        `,
        options: [{ libs: ['gt-i18n'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-i18n';
          function Component({ cond }) {
            return <T><Branch branch={cond} true="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});

// Multiple GT libraries in options with import from second lib
describe('edge-imports: multiple libs in options, import found in second lib', () => {
  ruleTester.run('import-from-second-lib-in-options', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-next';
          function Component({ name }) {
            return <T>{name}</T>;
          }
        `,
        options: [{ libs: ['gt-react', 'gt-next'] }],
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-next';
          function Component({ name }) {
            return <T><Var>{name}</Var></T>;
          }
        `,
      },
    ],
  });
});

// Default libs option (no explicit libs) — uses GT_LIBRARIES default
describe('edge-imports: default libs option, Var added from gt-react', () => {
  ruleTester.run('default-libs-var', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-react';
          function Component({ name }) {
            return <T>{name}</T>;
          }
        `,
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Var } from 'gt-react';
          function Component({ name }) {
            return <T><Var>{name}</Var></T>;
          }
        `,
      },
    ],
  });
});

// Default libs option with Branch
describe('edge-imports: default libs option, Branch added from gt-next', () => {
  ruleTester.run('default-libs-branch', staticJsx, {
    valid: [],
    invalid: [
      {
        code: `
          import { T } from 'gt-next';
          function Component({ cond }) {
            return <T>{cond ? "a" : "b"}</T>;
          }
        `,
        errors: [{ messageId: 'dynamicContent' }],
        output: `
          import { T, Branch } from 'gt-next';
          function Component({ cond }) {
            return <T><Branch branch={cond} true="a">b</Branch></T>;
          }
        `,
      },
    ],
  });
});
