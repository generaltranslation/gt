import { RuleTester } from '@typescript-eslint/rule-tester';
import { staticString } from '../index.js';

// RuleTester.run() registers its own describe/it blocks (vitest globals), so
// it must be called at the top level. Inside it() the cases never execute.
const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

type MessageId = keyof typeof staticString.meta.messages;

const errors = (...messageIds: MessageId[]) =>
  messageIds.map((messageId) => ({ messageId }));

/** A component that evaluates `expression` with `gt` bound to useGT(). */
const gt = (expression: string, specifiers = 'useGT') => `
import { ${specifiers} } from 'gt-react';
function Component() {
  const gt = useGT();
  return ${expression};
}
`;

/** Same as gt(), with derive imported. */
const gtDerive = (expression: string) => gt(expression, 'useGT, derive');

/** A module-level statement with msg (and optionally derive) imported. */
const msg = (expression: string, specifiers = 'msg') => `
import { ${specifiers} } from 'gt-react';
const message = ${expression};
`;

type Wrap = (expression: string) => string;
type Row = [name: string, expression: string];
type FixRow = [name: string, expression: string, fixedExpression: string];

const valid = (rows: Row[], wrap: Wrap = gt) =>
  rows.map(([name, expression]) => ({ name, code: wrap(expression) }));

/** Cases that report `messageId` once and offer no fix. */
const reports = (messageId: MessageId, rows: Row[], wrap: Wrap = gt) =>
  rows.map(([name, expression]) => ({
    name,
    code: wrap(expression),
    errors: errors(messageId),
  }));

/** Cases that report variableInterpolationRequired once and are fixed. */
const fixes = (rows: FixRow[], wrap: Wrap = gt) =>
  rows.map(([name, expression, fixedExpression]) => ({
    name,
    code: wrap(expression),
    output: wrap(fixedExpression),
    errors: errors('variableInterpolationRequired'),
  }));

