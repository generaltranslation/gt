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
// 1. Variable interpolation: concatenation → ICU {varN}
// ===================================================================

// gt("Hello " + name + "!")
// → gt("Hello {var0}!", { var0: name })
describe('static-string: concatenation with dynamic value → ICU variable', () => {
  ruleTester.run('concat-single-var', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello " + name + "!");
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello {var0}!", { var0: name });
          }
        `,
      },
    ],
  });
});

// gt("My number is " + Math.random())
// → gt("My number is {var0}", { var0: Math.random() })
describe('static-string: concatenation with function call → ICU variable', () => {
  ruleTester.run('concat-func-call', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("My number is " + Math.random());
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("My number is {var0}", { var0: Math.random() });
          }
        `,
      },
    ],
  });
});

// gt(firstName + " " + lastName)
// → gt("{var0} {var1}", { var0: firstName, var1: lastName })
describe('static-string: concatenation with multiple dynamic values → multiple ICU variables', () => {
  ruleTester.run('concat-multi-var', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt(firstName + " " + lastName);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("{var0} {var1}", { var0: firstName, var1: lastName });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 2. Variable interpolation: template literal → ICU {varN}
// ===================================================================

// gt(`Hello ${name}!`)
// → gt("Hello {var0}!", { var0: name })
describe('static-string: template literal with single expression → ICU variable', () => {
  ruleTester.run('template-single-var', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt(\`Hello \${name}!\`);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello {var0}!", { var0: name });
          }
        `,
      },
    ],
  });
});

// gt(`${name} is ${age} years old`)
// → gt("{var0} is {var1} years old", { var0: name, var1: age })
describe('static-string: template literal with multiple expressions → multiple ICU variables', () => {
  ruleTester.run('template-multi-var', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt(\`\${name} is \${age} years old\`);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("{var0} is {var1} years old", { var0: name, var1: age });
          }
        `,
      },
    ],
  });
});

// gt(`My number is ${Math.random()}`)
// → gt("My number is {var0}", { var0: Math.random() })
describe('static-string: template literal with function call expression → ICU variable', () => {
  ruleTester.run('template-func-call', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt(\`My number is \${Math.random()}\`);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("My number is {var0}", { var0: Math.random() });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 3. Ternary → ICU select: concatenation
// ===================================================================

// gt("My name is " + (cond ? "Ernest" : "Brian"))
// → gt("My name is {var0, select, true {Ernest} other {Brian}}", { var0: cond })
describe('static-string: ternary in concatenation → ICU select', () => {
  ruleTester.run('concat-ternary-select', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("My name is " + (cond ? "Ernest" : "Brian"));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("My name is {var0, select, true {Ernest} other {Brian}}", { var0: cond });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 4. Ternary → ICU select: template literal
// ===================================================================

// gt(`Status: ${cond ? "active" : "inactive"}`)
// → gt("Status: {var0, select, true {active} other {inactive}}", { var0: cond })
describe('static-string: ternary in template literal → ICU select', () => {
  ruleTester.run('template-ternary-select', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt(\`Status: \${cond ? "active" : "inactive"}\`);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Status: {var0, select, true {active} other {inactive}}", { var0: cond });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 5. msg() function support (same behavior as gt())
// ===================================================================

// msg("Hello " + name + "!")
// → msg("Hello {var0}!", { var0: name })
describe('static-string: msg() concatenation with dynamic value → ICU variable', () => {
  ruleTester.run('msg-concat-var', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { msg } from 'gt-react';
          const greeting = msg("Hello " + name + "!");
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { msg } from 'gt-react';
          const greeting = msg("Hello {var0}!", { var0: name });
        `,
      },
    ],
  });
});

// msg(`Hello ${name}!`)
// → msg("Hello {var0}!", { var0: name })
describe('static-string: msg() template literal → ICU variable', () => {
  ruleTester.run('msg-template-var', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { msg } from 'gt-react';
          const greeting = msg(\`Hello \${name}!\`);
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { msg } from 'gt-react';
          const greeting = msg("Hello {var0}!", { var0: name });
        `,
      },
    ],
  });
});

