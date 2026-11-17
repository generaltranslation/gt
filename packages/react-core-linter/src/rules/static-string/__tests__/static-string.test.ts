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

/** A component that evaluates `expression` with `t` bound to useGT(). */
const t = (expression: string, specifiers = 'useGT') => `
import { ${specifiers} } from 'gt-react';
function Component() {
  const t = useGT();
  return ${expression};
}
`;

/** Same as t(), with derive imported. */
const tDerive = (expression: string) => t(expression, 'useGT, derive');

/** A module-level statement with msg (and optionally derive) imported. */
const msg = (expression: string, specifiers = 'msg') => `
import { ${specifiers} } from 'gt-react';
const message = ${expression};
`;

type Wrap = (expression: string) => string;
type Row = [name: string, expression: string];
type FixRow = [name: string, expression: string, fixedExpression: string];

const valid = (rows: Row[], wrap: Wrap = t) =>
  rows.map(([name, expression]) => ({ name, code: wrap(expression) }));

/** Cases that report `messageId` once and offer no fix. */
const reports = (messageId: MessageId, rows: Row[], wrap: Wrap = t) =>
  rows.map(([name, expression]) => ({
    name,
    code: wrap(expression),
    errors: errors(messageId),
  }));

/** Cases that report variableInterpolationRequired once and are fixed. */
const fixes = (rows: FixRow[], wrap: Wrap = t) =>
  rows.map(([name, expression, fixedExpression]) => ({
    name,
    code: wrap(expression),
    output: wrap(fixedExpression),
    errors: errors('variableInterpolationRequired'),
  }));