ruleTester.run('static-string: detection', staticString, {
  valid: [
    ...valid([
      ['static string', 'gt("Hello world")'],
      ['no arguments', 'gt()'],
    ]),
    ...valid(
      [['msg() with an array of static strings', 'msg(["Hello", `World`])']],
      msg
    ),
    {
      name: 'unrelated function call',
      code: 'function notGT() { return someOtherFunction("Hello " + name); }',
    },
    {
      name: 'useGT from a library outside libs',
      code: `
        import { useGT } from 'some-other-lib';
        function Component() {
          const gt = useGT();
          return gt("hi" + name);
        }
      `,
    },
    {
      name: 'await getGT() when libs excludes gt-next',
      code: `
        import { getGT } from 'gt-next';
        async function handler() {
          const gt = await getGT();
          return gt("hi" + name);
        }
      `,
      options: [{ libs: ['gt-react'] }],
    },
    {
      name: 'msg from a library outside libs',
      code: `
        import { msg } from 'not-gt-react';
        const x = msg("hi" + name);
      `,
    },
    {
      name: 'locally declared function named gt',
      code: `
        function gt(s) { return s; }
        gt("hi" + name);
      `,
    },
    {
      name: 'locally declared arrow function named msg',
      code: `
        const msg = (s) => s;
        msg("hi" + name);
      `,
    },
  ],
  invalid: [
    {
      name: 'useGT result under another name',
      code: `
        import { useGT } from 'gt-react';
        function Component() {
          const translate = useGT();
          return translate("hi" + name);
        }
      `,
      output: `
        import { useGT } from 'gt-react';
        function Component() {
          const translate = useGT();
          return translate("hi{var0}", { var0: name });
        }
      `,
      errors: errors('variableInterpolationRequired'),
    },
    {
      name: 'aliased useGT import',
      code: `
        import { useGT as useTranslation } from 'gt-react';
        function Component() {
          const t = useTranslation();
          return t("Hello " + name);
        }
      `,
      output: `
        import { useGT as useTranslation } from 'gt-react';
        function Component() {
          const t = useTranslation();
          return t("Hello {var0}", { var0: name });
        }
      `,
      errors: errors('variableInterpolationRequired'),
    },
    {
      name: 'aliased msg import',
      code: `
        import { msg as register } from 'gt-react';
        const x = register("hi" + name);
      `,
      output: `
        import { msg as register } from 'gt-react';
        const x = register("hi{var0}", { var0: name });
      `,
      errors: errors('variableInterpolationRequired'),
    },
    {
      name: 'await getGT() from gt-next with explicit libs',
      code: `
        import { getGT } from 'gt-next';
        async function ServerComponent() {
          const gt = await getGT();
          return gt("hi" + name);
        }
      `,
      output: `
        import { getGT } from 'gt-next';
        async function ServerComponent() {
          const gt = await getGT();
          return gt("hi{var0}", { var0: name });
        }
      `,
      options: [{ libs: ['gt-next'] }],
      errors: errors('variableInterpolationRequired'),
    },
    {
      name: 'getGT() without await is still detected',
      code: `
        import { getGT } from 'gt-next';
        async function ServerComponent() {
          const gt = getGT();
          return gt("hi" + name);
        }
      `,
      output: `
        import { getGT } from 'gt-next';
        async function ServerComponent() {
          const gt = getGT();
          return gt("hi{var0}", { var0: name });
        }
      `,
      errors: errors('variableInterpolationRequired'),
    },
    {
      name: 'default libs include @generaltranslation/react-core/hooks',
      code: `
        import { useGT } from '@generaltranslation/react-core/hooks';
        function Component() {
          const gt = useGT();
          return gt("Hello " + name);
        }
      `,
      output: `
        import { useGT } from '@generaltranslation/react-core/hooks';
        function Component() {
          const gt = useGT();
          return gt("Hello {var0}", { var0: name });
        }
      `,
      errors: errors('variableInterpolationRequired'),
    },
    {
      name: 'gt and msg from different configured libs',
      code: `
        import { useGT } from 'gt-react';
        import { msg } from 'gt-next';
        function Component() {
          const gt = useGT();
          const a = gt("hi" + name);
          const b = msg(\`bye \${name}\`);
        }
      `,
      output: `
        import { useGT } from 'gt-react';
        import { msg } from 'gt-next';
        function Component() {
          const gt = useGT();
          const a = gt("hi{var0}", { var0: name });
          const b = msg("bye {var0}", { var0: name });
        }
      `,
      options: [{ libs: ['gt-react', 'gt-next'] }],
      errors: errors(
        'variableInterpolationRequired',
        'variableInterpolationRequired'
      ),
    },
    ...reports('variableInterpolationRequired', [
      ['spread argument', 'gt(...args)'],
    ]),
    ...reports('staticStringRequired', [
      ['identifier argument', 'gt(name)'],
      ['gt() does not accept arrays', 'gt(["Hello", "World"])'],
    ]),
    ...reports(
      'staticStringRequired',
      [
        ['msg() array with a dynamic element', 'msg(["Hello", name])'],
        ['msg() array with a spread element', 'msg(["Hello", ...arr])'],
      ],
      msg
    ),
  ],
});

