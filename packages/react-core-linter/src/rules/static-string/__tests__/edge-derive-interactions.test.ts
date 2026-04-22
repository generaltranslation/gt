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
// 1. Standalone derive(): derive wraps a dynamic value, treated as valid
// ===================================================================

describe('derive interactions: standalone derive() is valid', () => {
  ruleTester.run('derive-standalone', staticString, {
    valid: [
      {
        code: `
          import { useGT, derive } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt(derive(getValue()));
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// 2. Standalone declareStatic(): deprecated alias for derive, still valid
// ===================================================================

describe('derive interactions: standalone declareStatic() is valid (deprecated alias)', () => {
  ruleTester.run('declareStatic-standalone', staticString, {
    valid: [
      {
        code: `
          import { useGT, declareStatic } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt(declareStatic(getValue()));
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// 3. Static + derive: static string concatenated with derive is valid
// ===================================================================

describe('derive interactions: static + derive is valid', () => {
  ruleTester.run('static-plus-derive', staticString, {
    valid: [
      {
        code: `
          import { useGT, derive } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello " + derive(x));
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// 4. derive + static: derive on the left, static on the right
// ===================================================================

describe('derive interactions: derive + static is valid', () => {
  ruleTester.run('derive-plus-static', staticString, {
    valid: [
      {
        code: `
          import { useGT, derive } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt(derive(x) + " world");
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// 5. Multiple derives: derive + static + derive is valid
// ===================================================================

describe('derive interactions: multiple derives separated by static text', () => {
  ruleTester.run('multi-derive', staticString, {
    valid: [
      {
        code: `
          import { useGT, derive } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt(derive(a) + " " + derive(b));
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// 6. derive + derive (no static between): two derives concatenated directly
// ===================================================================

describe('derive interactions: derive + derive with no static is valid', () => {
  ruleTester.run('derive-plus-derive', staticString, {
    valid: [
      {
        code: `
          import { useGT, derive } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt(derive(a) + derive(b));
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// 7. Static + derive + static: derive sandwiched between static strings
// ===================================================================

describe('derive interactions: static + derive + static is valid', () => {
  ruleTester.run('static-derive-static', staticString, {
    valid: [
      {
        code: `
          import { useGT, derive } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello " + derive(x) + "!");
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// 8. derive + dynamic: derive blocks ICU auto-fix, reports staticStringRequired
// ===================================================================

describe('derive interactions: derive + dynamic = error with no fix (staticStringRequired)', () => {
  ruleTester.run('derive-plus-dynamic', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT, derive } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt(derive(x) + " " + name);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'staticStringRequired' }],
        // No output — derive presence disables ICU auto-fix
      },
    ],
  });
});

// ===================================================================
// 9. Static + derive + dynamic: same as above but with leading static text
// ===================================================================

describe('derive interactions: static + derive + dynamic = error with no fix', () => {
  ruleTester.run('static-derive-dynamic', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT, derive } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello " + derive(x) + " " + name);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'staticStringRequired' }],
      },
    ],
  });
});

// ===================================================================
// 10. dynamic + derive: dynamic before derive, still no auto-fix
// ===================================================================

describe('derive interactions: dynamic + derive = error with no fix', () => {
  ruleTester.run('dynamic-plus-derive', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT, derive } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt(name + " " + derive(x));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'staticStringRequired' }],
      },
    ],
  });
});

// ===================================================================
// 11. derive() from wrong library: not recognized, treated as dynamic,
//     gets ICU auto-fix since there's no GT derive to block it
// ===================================================================

describe('derive interactions: derive from non-GT lib is treated as dynamic (gets ICU fix)', () => {
  ruleTester.run('derive-wrong-lib', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          import { derive } from 'other-lib';
          function Component() {
            const gt = useGT();
            return gt("val: " + derive(x));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          import { derive } from 'other-lib';
          function Component() {
            const gt = useGT();
            return gt("val: {var0}", { var0: derive(x) });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 12. derive in template literal: template with derive expression is valid
//     (static + derive parts, no dynamic, so isFixable is false and
//      there are no dynamic parts to trigger an error)
// ===================================================================

describe('derive interactions: derive in template literal is valid', () => {
  ruleTester.run('derive-template', staticString, {
    valid: [
      {
        code: `
          import { useGT, derive } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt(\`Hello \${derive(x)}!\`);
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// 13. derive + dynamic in template literal: derive blocks auto-fix,
//     reports staticStringRequired with no fix
// ===================================================================

describe('derive interactions: derive + dynamic in template literal = error with no fix', () => {
  ruleTester.run('derive-dynamic-template', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT, derive } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt(\`\${derive(x)} \${name}\`);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'staticStringRequired' }],
      },
    ],
  });
});

// ===================================================================
// 14. Aliased derive import: derive renamed via import alias is still
//     recognized because isGTFunction resolves the original import name
// ===================================================================

describe('derive interactions: aliased derive import is still recognized as valid', () => {
  ruleTester.run('derive-aliased', staticString, {
    valid: [
      {
        code: `
          import { useGT, derive as deriveValue } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello " + deriveValue(x));
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// 15. msg() with derive in content: derive is valid for msg() too
// ===================================================================

describe('derive interactions: msg() with derive in content is valid', () => {
  ruleTester.run('msg-derive', staticString, {
    valid: [
      {
        code: `
          import { msg, derive } from 'gt-react';
          const greeting = msg("Hello " + derive(x));
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});