ruleTester.run('static-string: detection', staticString, {
  valid: [
    ...valid([
      ['static string', 't("Hello world")'],
      ['no arguments', 't()'],
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
          const t = useGT();
          return t("hi" + name);
        }
      `,
    },
    {
      name: 'await getGT() when libs excludes gt-next',
      code: `
        import { getGT } from 'gt-next';
        async function handler() {
          const t = await getGT();
          return t("hi" + name);
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
      name: 'locally declared function named t',
      code: `
        function t(s) { return s; }
        t("hi" + name);
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
          const t = await getGT();
          return t("hi" + name);
        }
      `,
      output: `
        import { getGT } from 'gt-next';
        async function ServerComponent() {
          const t = await getGT();
          return t("hi{var0}", { var0: name });
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
          const t = getGT();
          return t("hi" + name);
        }
      `,
      output: `
        import { getGT } from 'gt-next';
        async function ServerComponent() {
          const t = getGT();
          return t("hi{var0}", { var0: name });
        }
      `,
      errors: errors('variableInterpolationRequired'),
    },
    {
      name: 'default libs include @generaltranslation/react-core/hooks',
      code: `
        import { useGT } from '@generaltranslation/react-core/hooks';
        function Component() {
          const t = useGT();
          return t("Hello " + name);
        }
      `,
      output: `
        import { useGT } from '@generaltranslation/react-core/hooks';
        function Component() {
          const t = useGT();
          return t("Hello {var0}", { var0: name });
        }
      `,
      errors: errors('variableInterpolationRequired'),
    },
    {
      name: 't and msg from different configured libs',
      code: `
        import { useGT } from 'gt-react';
        import { msg } from 'gt-next';
        function Component() {
          const t = useGT();
          const a = t("hi" + name);
          const b = msg(\`bye \${name}\`);
        }
      `,
      output: `
        import { useGT } from 'gt-react';
        import { msg } from 'gt-next';
        function Component() {
          const t = useGT();
          const a = t("hi{var0}", { var0: name });
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
      ['spread argument', 't(...args)'],
    ]),
    ...reports('staticStringRequired', [
      ['identifier argument', 't(name)'],
      ['t() does not accept arrays', 't(["Hello", "World"])'],
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
        ['standalone derive()', 't(derive(getValue()))'],
        ['static + derive', 't("Hello " + derive(x))'],
        ['derive + static', 't(derive(x) + " world")'],
        ['derive + derive', 't(derive(a) + derive(b))'],
        ['derive in a template literal', 't(`Hello ${derive(x)}!`)'],
      ],
      tDerive
    ),
    {
      name: 'aliased derive',
      code: t('t("Hello " + deriveValue(x))', 'useGT, derive as deriveValue'),
    },
    {
      name: 'msg() with derive',
      code: msg('msg("Hello " + derive(x))', 'msg, derive'),
    },
    {
      name: 'derive from generaltranslation with the default libs',
      code: `
        import { useGT } from '@generaltranslation/react-core/hooks';
        import { derive } from 'generaltranslation';
        function Component() {
          const t = useGT();
          return t("Hello " + derive("world"));
        }
      `,
    },
  ],
  invalid: [
    // With derive() present the fix emits a template literal.
    ...fixes(
      [
        [
          'static + derive + dynamic',
          't("Hello " + derive(x) + " " + name)',
          't(`Hello ${derive(x)} {var0}`, { var0: name })',
        ],
        [
          'dynamic + derive',
          't(name + " " + derive(x))',
          't(`{var0} ${derive(x)}`, { var0: name })',
        ],
        [
          'template literal with derive and a dynamic value',
          't(`${derive(x)} ${name}`)',
          't(`${derive(x)} {var0}`, { var0: name })',
        ],
        [
          'concatenation with derive inside a template expression',
          't(`Hello ${name + derive(variable) + lastname}.`)',
          't(`Hello {var0}${derive(variable)}{var1}.`, { var0: name, var1: lastname })',
        ],
        [
          'ternary next to derive',
          't(derive(x) + (c ? "a" : "b"))',
          't(`${derive(x)}{var0, select, true {a} other {b}}`, { var0: c })',
        ],
        [
          'backtick and ${ in static text',
          't("a`b" + derive(x) + "c${d}" + derive(y) + name)',
          "t(`a\\`b${derive(x)}c$'{'d'}'${derive(y)}{var0}`, { var0: name })",
        ],
        [
          'braces in static text',
          't("a{b}" + derive(x) + name)',
          "t(`a'{'b'}'${derive(x)}{var0}`, { var0: name })",
        ],
      ],
      tDerive
    ),
    ...fixes([
      [
        'concatenation without derive inside a template expression is one variable',
        't(`Hello ${first + last}.`)',
        't("Hello {var0}.", { var0: first + last })',
      ],
    ]),
    {
      name: 'derive from a non-GT library is a dynamic value',
      code: `
        import { useGT } from 'gt-react';
        import { derive } from 'other-lib';
        function Component() {
          const t = useGT();
          return t("val: " + derive(x));
        }
      `,
      output: `
        import { useGT } from 'gt-react';
        import { derive } from 'other-lib';
        function Component() {
          const t = useGT();
          return t("val: {var0}", { var0: derive(x) });
        }
      `,
      errors: errors('variableInterpolationRequired'),
    },
  ],
});