ruleTester.run('static-string: derive', staticString, {
  valid: [
    ...valid(
      [
        ['standalone derive()', 'gt(derive(getValue()))'],
        ['static + derive', 'gt("Hello " + derive(x))'],
        ['derive + static', 'gt(derive(x) + " world")'],
        ['derive + derive', 'gt(derive(a) + derive(b))'],
        ['derive in a template literal', 'gt(`Hello ${derive(x)}!`)'],
      ],
      gtDerive
    ),
    {
      name: 'aliased derive',
      code: gt('gt("Hello " + deriveValue(x))', 'useGT, derive as deriveValue'),
    },
    {
      name: 'msg() with derive',
      code: msg('msg("Hello " + derive(x))', 'msg, derive'),
    },
  ],
  invalid: [
    // With derive() present the fix emits a template literal.
    ...fixes(
      [
        [
          'static + derive + dynamic',
          'gt("Hello " + derive(x) + " " + name)',
          'gt(`Hello ${derive(x)} {var0}`, { var0: name })',
        ],
        [
          'dynamic + derive',
          'gt(name + " " + derive(x))',
          'gt(`{var0} ${derive(x)}`, { var0: name })',
        ],
        [
          'template literal with derive and a dynamic value',
          'gt(`${derive(x)} ${name}`)',
          'gt(`${derive(x)} {var0}`, { var0: name })',
        ],
        [
          'concatenation with derive inside a template expression',
          'gt(`Hello ${name + derive(variable) + lastname}.`)',
          'gt(`Hello {var0}${derive(variable)}{var1}.`, { var0: name, var1: lastname })',
        ],
        [
          'ternary next to derive',
          'gt(derive(x) + (c ? "a" : "b"))',
          'gt(`${derive(x)}{var0, select, true {a} other {b}}`, { var0: c })',
        ],
        [
          'backtick and ${ in static text',
          'gt("a`b" + derive(x) + "c${d}" + derive(y) + name)',
          "gt(`a\\`b${derive(x)}c$'{'d'}'${derive(y)}{var0}`, { var0: name })",
        ],
        [
          'braces in static text',
          'gt("a{b}" + derive(x) + name)',
          "gt(`a'{'b'}'${derive(x)}{var0}`, { var0: name })",
        ],
      ],
      gtDerive
    ),
    ...fixes([
      [
        'concatenation without derive inside a template expression is one variable',
        'gt(`Hello ${first + last}.`)',
        'gt("Hello {var0}.", { var0: first + last })',
      ],
    ]),
    {
      name: 'derive from a non-GT library is a dynamic value',
      code: `
        import { useGT } from 'gt-react';
        import { derive } from 'other-lib';
        function Component() {
          const gt = useGT();
          return gt("val: " + derive(x));
        }
      `,
      output: `
        import { useGT } from 'gt-react';
        import { derive } from 'other-lib';
        function Component() {
          const gt = useGT();
          return gt("val: {var0}", { var0: derive(x) });
        }
      `,
      errors: errors('variableInterpolationRequired'),
    },
  ],
});

ruleTester.run('static-string: ICU validation', staticString, {
  valid: [
    ...valid([
      ['placeholder', 'gt("Hello {name}!")'],
      ['select', 'gt("{gender, select, male {He} female {She} other {They}}")'],
      [
        'plural with a nested placeholder',
        'gt("{count, plural, =0 {none} one {one item} other {{count} items}}")',
      ],
      [
        'plural nested in select',
        'gt("{gender, select, male {{count, plural, one {He has # item} other {He has # items}}} other {They have items}}")',
      ],
      ['number skeleton', 'gt("{price, number, ::currency/USD}")'],
      ['number style containing braces', 'gt("{n, number, foo{bar}baz}")'],
      ['unmatched closing brace is literal text', 'gt("Hello }")'],
      ['static concatenation', 'gt("Hello " + "{name}!")'],
      ['static template literal', 'gt(`Hello {name}!`)'],
      [
        'template literal with only static expressions',
        'gt(`${"Hello "} ${"world"}`)',
      ],
      [
        '$format STRING skips validation',
        'gt("Hello {unclosed", { $format: "STRING" })',
      ],
    ]),
    ...valid(
      [
        [
          'derive in a concatenation skips validation',
          'gt("Hello {unclosed" + derive(x))',
        ],
      ],
      gtDerive
    ),
    ...valid([['msg()', 'msg("Hello {name}!")']], msg),
  ],
  invalid: [
    ...reports('invalidICUFormat', [
      ['unclosed placeholder', 'gt("Hello {name")'],
      ['empty placeholder', 'gt("Hello {}")'],
      ['static concatenation', 'gt("Hello " + "{name")'],
      ['static template literal', 'gt(`Hello {name`)'],
      [
        'template literal with a static expression',
        'gt(`${"hello {unclosed"}`)',
      ],
      ['explicit $format ICU', 'gt("Hello {unclosed", { $format: "ICU" })'],
      // ICU rejects a token that is not its own, and Intl cannot format some.
      [
        'number skeleton with a malformed token',
        'gt("{n, number, ::integer-width/x*00}")',
      ],
      ['currency skeleton without a currency', 'gt("{n, number, ::currency}")'],
      ['number skeleton Intl cannot format', 'gt("{n, number, ::permille}")'],
    ]),
    ...reports(
      'invalidICUFormat',
      [
        ['malformed plural via msg()', 'msg("Count: {count, plural, }")'],
        [
          'msg() array validates each element',
          'msg(["Hello {name}", "Bye {"])',
        ],
      ],
      msg
    ),
  ],
});