// msg(`Status: ${active ? "on" : "off"}`)
// → msg("Status: {var0, select, true {on} other {off}}", { var0: active })
describe('static-string: msg() ternary in template literal → ICU select', () => {
  ruleTester.run('msg-template-ternary', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { msg } from 'gt-react';
          const label = msg(\`Status: \${active ? "on" : "off"}\`);
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { msg } from 'gt-react';
          const label = msg("Status: {var0, select, true {on} other {off}}", { var0: active });
        `,
      },
    ],
  });
});

// ===================================================================
// 6. Mixed: variables + ternaries in same expression
// ===================================================================

// gt("Hello " + name + ", you are " + (isAdmin ? "admin" : "user"))
// → gt("Hello {var0}, you are {var1, select, true {admin} other {user}}", { var0: name, var1: isAdmin })
describe('static-string: mixed dynamic + ternary in concatenation', () => {
  ruleTester.run('concat-mixed', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello " + name + ", you are " + (isAdmin ? "admin" : "user"));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello {var0}, you are {var1, select, true {admin} other {user}}", { var0: name, var1: isAdmin });
          }
        `,
      },
    ],
  });
});

// gt(`Hello ${name}, you are ${isAdmin ? "admin" : "user"}`)
// → gt("Hello {var0}, you are {var1, select, true {admin} other {user}}", { var0: name, var1: isAdmin })
describe('static-string: mixed dynamic + ternary in template literal', () => {
  ruleTester.run('template-mixed', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt(\`Hello \${name}, you are \${isAdmin ? "admin" : "user"}\`);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello {var0}, you are {var1, select, true {admin} other {user}}", { var0: name, var1: isAdmin });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 7. await getGT() pattern (gt-next server components)
// ===================================================================

// gt("Hello " + name)  [via await getGT()]
// → gt("Hello {var0}", { var0: name })
describe('static-string: await getGT() concatenation → ICU variable', () => {
  ruleTester.run('getgt-concat-var', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { getGT } from 'gt-next';
          async function ServerComponent() {
            const gt = await getGT();
            return gt("Hello " + name);
          }
        `,
        options: [{ libs: ['gt-next'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { getGT } from 'gt-next';
          async function ServerComponent() {
            const gt = await getGT();
            return gt("Hello {var0}", { var0: name });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 8. Existing valid cases MUST still pass (backward compatibility)
// ===================================================================

describe('static-string: existing valid patterns remain valid with new fix logic', () => {
  ruleTester.run('existing-valid-preserved', staticString, {
    valid: [
      // gt("Hello " + "world")  — static concat, no fix needed
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello " + "world");
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
      // gt("Hello " + derive(getValue()))  — derive() is allowed
      {
        code: `
          import { useGT, derive } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello " + derive(getValue()));
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
      // gt("Hello " + declareStatic(getValue()))  — declareStatic() is allowed
      {
        code: `
          import { useGT, declareStatic } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello " + declareStatic(getValue()));
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
      // msg(["Hello", "World"])  — array form is valid for msg()
      {
        code: `
          import { msg } from 'gt-react';
          const items = msg(["Hello", "World"]);
        `,
        options: [{ libs: ['gt-react'] }],
      },
      // non-GT function calls are ignored entirely
      {
        code: `
          function notGT() {
            return someOtherFunction("Hello " + name);
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
      // gt("Hello {name}!", { name: userName })  — already valid ICU
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello {name}!", { name: userName });
          }
        `,
        options: [{ libs: ['gt-react'] }],
      },
    ],
    invalid: [],
  });
});

// ===================================================================
// 9. Edge: dynamic value at start of concatenation
// ===================================================================

// gt(count + " items remaining")
// → gt("{var0} items remaining", { var0: count })
describe('static-string: dynamic value at start of concatenation', () => {
  ruleTester.run('concat-dynamic-start', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt(count + " items remaining");
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("{var0} items remaining", { var0: count });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 10. Edge: template literal with only expression (no static text)
// ===================================================================

// gt(`${greeting}`)
// → gt("{var0}", { var0: greeting })
describe('static-string: template literal with only expression', () => {
  ruleTester.run('template-only-expr', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt(\`\${greeting}\`);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("{var0}", { var0: greeting });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 11. Edge: equality ternary → select with named key
// ===================================================================

// gt("The user is a " + (gender === "male" ? "boy" : "girl"))
// → gt("The user is a {var0, select, male {boy} other {girl}}", { var0: gender })
describe('static-string: equality ternary in concatenation → ICU select with named key', () => {
  ruleTester.run('concat-equality-select', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("The user is a " + (gender === "male" ? "boy" : "girl"));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("The user is a {var0, select, male {boy} other {girl}}", { var0: gender });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 12. Edge: member expression interpolation
// ===================================================================

// gt(`Welcome, ${user.name}!`)
// → gt("Welcome, {var0}!", { var0: user.name })
describe('static-string: member expression in template literal → ICU variable', () => {
  ruleTester.run('template-member-expr', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt(\`Welcome, \${user.name}!\`);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Welcome, {var0}!", { var0: user.name });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 13. Edge: ternary with non-static branches → plain variable (not select)
// ===================================================================

// gt("Result: " + (cond ? getValue() : fallback))
// → gt("Result: {var0}", { var0: cond ? getValue() : fallback })
describe('static-string: ternary with non-static branches → plain ICU variable', () => {
  ruleTester.run('concat-ternary-dynamic-branches', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Result: " + (cond ? getValue() : fallback));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Result: {var0}", { var0: cond ? getValue() : fallback });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 14. $format option: auto-fix only applies for ICU format (the default)
// ===================================================================

// gt("Hello " + name, { $format: "ICU" })  — explicit ICU, auto-fix applies
// → gt("Hello {var0}", { $format: "ICU", var0: name })
describe('static-string: explicit $format "ICU" → auto-fix applies', () => {
  ruleTester.run('format-explicit-icu', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello " + name, { $format: "ICU" });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello {var0}", { $format: "ICU", var0: name });
          }
        `,
      },
    ],
  });
});

// gt("Hello " + name, { $format: "STRING" })  — non-ICU format, NO auto-fix, still error
describe('static-string: $format "STRING" → no auto-fix, still reports error', () => {
  ruleTester.run('format-string-no-fix', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello " + name, { $format: "STRING" });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'staticStringRequired' }],
      },
    ],
  });
});

// gt(`Hello ${name}!`, { $format: "STRING" })  — non-ICU template, NO auto-fix, still error
describe('static-string: $format "STRING" with template literal → no auto-fix, still reports error', () => {
  ruleTester.run('format-string-template-no-fix', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt(\`Hello \${name}!\`, { $format: "STRING" });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'staticStringRequired' }],
      },
    ],
  });
});

// gt("Hello " + name, { $format: "I18NEXT" })  — non-ICU format, NO auto-fix, still error
describe('static-string: $format "I18NEXT" → no auto-fix, still reports error', () => {
  ruleTester.run('format-i18next-no-fix', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello " + name, { $format: "I18NEXT" });
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'staticStringRequired' }],
      },
    ],
  });
});

// msg("Hello " + name, { $format: "STRING" })  — msg() with non-ICU, NO auto-fix
describe('static-string: msg() with $format "STRING" → no auto-fix, still reports error', () => {
  ruleTester.run('msg-format-string-no-fix', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { msg } from 'gt-react';
          const greeting = msg("Hello " + name, { $format: "STRING" });
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'staticStringRequired' }],
      },
    ],
  });
});

// ===================================================================
// 15. Chained ternaries → collapsed ICU select
// ===================================================================

// gt("Hello " + name + ", you are " + (isAdmin === 'admin' ? "admin" : isAdmin === 'user' ? "user" : "unknown"))
// → gt("Hello {var0}, you are {var1, select, admin {admin} user {user} other {unknown}}", { var0: name, var1: isAdmin })
describe('static-string: chained equality ternaries in concatenation → collapsed ICU select', () => {
  ruleTester.run('concat-chained-ternary', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello " + name + ", you are " + (isAdmin === 'admin' ? "admin" : isAdmin === 'user' ? "user" : "unknown"));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello {var0}, you are {var1, select, admin {admin} user {user} other {unknown}}", { var0: name, var1: isAdmin });
          }
        `,
      },
    ],
  });
});

// gt(`Role: ${role === 'admin' ? "Administrator" : role === 'mod' ? "Moderator" : role === 'user' ? "User" : "Guest"}`)
// → gt("Role: {var0, select, admin {Administrator} mod {Moderator} user {User} other {Guest}}", { var0: role })
describe('static-string: chained equality ternaries in template literal → collapsed ICU select', () => {
  ruleTester.run('template-chained-ternary', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt(\`Role: \${role === 'admin' ? "Administrator" : role === 'mod' ? "Moderator" : role === 'user' ? "User" : "Guest"}\`);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Role: {var0, select, admin {Administrator} mod {Moderator} user {User} other {Guest}}", { var0: role });
          }
        `,
      },
    ],
  });
});