ruleTester.run('static-string: ICU validation', staticString, {
  valid: [
    ...valid([
      ['placeholder', 't("Hello {name}!")'],
      ['select', 't("{gender, select, male {He} female {She} other {They}}")'],
      [
        'plural with a nested placeholder',
        't("{count, plural, =0 {none} one {one item} other {{count} items}}")',
      ],
      [
        'plural nested in select',
        't("{gender, select, male {{count, plural, one {He has # item} other {He has # items}}} other {They have items}}")',
      ],
      ['number skeleton', 't("{price, number, ::currency/USD}")'],
      ['number style containing braces', 't("{n, number, foo{bar}baz}")'],
      ['unmatched closing brace is literal text', 't("Hello }")'],
      ['static concatenation', 't("Hello " + "{name}!")'],
      ['static template literal', 't(`Hello {name}!`)'],
      [
        'template literal with only static expressions',
        't(`${"Hello "} ${"world"}`)',
      ],
      [
        '$format STRING skips validation',
        't("Hello {unclosed", { $format: "STRING" })',
      ],
    ]),
    ...valid(
      [
        [
          'derive in a concatenation skips validation',
          't("Hello {unclosed" + derive(x))',
        ],
      ],
      tDerive
    ),
    ...valid([['msg()', 'msg("Hello {name}!")']], msg),
  ],
  invalid: [
    ...reports('invalidICUFormat', [
      ['unclosed placeholder', 't("Hello {name")'],
      ['empty placeholder', 't("Hello {}")'],
      ['static concatenation', 't("Hello " + "{name")'],
      ['static template literal', 't(`Hello {name`)'],
      [
        'template literal with a static expression',
        't(`${"hello {unclosed"}`)',
      ],
      ['explicit $format ICU', 't("Hello {unclosed", { $format: "ICU" })'],
      // ICU rejects a token that is not its own, and Intl cannot format some.
      [
        'number skeleton with a malformed token',
        't("{n, number, ::integer-width/x*00}")',
      ],
      ['currency skeleton without a currency', 't("{n, number, ::currency}")'],
      ['number skeleton Intl cannot format', 't("{n, number, ::permille}")'],
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
      ['$context: string', 't("Hello", { $context: "greeting" })'],
      [
        '$context: static template literal',
        't("Hello", { $context: `greeting` })',
      ],
      [
        '$context: static concatenation',
        't("Hello", { $context: "formal " + "greeting" })',
      ],
      ['$id: string', 't("Hello", { $id: "greeting-1" })'],
      ['$id: static template literal', 't("Hello", { $id: `my-id` })'],
      ['$format: string', 't("Hello", { $format: "ICU" })'],
      ['$format: static template literal', 't("Hello", { $format: `ICU` })'],
      ['$maxChars: number', 't("Hello", { $maxChars: 50 })'],
      ['$maxChars: negative number', 't("Hello", { $maxChars: -5 })'],
      ['$requiresReview: true', 't("Hello", { $requiresReview: true })'],
      ['$requiresReview: false', 't("Hello", { $requiresReview: false })'],
      [
        'string-literal keys',
        't("Hello", { "$context": "ctx", "$id": "id", "$format": "ICU", "$maxChars": 100 })',
      ],
      [
        'other keys are not checked',
        't("Hello {name}!", { name: userName, $custom: dynamicValue })',
      ],
      ['spread in options', 't("Hello {name}!", { ...opts })'],
      ['computed key', 't("Hello", { [key]: "value" })'],
    ]),
    ...valid(
      [
        ['$context: derive()', 't("Hello", { $context: derive(x) })'],
        [
          '$context: concatenation with derive()',
          't("Hello", { $context: "a" + derive(x) + "b" + derive(y) })',
        ],
      ],
      tDerive
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
      ['$context: identifier', 't("Hello", { $context: someVar })'],
      [
        '$context: interpolated template literal',
        't("Hello", { $context: `ctx ${value}` })',
      ],
      [
        '$context: concatenation with a dynamic value',
        't("Hello", { $context: "prefix " + dynamicValue })',
      ],
      ['$context: shorthand property', 't("Hello", { $context })'],
      [
        '$context: string-literal key',
        't("Hello", { "$context": dynamicVar })',
      ],
      ['$id: identifier', 't("Hello", { $id: someVar })'],
      ['$id: concatenation', 't("Hello", { $id: "hello" + "-world" })'],
      ['$id: string-literal key', 't("Hello", { "$id": computedId })'],
      [
        '$format: identifier, and the content is not ICU-validated',
        't("Hello {}", { $format: dynamicVar })',
      ],
      ['$maxChars: identifier', 't("Hello", { $maxChars: charLimit })'],
      ['$maxChars: arithmetic', 't("Hello", { $maxChars: 10 + 5 })'],
      [
        '$maxChars: string under a string-literal key',
        't("Hello", { "$maxChars": "50" })',
      ],
      ['$requiresReview: string', 't("Hello", { $requiresReview: "true" })'],
      ['$requiresReview: identifier', 't("Hello", { $requiresReview: flag })'],
      [
        'only the dynamic sugar variable is reported',
        't("Hello", { $context: "valid", $id: someVar })',
      ],
    ]),
    ...reports(
      'sugarVariableMustBeStatic',
      [
        ['$id: derive()', 't("Hello", { $id: derive(getId()) })'],
        ['$format: derive()', 't("Hello", { $format: derive(getFormat()) })'],
      ],
      tDerive
    ),
    ...reports(
      'sugarVariableMustBeStatic',
      [['msg() $context: identifier', 'msg("Hello", { $context: someVar })']],
      msg
    ),
    {
      name: 'each dynamic sugar variable is reported',
      code: t('t("Hello", { $context: ctx, $id: id })'),
      errors: errors('sugarVariableMustBeStatic', 'sugarVariableMustBeStatic'),
    },
    {
      name: 'dynamic content and dynamic sugar variable: both reported, content fixed',
      code: t('t("Hello " + name, { $context: ctx })'),
      output: t('t("Hello {var0}", { $context: ctx, var0: name })'),
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
        't("Hello " + name, { $format: "ICU" })',
        't("Hello {var0}", { $format: "ICU", var0: name })',
      ],
      [
        '$format ICU as a template literal',
        't("Hello " + name, { $format: `ICU` })',
        't("Hello {var0}", { $format: `ICU`, var0: name })',
      ],
    ]),
    // Any other format is reported without a fix.
    ...reports('staticStringRequired', [
      ['$format STRING', 't("Hello " + name, { $format: "STRING" })'],
      [
        '$format STRING as a template literal',
        't("Hello " + name, { $format: `STRING` })',
      ],
      [
        '$format under a string-literal key',
        't("Hello " + name, { "$format": "STRING" })',
      ],
      [
        '$format I18NEXT with a template literal',
        't(`Hello ${name}!`, { $format: "I18NEXT" })',
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
      code: t('t("Hello " + name, { $format: dynamicVar })'),
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
        't("Hello " + name + "!")',
        't("Hello {var0}!", { var0: name })',
      ],
      [
        'several variables',
        't("Welcome, " + user.name + "! You have " + count + " new messages.")',
        't("Welcome, {var0}! You have {var1} new messages.", { var0: user.name, var1: count })',
      ],
      [
        'dynamic value first',
        't(count + " items remaining")',
        't("{var0} items remaining", { var0: count })',
      ],
      [
        'template literal',
        't(`${name} is ${age} years old`)',
        't("{var0} is {var1} years old", { var0: name, var1: age })',
      ],
      [
        'template literal with only an expression',
        't(`${greeting}`)',
        't("{var0}", { var0: greeting })',
      ],
      [
        'method call',
        't("My number is " + Math.random())',
        't("My number is {var0}", { var0: Math.random() })',
      ],
      [
        'call to an undeclared function',
        't("val: " + foo())',
        't("val: {var0}", { var0: foo() })',
      ],
      [
        'non-string literal is a variable',
        't("count: " + 42)',
        't("count: {var0}", { var0: 42 })',
      ],
      [
        'parenthesized expression loses its parentheses',
        't("name: " + (name ?? "default"))',
        't("name: {var0}", { var0: name ?? "default" })',
      ],
      [
        'parenthesized + is flattened into separate variables',
        't("val: " + (a + b))',
        't("val: {var0}{var1}", { var0: a, var1: b })',
      ],
      [
        'empty static parts',
        't("" + name + "")',
        't("{var0}", { var0: name })',
      ],
      [
        'repeated expressions reuse their variable',
        't(a + " " + b + " " + a + " " + b)',
        't("{var0} {var1} {var0} {var1}", { var0: a, var1: b })',
      ],
      [
        'repeated expression in a template literal',
        't(`${name} and ${name}`)',
        't("{var0} and {var0}", { var0: name })',
      ],
      // Escaping
      [
        'apostrophes are doubled and double quotes escaped',
        String.raw`t('The user\'s profile says "Hello, world!" and it\'s ' + status)`,
        String.raw`t("The user''s profile says \"Hello, world!\" and it''s {var0}", { var0: status })`,
      ],
      [
        'double quotes in a template literal',
        't(`He said "hello" ${name}`)',
        String.raw`t("He said \"hello\" {var0}", { var0: name })`,
      ],
      [
        'backslash',
        String.raw`t("a\\b" + name)`,
        String.raw`t("a\\b{var0}", { var0: name })`,
      ],
      [
        'newline, tab and carriage return',
        String.raw`t("a\n\tb\r" + name)`,
        String.raw`t("a\n\tb\r{var0}", { var0: name })`,
      ],
      [
        'braces are quoted',
        't("a{b}c" + name)',
        `t("a'{'b'}'c{var0}", { var0: name })`,
      ],
      [
        '} before { are quoted independently',
        't("} { " + name)',
        `t("'}' '{' {var0}", { var0: name })`,
      ],
      [
        'adjacent }{ are quoted independently',
        't("}{ " + name)',
        `t("'}''{' {var0}", { var0: name })`,
      ],
      [
        'lone }',
        't("solo } here " + name)',
        `t("solo '}' here {var0}", { var0: name })`,
      ],
      [
        'lone {',
        't("solo { here " + name)',
        `t("solo '{' here {var0}", { var0: name })`,
      ],
      [
        'apostrophes next to braces',
        `t("a'{b}'c" + name)`,
        `t("a'''{'b'}'''c{var0}", { var0: name })`,
      ],
      // Options merging
      [
        'appended to existing options',
        't("Hi " + name, { $context: "informal", $id: "greeting" })',
        't("Hi {var0}", { $context: "informal", $id: "greeting", var0: name })',
      ],
      [
        'empty options object is replaced',
        't("Hello " + name, {})',
        't("Hello {var0}", { var0: name })',
      ],
      [
        'existing var0 is skipped',
        't("Hello " + name, { var0: existing })',
        't("Hello {var1}", { var0: existing, var1: name })',
      ],
      [
        'several reserved names are skipped',
        't(a + " " + b, { var0: x, var1: y })',
        't("{var2} {var3}", { var0: x, var1: y, var2: a, var3: b })',
      ],
      [
        'a free name below a reserved one is used',
        't("Hello " + name, { var1: existing })',
        't("Hello {var0}", { var1: existing, var0: name })',
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
      ['identifier as second argument: no fix', 't("Hello " + name, opts)'],
      ['spread as second argument: no fix', 't("Hi " + name, ...spread)'],
    ]),
  ],
});