ruleTester.run('static-string: sugar variables', staticString, {
  valid: [
    ...valid([
      ['$context: string', 'gt("Hello", { $context: "greeting" })'],
      [
        '$context: static template literal',
        'gt("Hello", { $context: `greeting` })',
      ],
      [
        '$context: static concatenation',
        'gt("Hello", { $context: "formal " + "greeting" })',
      ],
      ['$id: string', 'gt("Hello", { $id: "greeting-1" })'],
      ['$id: static template literal', 'gt("Hello", { $id: `my-id` })'],
      ['$format: string', 'gt("Hello", { $format: "ICU" })'],
      ['$format: static template literal', 'gt("Hello", { $format: `ICU` })'],
      ['$maxChars: number', 'gt("Hello", { $maxChars: 50 })'],
      ['$maxChars: negative number', 'gt("Hello", { $maxChars: -5 })'],
      ['$requiresReview: true', 'gt("Hello", { $requiresReview: true })'],
      ['$requiresReview: false', 'gt("Hello", { $requiresReview: false })'],
      [
        'string-literal keys',
        'gt("Hello", { "$context": "ctx", "$id": "id", "$format": "ICU", "$maxChars": 100 })',
      ],
      [
        'other keys are not checked',
        'gt("Hello {name}!", { name: userName, $custom: dynamicValue })',
      ],
      ['spread in options', 'gt("Hello {name}!", { ...opts })'],
      ['computed key', 'gt("Hello", { [key]: "value" })'],
    ]),
    ...valid(
      [
        ['$context: derive()', 'gt("Hello", { $context: derive(x) })'],
        [
          '$context: concatenation with derive()',
          'gt("Hello", { $context: "a" + derive(x) + "b" + derive(y) })',
        ],
      ],
      gtDerive
    ),
    ...valid(
      [
        [
          'msg() with every sugar variable',
          'msg("Hello", { $context: "ctx", $id: "id", $format: "ICU", $maxChars: 100 })',
        ],
      ],
      msg
    ),
  ],
  invalid: [
    ...reports('sugarVariableMustBeStatic', [
      ['$context: identifier', 'gt("Hello", { $context: someVar })'],
      [
        '$context: interpolated template literal',
        'gt("Hello", { $context: `ctx ${value}` })',
      ],
      [
        '$context: concatenation with a dynamic value',
        'gt("Hello", { $context: "prefix " + dynamicValue })',
      ],
      ['$context: shorthand property', 'gt("Hello", { $context })'],
      [
        '$context: string-literal key',
        'gt("Hello", { "$context": dynamicVar })',
      ],
      ['$id: identifier', 'gt("Hello", { $id: someVar })'],
      ['$id: concatenation', 'gt("Hello", { $id: "hello" + "-world" })'],
      ['$id: string-literal key', 'gt("Hello", { "$id": computedId })'],
      [
        '$format: identifier, and the content is not ICU-validated',
        'gt("Hello {}", { $format: dynamicVar })',
      ],
      ['$maxChars: identifier', 'gt("Hello", { $maxChars: charLimit })'],
      ['$maxChars: arithmetic', 'gt("Hello", { $maxChars: 10 + 5 })'],
      [
        '$maxChars: string under a string-literal key',
        'gt("Hello", { "$maxChars": "50" })',
      ],
      ['$requiresReview: string', 'gt("Hello", { $requiresReview: "true" })'],
      ['$requiresReview: identifier', 'gt("Hello", { $requiresReview: flag })'],
      [
        'only the dynamic sugar variable is reported',
        'gt("Hello", { $context: "valid", $id: someVar })',
      ],
    ]),
    ...reports(
      'sugarVariableMustBeStatic',
      [
        ['$id: derive()', 'gt("Hello", { $id: derive(getId()) })'],
        ['$format: derive()', 'gt("Hello", { $format: derive(getFormat()) })'],
      ],
      gtDerive
    ),
    ...reports(
      'sugarVariableMustBeStatic',
      [['msg() $context: identifier', 'msg("Hello", { $context: someVar })']],
      msg
    ),
    {
      name: 'each dynamic sugar variable is reported',
      code: gt('gt("Hello", { $context: ctx, $id: id })'),
      errors: errors('sugarVariableMustBeStatic', 'sugarVariableMustBeStatic'),
    },
    {
      name: 'dynamic content and dynamic sugar variable: both reported, content fixed',
      code: gt('gt("Hello " + name, { $context: ctx })'),
      output: gt('gt("Hello {var0}", { $context: ctx, var0: name })'),
      errors: errors(
        'variableInterpolationRequired',
        'sugarVariableMustBeStatic'
      ),
    },
  ],
});