// gt("Status: " + (x === 'a' ? "A" : y === 'b' ? "B" : "C"))
// → gt("Status: {var0, select, a {A} other {{var1, select, b {B} other {C}}}}", { var0: x, var1: y })
// Different variables produce nested selects
describe('static-string: chained ternaries with different variables → nested ICU selects', () => {
  ruleTester.run('concat-chained-different-vars', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Status: " + (x === 'a' ? "A" : y === 'b' ? "B" : "C"));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Status: {var0, select, a {A} other {{var1, select, b {B} other {C}}}}", { var0: x, var1: y });
          }
        `,
      },
    ],
  });
});

// gt("Hello " + name + ", you are " + (cond1 === 'admin' ? "admin" : cond2 === 'user' ? "user" : "unknown"))
// → gt("Hello {var0}, you are {var1, select, admin {admin} other {{var2, select, user {user} other {unknown}}}}", { var0: name, var1: cond1, var2: cond2 })
// Different variables (cond1 vs cond2) produce nested selects
describe('static-string: chained ternary with different variables + dynamic var in same concat', () => {
  ruleTester.run('concat-mixed-var-chain-break', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello " + name + ", you are " + (cond1 === 'admin' ? "admin" : cond2 === 'user' ? "user" : "unknown"));
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from 'gt-react';
          function Component() {
            const gt = useGT();
            return gt("Hello {var0}, you are {var1, select, admin {admin} other {{var2, select, user {user} other {unknown}}}}", { var0: name, var1: cond1, var2: cond2 });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 16. @generaltranslation/react-core library support
// ===================================================================

// gt("Hello " + name)  [via @generaltranslation/react-core]
// → gt("Hello {var0}", { var0: name })
describe('static-string: works with @generaltranslation/react-core imports', () => {
  ruleTester.run('react-core-lib', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT } from '@generaltranslation/react-core';
          function Component() {
            const gt = useGT();
            return gt("Hello " + name);
          }
        `,
        options: [{ libs: ['@generaltranslation/react-core'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT } from '@generaltranslation/react-core';
          function Component() {
            const gt = useGT();
            return gt("Hello {var0}", { var0: name });
          }
        `,
      },
    ],
  });
});

// ===================================================================
// 17. Aliased import support
// ===================================================================

// t("Hello " + name)  [via import { useGT as useTranslation }]
// → t("Hello {var0}", { var0: name })
describe('static-string: aliased useGT import → ICU variable', () => {
  ruleTester.run('aliased-import', staticString, {
    valid: [],
    invalid: [
      {
        code: `
          import { useGT as useTranslation } from 'gt-react';
          function Component() {
            const t = useTranslation();
            return t("Hello " + name);
          }
        `,
        options: [{ libs: ['gt-react'] }],
        errors: [{ messageId: 'variableInterpolationRequired' }],
        output: `
          import { useGT as useTranslation } from 'gt-react';
          function Component() {
            const t = useTranslation();
            return t("Hello {var0}", { var0: name });
          }
        `,
      },
    ],
  });
});