ruleTester.run('static-string: ternary to ICU select', staticString, {
  valid: [],
  invalid: fixes([
    [
      'boolean test',
      't("My name is " + (cond ? "Ernest" : "Brian"))',
      't("My name is {var0, select, true {Ernest} other {Brian}}", { var0: cond })',
    ],
    [
      'in a template literal next to a variable',
      't(`Hello ${name}, you are ${isAdmin ? "admin" : "user"}`)',
      't("Hello {var0}, you are {var1, select, true {admin} other {user}}", { var0: name, var1: isAdmin })',
    ],
    [
      '=== uses the literal as the key',
      't("The user is a " + (gender === "male" ? "boy" : "girl"))',
      't("The user is a {var0, select, male {boy} other {girl}}", { var0: gender })',
    ],
    [
      '==',
      't("val: " + (x == "a" ? "A" : "B"))',
      't("val: {var0, select, a {A} other {B}}", { var0: x })',
    ],
    [
      'literal on the left',
      't("val: " + ("admin" === role ? "Admin" : "User"))',
      't("val: {var0, select, admin {Admin} other {User}}", { var0: role })',
    ],
    [
      'key with hyphens, underscores and digits',
      't("val: " + (x === "valid-key_123" ? "A" : "B"))',
      't("val: {var0, select, valid-key_123 {A} other {B}}", { var0: x })',
    ],
    // Literals that are not valid select keys keep the whole test.
    [
      'key with a space',
      't("val: " + (x === "hello world" ? "A" : "B"))',
      't("val: {var0, select, true {A} other {B}}", { var0: x === "hello world" })',
    ],
    [
      'key with a comma',
      't("val: " + (x === "done,failed" ? "A" : "B"))',
      't("val: {var0, select, true {A} other {B}}", { var0: x === "done,failed" })',
    ],
    [
      'key with braces',
      't("val: " + (x === "a{b}" ? "A" : "B"))',
      't("val: {var0, select, true {A} other {B}}", { var0: x === "a{b}" })',
    ],
    [
      'key with an apostrophe',
      `t("val: " + (x === "it's" ? "A" : "B"))`,
      `t("val: {var0, select, true {A} other {B}}", { var0: x === "it's" })`,
    ],
    [
      'key with a hash',
      't("val: " + (x === "a#b" ? "A" : "B"))',
      't("val: {var0, select, true {A} other {B}}", { var0: x === "a#b" })',
    ],
    [
      'number literal',
      't("val: " + (x === 1 ? "one" : "other"))',
      't("val: {var0, select, true {one} other {other}}", { var0: x === 1 })',
    ],
    // Branch values
    [
      'empty string branch',
      't("prefix" + (cond ? "" : "suffix"))',
      't("prefix{var0, select, true {} other {suffix}}", { var0: cond })',
    ],
    [
      'static template literal branches',
      't("val: " + (cond ? `yes` : `no`))',
      't("val: {var0, select, true {yes} other {no}}", { var0: cond })',
    ],
    [
      '} in a branch value is quoted',
      't("" + (x === "a" ? "val}" : "ok"))',
      `t("{var0, select, a {val'}'} other {ok}}", { var0: x })`,
    ],
    [
      '{ in the other value is quoted',
      't("" + (x === "a" ? "ok" : "val{"))',
      `t("{var0, select, a {ok} other {val'{'}}", { var0: x })`,
    ],
    [
      'apostrophe in a branch value is doubled',
      `t("" + (x === "a" ? "it's" : "ok"))`,
      `t("{var0, select, a {it''s} other {ok}}", { var0: x })`,
    ],
    [
      'dynamic consequent is a plain variable',
      't("val: " + (cond ? getName() : "default"))',
      't("val: {var0}", { var0: cond ? getName() : "default" })',
    ],
    [
      'dynamic alternate is a plain variable',
      't("val: " + (cond ? "yes" : getNo()))',
      't("val: {var0}", { var0: cond ? "yes" : getNo() })',
    ],
    // Chains
    [
      'chain on one variable collapses',
      't("" + (s === "a" ? "A" : s === "b" ? "B" : s === "c" ? "C" : "D"))',
      't("{var0, select, a {A} b {B} c {C} other {D}}", { var0: s })',
    ],
    [
      'chain with a dynamic middle branch is a plain variable',
      't("" + (s === "a" ? "A" : s === "b" ? getB() : "C"))',
      't("{var0}", { var0: s === "a" ? "A" : s === "b" ? getB() : "C" })',
    ],
    [
      'chain ending on another variable nests',
      't("" + (x === "a" ? "A" : x === "b" ? "B" : cond ? "C" : "D"))',
      't("{var0, select, a {A} b {B} other {{var1, select, true {C} other {D}}}}", { var0: x, var1: cond })',
    ],
    [
      'three variables nest three selects',
      't("" + (a === "x" ? "X" : b === "y" ? "Y" : c === "z" ? "Z" : "other"))',
      't("{var0, select, x {X} other {{var1, select, y {Y} other {{var2, select, z {Z} other {other}}}}}}", { var0: a, var1: b, var2: c })',
    ],
    [
      'variable reused in a nested select',
      't("" + (x === "a" ? "A" : y === "b" ? "B" : x === "c" ? "C" : "D"))',
      't("{var0, select, a {A} other {{var1, select, b {B} other {{var0, select, c {C} other {D}}}}}}", { var0: x, var1: y })',
    ],
    [
      'invalid first key nests a select on the same variable',
      't("" + (x === "a b" ? "A" : x === "c" ? "C" : "D"))',
      't("{var0, select, true {A} other {{var1, select, c {C} other {D}}}}", { var0: x === "a b", var1: x })',
    ],
    // Several selects
    [
      'two selects on different variables',
      't("" + (a === "x" ? "X" : "Y") + " " + (b === "p" ? "P" : "Q"))',
      't("{var0, select, x {X} other {Y}} {var1, select, p {P} other {Q}}", { var0: a, var1: b })',
    ],
    [
      'two selects on the same variable',
      't("" + (x === "a" ? "A" : "B") + " and " + (x === "c" ? "C" : "D"))',
      't("{var0, select, a {A} other {B}} and {var0, select, c {C} other {D}}", { var0: x })',
    ],
    [
      'select variable reused as a plain variable',
      't("" + (x === "a" ? "A" : "B") + " " + x)',
      't("{var0, select, a {A} other {B}} {var0}", { var0: x })',
    ],
  ]),
});