ruleTester.run('static-string: $format and the auto-fix', staticString, {
  valid: [],
  invalid: [
    ...fixes([
      [
        'explicit $format ICU',
        'gt("Hello " + name, { $format: "ICU" })',
        'gt("Hello {var0}", { $format: "ICU", var0: name })',
      ],
      [
        '$format ICU as a template literal',
        'gt("Hello " + name, { $format: `ICU` })',
        'gt("Hello {var0}", { $format: `ICU`, var0: name })',
      ],
    ]),
    // Any other format is reported without a fix.
    ...reports('staticStringRequired', [
      ['$format STRING', 'gt("Hello " + name, { $format: "STRING" })'],
      [
        '$format STRING as a template literal',
        'gt("Hello " + name, { $format: `STRING` })',
      ],
      [
        '$format under a string-literal key',
        'gt("Hello " + name, { "$format": "STRING" })',
      ],
      [
        '$format I18NEXT with a template literal',
        'gt(`Hello ${name}!`, { $format: "I18NEXT" })',
      ],
    ]),
    ...reports(
      'staticStringRequired',
      [
        [
          'msg() with $format STRING',
          'msg("Hello " + name, { $format: "STRING" })',
        ],
      ],
      msg
    ),
    {
      name: 'dynamic $format: no fix, and $format is reported too',
      code: gt('gt("Hello " + name, { $format: dynamicVar })'),
      errors: errors('staticStringRequired', 'sugarVariableMustBeStatic'),
    },
  ],
});

ruleTester.run('static-string: ICU auto-fix', staticString, {
  valid: [],
  invalid: [
    ...fixes([
      // Variables
      [
        'concatenation',
        'gt("Hello " + name + "!")',
        'gt("Hello {var0}!", { var0: name })',
      ],
      [
        'several variables',
        'gt("Welcome, " + user.name + "! You have " + count + " new messages.")',
        'gt("Welcome, {var0}! You have {var1} new messages.", { var0: user.name, var1: count })',
      ],
      [
        'dynamic value first',
        'gt(count + " items remaining")',
        'gt("{var0} items remaining", { var0: count })',
      ],
      [
        'template literal',
        'gt(`${name} is ${age} years old`)',
        'gt("{var0} is {var1} years old", { var0: name, var1: age })',
      ],
      [
        'template literal with only an expression',
        'gt(`${greeting}`)',
        'gt("{var0}", { var0: greeting })',
      ],
      [
        'method call',
        'gt("My number is " + Math.random())',
        'gt("My number is {var0}", { var0: Math.random() })',
      ],
      [
        'call to an undeclared function',
        'gt("val: " + foo())',
        'gt("val: {var0}", { var0: foo() })',
      ],
      [
        'non-string literal is a variable',
        'gt("count: " + 42)',
        'gt("count: {var0}", { var0: 42 })',
      ],
      [
        'parenthesized expression loses its parentheses',
        'gt("name: " + (name ?? "default"))',
        'gt("name: {var0}", { var0: name ?? "default" })',
      ],
      [
        'parenthesized + is flattened into separate variables',
        'gt("val: " + (a + b))',
        'gt("val: {var0}{var1}", { var0: a, var1: b })',
      ],
      [
        'empty static parts',
        'gt("" + name + "")',
        'gt("{var0}", { var0: name })',
      ],
      [
        'repeated expressions reuse their variable',
        'gt(a + " " + b + " " + a + " " + b)',
        'gt("{var0} {var1} {var0} {var1}", { var0: a, var1: b })',
      ],
      [
        'repeated expression in a template literal',
        'gt(`${name} and ${name}`)',
        'gt("{var0} and {var0}", { var0: name })',
      ],
      // Escaping
      [
        'apostrophes are doubled and double quotes escaped',
        String.raw`gt('The user\'s profile says "Hello, world!" and it\'s ' + status)`,
        String.raw`gt("The user''s profile says \"Hello, world!\" and it''s {var0}", { var0: status })`,
      ],
      [
        'double quotes in a template literal',
        'gt(`He said "hello" ${name}`)',
        String.raw`gt("He said \"hello\" {var0}", { var0: name })`,
      ],
      [
        'backslash',
        String.raw`gt("a\\b" + name)`,
        String.raw`gt("a\\b{var0}", { var0: name })`,
      ],
      [
        'newline, tab and carriage return',
        String.raw`gt("a\n\tb\r" + name)`,
        String.raw`gt("a\n\tb\r{var0}", { var0: name })`,
      ],
      [
        'braces are quoted',
        'gt("a{b}c" + name)',
        `gt("a'{'b'}'c{var0}", { var0: name })`,
      ],
      [
        '} before { are quoted independently',
        'gt("} { " + name)',
        `gt("'}' '{' {var0}", { var0: name })`,
      ],
      [
        'adjacent }{ are quoted independently',
        'gt("}{ " + name)',
        `gt("'}''{' {var0}", { var0: name })`,
      ],
      [
        'lone }',
        'gt("solo } here " + name)',
        `gt("solo '}' here {var0}", { var0: name })`,
      ],
      [
        'lone {',
        'gt("solo { here " + name)',
        `gt("solo '{' here {var0}", { var0: name })`,
      ],
      [
        'apostrophes next to braces',
        `gt("a'{b}'c" + name)`,
        `gt("a'''{'b'}'''c{var0}", { var0: name })`,
      ],
      // Options merging
      [
        'appended to existing options',
        'gt("Hi " + name, { $context: "informal", $id: "greeting" })',
        'gt("Hi {var0}", { $context: "informal", $id: "greeting", var0: name })',
      ],
      [
        'empty options object is replaced',
        'gt("Hello " + name, {})',
        'gt("Hello {var0}", { var0: name })',
      ],
      [
        'existing var0 is skipped',
        'gt("Hello " + name, { var0: existing })',
        'gt("Hello {var1}", { var0: existing, var1: name })',
      ],
      [
        'several reserved names are skipped',
        'gt(a + " " + b, { var0: x, var1: y })',
        'gt("{var2} {var3}", { var0: x, var1: y, var2: a, var3: b })',
      ],
      [
        'a free name below a reserved one is used',
        'gt("Hello " + name, { var1: existing })',
        'gt("Hello {var0}", { var1: existing, var0: name })',
      ],
    ]),
    ...fixes(
      [
        [
          'msg()',
          'msg("Hello " + name + "!")',
          'msg("Hello {var0}!", { var0: name })',
        ],
      ],
      msg
    ),
    // A second argument that is not an object literal cannot be merged into.
    ...reports('variableInterpolationRequired', [
      ['identifier as second argument: no fix', 'gt("Hello " + name, opts)'],
      ['spread as second argument: no fix', 'gt("Hi " + name, ...spread)'],
    ]),
  ],
});

ruleTester.run('static-string: ternary to ICU select', staticString, {
  valid: [],
  invalid: fixes([
    [
      'boolean test',
      'gt("My name is " + (cond ? "Ernest" : "Brian"))',
      'gt("My name is {var0, select, true {Ernest} other {Brian}}", { var0: cond })',
    ],
    [
      'in a template literal next to a variable',
      'gt(`Hello ${name}, you are ${isAdmin ? "admin" : "user"}`)',
      'gt("Hello {var0}, you are {var1, select, true {admin} other {user}}", { var0: name, var1: isAdmin })',
    ],
    [
      '=== uses the literal as the key',
      'gt("The user is a " + (gender === "male" ? "boy" : "girl"))',
      'gt("The user is a {var0, select, male {boy} other {girl}}", { var0: gender })',
    ],
    [
      '==',
      'gt("val: " + (x == "a" ? "A" : "B"))',
      'gt("val: {var0, select, a {A} other {B}}", { var0: x })',
    ],
    [
      'literal on the left',
      'gt("val: " + ("admin" === role ? "Admin" : "User"))',
      'gt("val: {var0, select, admin {Admin} other {User}}", { var0: role })',
    ],
    [
      'key with hyphens, underscores and digits',
      'gt("val: " + (x === "valid-key_123" ? "A" : "B"))',
      'gt("val: {var0, select, valid-key_123 {A} other {B}}", { var0: x })',
    ],
    // Literals that are not valid select keys keep the whole test.
    [
      'key with a space',
      'gt("val: " + (x === "hello world" ? "A" : "B"))',
      'gt("val: {var0, select, true {A} other {B}}", { var0: x === "hello world" })',
    ],
    [
      'key with a comma',
      'gt("val: " + (x === "done,failed" ? "A" : "B"))',
      'gt("val: {var0, select, true {A} other {B}}", { var0: x === "done,failed" })',
    ],
    [
      'key with braces',
      'gt("val: " + (x === "a{b}" ? "A" : "B"))',
      'gt("val: {var0, select, true {A} other {B}}", { var0: x === "a{b}" })',
    ],
    [
      'key with an apostrophe',
      `gt("val: " + (x === "it's" ? "A" : "B"))`,
      `gt("val: {var0, select, true {A} other {B}}", { var0: x === "it's" })`,
    ],
    [
      'key with a hash',
      'gt("val: " + (x === "a#b" ? "A" : "B"))',
      'gt("val: {var0, select, true {A} other {B}}", { var0: x === "a#b" })',
    ],
    [
      'number literal',
      'gt("val: " + (x === 1 ? "one" : "other"))',
      'gt("val: {var0, select, true {one} other {other}}", { var0: x === 1 })',
    ],
    // Branch values
    [
      'empty string branch',
      'gt("prefix" + (cond ? "" : "suffix"))',
      'gt("prefix{var0, select, true {} other {suffix}}", { var0: cond })',
    ],
    [
      'static template literal branches',
      'gt("val: " + (cond ? `yes` : `no`))',
      'gt("val: {var0, select, true {yes} other {no}}", { var0: cond })',
    ],
    [
      '} in a branch value is quoted',
      'gt("" + (x === "a" ? "val}" : "ok"))',
      `gt("{var0, select, a {val'}'} other {ok}}", { var0: x })`,
    ],
    [
      '{ in the other value is quoted',
      'gt("" + (x === "a" ? "ok" : "val{"))',
      `gt("{var0, select, a {ok} other {val'{'}}", { var0: x })`,
    ],
    [
      'apostrophe in a branch value is doubled',
      `gt("" + (x === "a" ? "it's" : "ok"))`,
      `gt("{var0, select, a {it''s} other {ok}}", { var0: x })`,
    ],
    [
      'dynamic consequent is a plain variable',
      'gt("val: " + (cond ? getName() : "default"))',
      'gt("val: {var0}", { var0: cond ? getName() : "default" })',
    ],
    [
      'dynamic alternate is a plain variable',
      'gt("val: " + (cond ? "yes" : getNo()))',
      'gt("val: {var0}", { var0: cond ? "yes" : getNo() })',
    ],
    // Chains
    [
      'chain on one variable collapses',
      'gt("" + (s === "a" ? "A" : s === "b" ? "B" : s === "c" ? "C" : "D"))',
      'gt("{var0, select, a {A} b {B} c {C} other {D}}", { var0: s })',
    ],
    [
      'chain with a dynamic middle branch is a plain variable',
      'gt("" + (s === "a" ? "A" : s === "b" ? getB() : "C"))',
      'gt("{var0}", { var0: s === "a" ? "A" : s === "b" ? getB() : "C" })',
    ],
    [
      'chain ending on another variable nests',
      'gt("" + (x === "a" ? "A" : x === "b" ? "B" : cond ? "C" : "D"))',
      'gt("{var0, select, a {A} b {B} other {{var1, select, true {C} other {D}}}}", { var0: x, var1: cond })',
    ],
    [
      'three variables nest three selects',
      'gt("" + (a === "x" ? "X" : b === "y" ? "Y" : c === "z" ? "Z" : "other"))',
      'gt("{var0, select, x {X} other {{var1, select, y {Y} other {{var2, select, z {Z} other {other}}}}}}", { var0: a, var1: b, var2: c })',
    ],
    [
      'variable reused in a nested select',
      'gt("" + (x === "a" ? "A" : y === "b" ? "B" : x === "c" ? "C" : "D"))',
      'gt("{var0, select, a {A} other {{var1, select, b {B} other {{var0, select, c {C} other {D}}}}}}", { var0: x, var1: y })',
    ],
    [
      'invalid first key nests a select on the same variable',
      'gt("" + (x === "a b" ? "A" : x === "c" ? "C" : "D"))',
      'gt("{var0, select, true {A} other {{var1, select, c {C} other {D}}}}", { var0: x === "a b", var1: x })',
    ],
    // Several selects
    [
      'two selects on different variables',
      'gt("" + (a === "x" ? "X" : "Y") + " " + (b === "p" ? "P" : "Q"))',
      'gt("{var0, select, x {X} other {Y}} {var1, select, p {P} other {Q}}", { var0: a, var1: b })',
    ],
    [
      'two selects on the same variable',
      'gt("" + (x === "a" ? "A" : "B") + " and " + (x === "c" ? "C" : "D"))',
      'gt("{var0, select, a {A} other {B}} and {var0, select, c {C} other {D}}", { var0: x })',
    ],
    [
      'select variable reused as a plain variable',
      'gt("" + (x === "a" ? "A" : "B") + " " + x)',
      'gt("{var0, select, a {A} other {B}} {var0}", { var0: x })',
    ],
  ]),
});
