import { RuleTester } from '@typescript-eslint/rule-tester';
import { staticJsx } from '../index.js';

// RuleTester.run() registers its own describe/it blocks (vitest globals), so
// it must be called at the top level. Inside it() the cases never execute.
const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

const errors = (count = 1) =>
  Array.from({ length: count }, () => ({
    messageId: 'dynamicContent' as const,
  }));

/** A module whose component returns `jsx`. */
const component = (imports: string, jsx: string) => `
${imports}
function Component() {
  return ${jsx};
}
`;

/** A module that renders `<T>{children}</T>` with the given GT import. */
const t = (children: string, specifiers = 'T', lib = 'gt-react') =>
  component(`import { ${specifiers} } from '${lib}';`, `<T>${children}</T>`);

type FixRow = [name: string, children: string, fixedChildren: string];

/**
 * Single-pass fixes of `<T>{children}</T>` that start from `import { T }`
 * and end with `fixedSpecifiers` imported.
 */
const fixes = (fixedSpecifiers: string, rows: FixRow[]) =>
  rows.map(([name, children, fixedChildren]) => ({
    name,
    code: t(children),
    output: t(fixedChildren, fixedSpecifiers),
    errors: errors(),
  }));

ruleTester.run('static-jsx: scope', staticJsx, {
  valid: [
    { name: 'static text', code: t('Hello world') },
    {
      name: 'literal and static template expressions',
      code: t('{"hello"} {42} {true} {null} {`hello world`}'),
    },
    {
      name: 'template literal with interpolation is currently allowed',
      code: t('{`Hello ${name}`}'),
    },
    {
      name: 'self-closing T',
      code: component("import { T } from 'gt-react';", '<T />'),
    },
    {
      name: 'static content nested in elements',
      code: t('<div><span>{"hello"}</span></div>'),
    },
    {
      name: 'variable components suppress checking',
      code: t(
        '<Var>{a}</Var> <Num>{b}</Num> <Currency>{c}</Currency> <DateTime>{d}</DateTime>',
        'T, Var, Num, Currency, DateTime'
      ),
    },
    {
      name: 'Derive suppresses checking',
      code: t('<Derive>{cond ? "a" : "b"}</Derive>', 'T, Derive'),
    },
    {
      name: 'aliased T and Var',
      code: component(
        "import { T as Trans, Var as Variable } from 'gt-react';",
        '<Trans><Variable>{name}</Variable></Trans>'
      ),
    },
    {
      name: 'Select: branch prop is not checked, static props',
      code: t(
        '<Select value={gender} male="Mr." female="Ms.">Mx.</Select>',
        'T, Select'
      ),
    },
    {
      name: 'Select prop values may be string literals, JSX or fragments',
      code: t(
        '<Select value={x} a={"hello"} b={<b>bold</b>} c={<>frag</>}>fallback</Select>',
        'T, Select'
      ),
    },
    {
      name: 'Plural: n prop is not checked, static and JSX prop values',
      code: t(
        '<Plural n={count} one="item" two={<b>2 items</b>}>items</Plural>',
        'T, Plural'
      ),
    },
    {
      name: 'Ordinal: n prop is not checked, static and JSX prop values',
      code: t(
        '<Ordinal n={place} one="1st" two={<b>2nd</b>}>nth</Ordinal>',
        'T, Ordinal'
      ),
    },
    {
      name: 'dynamic content outside T',
      code: component(
        "import { T } from 'gt-react';",
        '<div>{name} {cond ? "a" : "b"} {x && "y"}</div>'
      ),
    },
    {
      name: 'dynamic content between sibling T components',
      code: component(
        "import { T } from 'gt-react';",
        '<div><T>Hello</T>{name}<T>World</T></div>'
      ),
    },
    {
      name: 'T from a library outside libs',
      code: t('{name}', 'T', 'some-other-lib'),
      options: [{ libs: ['gt-react'] }],
    },
    {
      name: 'locally declared T',
      code: `
        function T({ children }) { return <div>{children}</div>; }
        const el = <T>{name}</T>;
      `,
    },
    {
      name: 'default import from a GT library',
      code: component("import GT from 'gt-react';", '<GT>{name}</GT>'),
    },
  ],
  invalid: [
    ...fixes('T, Var', [
      ['identifier', '{name}', '<Var>{name}</Var>'],
      ['call expression', '{getLabel()}', '<Var>{getLabel()}</Var>'],
      [
        'inside a nested element',
        '<div>{name}</div>',
        '<div><Var>{name}</Var></div>',
      ],
      ['inside a fragment', '<>{name}</>', '<><Var>{name}</Var></>'],
    ]),
    {
      name: 'inside a nested T',
      code: t('Outer <T>{cond ? "a" : "b"}</T>'),
      output: t(
        'Outer <T><Select value={cond} true="a">b</Select></T>',
        'T, Select'
      ),
      errors: errors(),
    },
    {
      name: 'after a Var closes',
      code: t('<Var>{a}</Var>{b}', 'T, Var'),
      output: t('<Var>{a}</Var><Var>{b}</Var>', 'T, Var'),
      errors: errors(),
    },
    {
      name: 'after a Derive closes',
      code: t('<Derive>{a}</Derive>{b}', 'T, Derive'),
      output: t('<Derive>{a}</Derive><Var>{b}</Var>', 'T, Derive, Var'),
      errors: errors(),
    },
    {
      name: 'Var from another library is not a variable component',
      code: component(
        "import { T } from 'gt-react';\nimport { Var } from 'some-other-library';",
        '<T><Var>{name}</Var></T>'
      ),
      output: component(
        "import { T, Var } from 'gt-react';\nimport { Var } from 'some-other-library';",
        '<T><Var><Var>{name}</Var></Var></T>'
      ),
      errors: errors(),
    },
    {
      name: 'ternary in a Select prop value',
      code: t(
        '<Select value={x} a={cond ? "one" : "two"}>fallback</Select>',
        'T, Select'
      ),
      output: t(
        '<Select value={x} a={<Select value={cond} true="one">two</Select>}>fallback</Select>',
        'T, Select'
      ),
      errors: errors(),
    },
    {
      name: 'identifier in a Select prop value',
      code: t('<Select value={x} a={label}>fallback</Select>', 'T, Select'),
      output: t(
        '<Select value={x} a={<Var>{label}</Var>}>fallback</Select>',
        'T, Select, Var'
      ),
      errors: errors(),
    },
    {
      name: 'identifier in a Plural prop value',
      code: t('<Plural n={n} one={label}>items</Plural>', 'T, Plural'),
      output: t(
        '<Plural n={n} one={<Var>{label}</Var>}>items</Plural>',
        'T, Plural, Var'
      ),
      errors: errors(),
    },
    {
      name: 'identifier in an Ordinal prop value',
      code: t('<Ordinal n={n} one={label}>nth</Ordinal>', 'T, Ordinal'),
      output: t(
        '<Ordinal n={n} one={<Var>{label}</Var>}>nth</Ordinal>',
        'T, Ordinal, Var'
      ),
      errors: errors(),
    },
  ],
});

ruleTester.run('static-jsx: imports', staticJsx, {
  valid: [],
  invalid: [
    {
      name: 'Var already imported',
      code: t('{name}', 'T, Var'),
      output: t('<Var>{name}</Var>', 'T, Var'),
      errors: errors(),
    },
    {
      name: 'aliased Var',
      code: t('{name}', 'T, Var as V'),
      output: t('<V>{name}</V>', 'T, Var as V'),
      errors: errors(),
    },
    {
      name: 'aliased Var in a second GT import',
      code: component(
        "import { T } from 'gt-react';\nimport { Var as Variable } from 'gt-next';",
        '<T>{name}</T>'
      ),
      output: component(
        "import { T } from 'gt-react';\nimport { Var as Variable } from 'gt-next';",
        '<T><Variable>{name}</Variable></T>'
      ),
      options: [{ libs: ['gt-react', 'gt-next'] }],
      errors: errors(),
    },
    {
      name: 'Select already imported',
      code: t('{cond ? "yes" : "no"}', 'T, Select'),
      output: t('<Select value={cond} true="yes">no</Select>', 'T, Select'),
      errors: errors(),
    },
    {
      name: 'aliased Select for a ternary',
      code: t('{cond ? "yes" : "no"}', 'T, Select as B'),
      output: t('<B value={cond} true="yes">no</B>', 'T, Select as B'),
      errors: errors(),
    },
    {
      name: 'aliased Select for a logical AND',
      code: t('{active && "Active"}', 'T, Select as If'),
      output: t(
        '<If value={!!active} true="Active">{null}</If>',
        'T, Select as If'
      ),
      errors: errors(),
    },
    {
      name: 'Select in a separate GT import',
      code: component(
        "import { T } from 'gt-react';\nimport { Select } from 'gt-react';",
        '<T>{cond ? "a" : "b"}</T>'
      ),
      output: component(
        "import { T } from 'gt-react';\nimport { Select } from 'gt-react';",
        '<T><Select value={cond} true="a">b</Select></T>'
      ),
      errors: errors(),
    },
    {
      name: 'appended after the last specifier, including type specifiers',
      code: t('{name}', 'T, type SomeType'),
      output: t('<Var>{name}</Var>', 'T, type SomeType, Var'),
      errors: errors(),
    },
    {
      name: 'aliased T',
      code: component(
        "import { T as Trans } from 'gt-react';",
        '<Trans>{cond ? "a" : "b"}</Trans>'
      ),
      output: component(
        "import { T as Trans, Select } from 'gt-react';",
        '<Trans><Select value={cond} true="a">b</Select></Trans>'
      ),
      errors: errors(),
    },
    {
      name: 'only the GT import is edited',
      code: component(
        "import React from 'react';\nimport { T } from 'gt-react';\nimport { useState } from 'react';",
        '<T>{cond ? "a" : "b"}</T>'
      ),
      output: component(
        "import React from 'react';\nimport { T, Select } from 'gt-react';\nimport { useState } from 'react';",
        '<T><Select value={cond} true="a">b</Select></T>'
      ),
      errors: errors(),
    },
    {
      name: 'explicit libs option',
      code: t('{name}', 'T', 'gt-next'),
      output: t('<Var>{name}</Var>', 'T, Var', 'gt-next'),
      options: [{ libs: ['gt-next'] }],
      errors: errors(),
    },
    {
      name: 'import from the second configured lib',
      code: t('{name}', 'T', 'gt-next'),
      output: t('<Var>{name}</Var>', 'T, Var', 'gt-next'),
      options: [{ libs: ['gt-react', 'gt-next'] }],
      errors: errors(),
    },
    {
      name: 'default libs include @generaltranslation/react-core/components',
      code: t('{name}', 'T', '@generaltranslation/react-core/components'),
      output: t(
        '<Var>{name}</Var>',
        'T, Var',
        '@generaltranslation/react-core/components'
      ),
      errors: errors(),
    },
    {
      name: 'two ternaries: Select import added once, one fix per pass',
      code: t('{a ? "x" : "y"}{b ? "m" : "n"}'),
      output: [
        t('<Select value={a} true="x">y</Select>{b ? "m" : "n"}', 'T, Select'),
        t(
          '<Select value={a} true="x">y</Select><Select value={b} true="m">n</Select>',
          'T, Select'
        ),
      ],
      errors: errors(2),
    },
    {
      name: 'Var, Select, Var: each import added on its own pass',
      code: t('{a}{cond ? "x" : "y"}{b}'),
      output: [
        t('<Var>{a}</Var>{cond ? "x" : "y"}{b}', 'T, Var'),
        t(
          '<Var>{a}</Var><Select value={cond} true="x">y</Select>{b}',
          'T, Var, Select'
        ),
        t(
          '<Var>{a}</Var><Select value={cond} true="x">y</Select><Var>{b}</Var>',
          'T, Var, Select'
        ),
      ],
      errors: errors(3),
    },
    {
      name: 'Var added to the React import after a core import',
      code: component(
        "import { formatNum } from 'generaltranslation';\nimport { T } from 'gt-react';",
        '<T>{name}</T>'
      ),
      output: component(
        "import { formatNum } from 'generaltranslation';\nimport { T, Var } from 'gt-react';",
        '<T><Var>{name}</Var></T>'
      ),
      errors: errors(),
    },
    {
      name: 'Var added to the native import after compat and type-only imports',
      code: component(
        "import { useTranslations } from 'gt-react/compat';\nimport type { GTProviderProps } from 'gt-react';\nimport { T } from 'gt-react';",
        '<T>{name}</T>'
      ),
      output: component(
        "import { useTranslations } from 'gt-react/compat';\nimport type { GTProviderProps } from 'gt-react';\nimport { T, Var } from 'gt-react';",
        '<T><Var>{name}</Var></T>'
      ),
      options: [{ libs: ['gt-react'] }],
      errors: errors(),
    },
    {
      name: 'Select added to the native import after a compat import',
      code: component(
        "import { useTranslations } from 'gt-next/compat';\nimport { T } from 'gt-next';",
        '<T>{cond ? "yes" : "no"}</T>'
      ),
      output: component(
        "import { useTranslations } from 'gt-next/compat';\nimport { T, Select } from 'gt-next';",
        '<T><Select value={cond} true="yes">no</Select></T>'
      ),
      options: [{ libs: ['gt-next'] }],
      errors: errors(),
    },
  ],
});

ruleTester.run('static-jsx: ternary to Select', staticJsx, {
  valid: [],
  invalid: [
    ...fixes('T, Select', [
      [
        'string branches',
        '{cond ? "yes" : "no"}',
        '<Select value={cond} true="yes">no</Select>',
      ],
      [
        'surrounding text is preserved',
        'Hello {cond ? "world" : "there"} bye',
        'Hello <Select value={cond} true="world">there</Select> bye',
      ],
      [
        'inside a nested element',
        '<p>{cond ? "a" : "b"}</p>',
        '<p><Select value={cond} true="a">b</Select></p>',
      ],
      [
        'static template literal branches',
        '{cond ? `hello` : `world`}',
        '<Select value={cond} true="hello">world</Select>',
      ],
      [
        'JSX element branches',
        '{cond ? <b>Bold</b> : <i>Italic</i>}',
        '<Select value={cond} true={<b>Bold</b>}><i>Italic</i></Select>',
      ],
      [
        'fragment branches',
        '{cond ? <>yes</> : <>no</>}',
        '<Select value={cond} true={<>yes</>}><>no</></Select>',
      ],
      [
        'attribute expressions inside a JSX branch are not reported',
        '{cond ? <a href={url}>Link</a> : "text"}',
        '<Select value={cond} true={<a href={url}>Link</a>}>text</Select>',
      ],
      [
        'null alternate is braced children',
        '{cond ? "visible" : null}',
        '<Select value={cond} true="visible">{null}</Select>',
      ],
      [
        'null consequent is a braced prop value',
        '{cond ? null : "text"}',
        '<Select value={cond} true={null}>text</Select>',
      ],
      [
        'non-string literal alternate is braced',
        '{cond ? "text" : 42}',
        '<Select value={cond} true="text">{42}</Select>',
      ],
      [
        'empty string alternate',
        '{cond ? "yes" : ""}',
        '<Select value={cond} true="yes">{""}</Select>',
      ],
      [
        'empty string consequent',
        '{cond ? "" : "fallback"}',
        '<Select value={cond} true="">fallback</Select>',
      ],
      [
        'apostrophes need no escaping',
        `{cond ? "it's" : "they're"}`,
        `<Select value={cond} true="it's">they're</Select>`,
      ],
      [
        'double quotes, & and < are braced',
        String.raw`{cond ? "say \"hi\"" : "a & b < c"}`,
        String.raw`<Select value={cond} true={"say \"hi\""}>{"a & b < c"}</Select>`,
      ],
      [
        'an entity is braced, so it stays text',
        '{cond ? "yes" : "&amp;"}',
        '<Select value={cond} true="yes">{"&amp;"}</Select>',
      ],
      [
        'curly braces are braced as children',
        '{cond ? "{value}" : "{braces}"}',
        '<Select value={cond} true="{value}">{"{braces}"}</Select>',
      ],
      [
        'escape sequences are written as their cooked value',
        String.raw`{cond ? "path\\to\\file" : "other"}`,
        String.raw`<Select value={cond} true="path\to\file">other</Select>`,
      ],
      [
        'a tab is braced, as JSX text would read it as a space',
        String.raw`{cond ? "yes" : "a\tb"}`,
        String.raw`<Select value={cond} true="yes">{"a\tb"}</Select>`,
      ],
      [
        'a carriage return is braced, as JSX text would read it as a space',
        String.raw`{cond ? "yes" : "a\rb"}`,
        String.raw`<Select value={cond} true="yes">{"a\rb"}</Select>`,
      ],
      [
        'nested ternary in the consequent',
        '{a ? (b ? "x" : "y") : "z"}',
        '<Select value={a} true={<Select value={b} true="x">y</Select>}>z</Select>',
      ],
      [
        'nested ternary in the alternate',
        '{a ? "x" : b ? "y" : "z"}',
        '<Select value={a} true="x"><Select value={b} true="y">z</Select></Select>',
      ],
      [
        'logical AND in the alternate',
        '{cond ? "a" : x && "b"}',
        '<Select value={cond} true="a"><Select value={!!x} true="b">{null}</Select></Select>',
      ],
    ]),
    ...fixes('T, Var', [
      ['both branches dynamic', '{cond ? a : b}', '<Var>{cond ? a : b}</Var>'],
      [
        'both branches non-string literals',
        '{cond ? 42 : null}',
        '<Var>{cond ? 42 : null}</Var>',
      ],
    ]),
    {
      name: 'dynamic alternate becomes children, then Var',
      code: t('{cond ? "hello" : label}'),
      output: [
        t('<Select value={cond} true="hello">{label}</Select>', 'T, Select'),
        t(
          '<Select value={cond} true="hello"><Var>{label}</Var></Select>',
          'T, Select, Var'
        ),
      ],
      errors: errors(),
    },
    {
      name: 'dynamic consequent becomes a prop, then Var',
      code: t('{cond ? getLabel() : "default"}'),
      output: [
        t(
          '<Select value={cond} true={getLabel()}>default</Select>',
          'T, Select'
        ),
        t(
          '<Select value={cond} true={<Var>{getLabel()}</Var>}>default</Select>',
          'T, Select, Var'
        ),
      ],
      errors: errors(),
    },
    {
      name: 'dynamic content inside a JSX value: Var first, then Select',
      code: t('{cond ? <span>{name}</span> : <span>Guest</span>}'),
      output: [
        t(
          '{cond ? <span><Var>{name}</Var></span> : <span>Guest</span>}',
          'T, Var'
        ),
        t(
          '<Select value={cond} true={<span><Var>{name}</Var></span>}><span>Guest</span></Select>',
          'T, Var, Select'
        ),
      ],
      errors: errors(2),
    },
  ],
});

ruleTester.run('static-jsx: ternary test to branch prop', staticJsx, {
  valid: [],
  invalid: fixes('T, Select', [
    // Equality against a literal: the literal becomes the prop name.
    [
      '===',
      '{status === "active" ? "on" : "off"}',
      '<Select value={status} active="on">off</Select>',
    ],
    [
      '==',
      '{status == "active" ? "on" : "off"}',
      '<Select value={status} active="on">off</Select>',
    ],
    [
      '!== swaps the branches',
      '{status !== "active" ? "other" : "on"}',
      '<Select value={status} active="on">other</Select>',
    ],
    [
      '!= swaps the branches',
      '{status != "active" ? "other" : "on"}',
      '<Select value={status} active="on">other</Select>',
    ],
    [
      'literal on the left',
      '{"active" === status ? "on" : "off"}',
      '<Select value={status} active="on">off</Select>',
    ],
    [
      'literal on the left with !==',
      '{"active" !== status ? "other" : "on"}',
      '<Select value={status} active="on">other</Select>',
    ],
    [
      'boolean literal',
      '{x === false ? "off" : "on"}',
      '<Select value={x} false="off">on</Select>',
    ],
    [
      'hyphenated literal',
      '{x === "my-value" ? "a" : "b"}',
      '<Select value={x} my-value="a">b</Select>',
    ],
    [
      'underscore-prefixed literal',
      '{x === "_private" ? "a" : "b"}',
      '<Select value={x} _private="a">b</Select>',
    ],
    [
      'dollar-prefixed literal',
      '{x === "$price" ? "a" : "b"}',
      '<Select value={x} $price="a">b</Select>',
    ],
    [
      'optional member expression operand',
      '{user?.role === "admin" ? "yes" : "no"}',
      '<Select value={user?.role} admin="yes">no</Select>',
    ],
    [
      'typeof operand',
      '{typeof x === "string" ? "text" : "other"}',
      '<Select value={typeof x} string="text">other</Select>',
    ],
    [
      '!== with JSX branches',
      '{role !== "admin" ? <i>User</i> : <b>Admin</b>}',
      '<Select value={role} admin={<b>Admin</b>}><i>User</i></Select>',
    ],
    [
      '!== with null alternate puts null in the prop',
      '{status !== "active" ? "other" : null}',
      '<Select value={status} active={null}>other</Select>',
    ],
    // Literals that are not valid JSX prop names keep the whole test.
    [
      'the literal "other" would be the fallback branch',
      '{x === "other" ? "a" : "b"}',
      '<Select value={x === "other"} true="a">b</Select>',
    ],
    [
      'number literal',
      '{x === 42 ? "a" : "b"}',
      '<Select value={x === 42} true="a">b</Select>',
    ],
    [
      'empty string',
      '{x === "" ? "empty" : "full"}',
      '<Select value={x === ""} true="empty">full</Select>',
    ],
    [
      'string starting with a digit',
      '{x === "42" ? "a" : "b"}',
      '<Select value={x === "42"} true="a">b</Select>',
    ],
    [
      'string starting with a hyphen',
      '{x === "-invalid" ? "a" : "b"}',
      '<Select value={x === "-invalid"} true="a">b</Select>',
    ],
    [
      'string with a space',
      '{x === "hello world" ? "a" : "b"}',
      '<Select value={x === "hello world"} true="a">b</Select>',
    ],
    [
      'null literal',
      '{x === null ? "none" : "some"}',
      '<Select value={x === null} true="none">some</Select>',
    ],
    [
      '!== null does not swap',
      '{x !== null ? "present" : "absent"}',
      '<Select value={x !== null} true="present">absent</Select>',
    ],
    // Operands that are not Literal nodes keep the whole test.
    [
      'negative number',
      '{x === -1 ? "a" : "b"}',
      '<Select value={x === -1} true="a">b</Select>',
    ],
    [
      'template literal',
      '{x === `val` ? "a" : "b"}',
      '<Select value={x === `val`} true="a">b</Select>',
    ],
    // Other tests keep the whole test.
    [
      'relational operator',
      '{x > 0 ? "positive" : "non-positive"}',
      '<Select value={x > 0} true="positive">non-positive</Select>',
    ],
    [
      'logical expression',
      '{x === "a" && y === "b" ? "both" : "nope"}',
      '<Select value={x === "a" && y === "b"} true="both">nope</Select>',
    ],
    // Negation is unwrapped and swaps the branches.
    [
      'negation',
      '{!cond ? "no" : "yes"}',
      '<Select value={cond} true="yes">no</Select>',
    ],
    [
      'double negation',
      '{!!cond ? "yes" : "no"}',
      '<Select value={cond} true="yes">no</Select>',
    ],
    [
      'negated equality',
      '{!(x === "val") ? "a" : "b"}',
      '<Select value={x} val="b">a</Select>',
    ],
    [
      'negated inequality',
      '{!(x !== "val") ? "a" : "b"}',
      '<Select value={x} val="a">b</Select>',
    ],
  ]),
});

ruleTester.run('static-jsx: chained ternaries', staticJsx, {
  valid: [],
  invalid: [
    ...fixes('T, Select', [
      [
        'same variable collapses into one Select',
        '{color === "red" ? "Red" : color === "green" ? "Green" : color === "blue" ? "Blue" : "Other"}',
        '<Select value={color} red="Red" green="Green" blue="Blue">Other</Select>',
      ],
      [
        'collapsed JSX values',
        '{role === "admin" ? <b>Admin</b> : role === "editor" ? <i>Editor</i> : <span>Viewer</span>}',
        '<Select value={role} admin={<b>Admin</b>} editor={<i>Editor</i>}><span>Viewer</span></Select>',
      ],
      [
        'collapsed with null fallback is self-closing',
        '{x === "a" ? "Alpha" : x === "b" ? "Beta" : null}',
        '<Select value={x} a="Alpha" b="Beta">{null}</Select>',
      ],
      [
        'outer !== swaps before collapsing',
        '{x !== "a" ? x === "b" ? "B" : "other" : "A"}',
        '<Select value={x} a="A" b="B">other</Select>',
      ],
      [
        'inner !== swaps while collapsing',
        '{x === "a" ? "A" : x !== "b" ? "other" : "B"}',
        '<Select value={x} a="A" b="B">other</Select>',
      ],
      [
        'different variables nest',
        '{a === "x" ? "X" : b === "y" ? "Y" : "Z"}',
        '<Select value={a} x="X"><Select value={b} y="Y">Z</Select></Select>',
      ],
      [
        'numeric comparisons nest because the tests differ',
        '{count === 0 ? "none" : count === 1 ? "one" : "many"}',
        '<Select value={count === 0} true="none"><Select value={count === 1} true="one">many</Select></Select>',
      ],
      [
        'invalid first prop name nests',
        '{x === 42 ? "forty-two" : x === "b" ? "B" : "other"}',
        '<Select value={x === 42} true="forty-two"><Select value={x} b="B">other</Select></Select>',
      ],
      [
        'collapses until the variable changes',
        '{x === "a" ? "A" : x === "b" ? "B" : y === "c" ? "C" : "D"}',
        '<Select value={x} a="A" b="B"><Select value={y} c="C">D</Select></Select>',
      ],
    ]),
    {
      name: 'dynamic fallback becomes children, then Var',
      code: t('{x === "a" ? "A" : x === "b" ? "B" : fallback}'),
      output: [
        t('<Select value={x} a="A" b="B">{fallback}</Select>', 'T, Select'),
        t(
          '<Select value={x} a="A" b="B"><Var>{fallback}</Var></Select>',
          'T, Select, Var'
        ),
      ],
      errors: errors(),
    },
    {
      name: 'inner ternary without translatable content is not collapsed',
      code: t('{x === "one" ? "One" : x === "two" ? a : b}'),
      output: [
        t(
          '<Select value={x} one="One">{x === "two" ? a : b}</Select>',
          'T, Select'
        ),
        t(
          '<Select value={x} one="One"><Var>{x === "two" ? a : b}</Var></Select>',
          'T, Select, Var'
        ),
      ],
      errors: errors(),
    },
  ],
});

ruleTester.run('static-jsx: logical expressions', staticJsx, {
  valid: [],
  invalid: [
    ...fixes('T, Select', [
      [
        'AND with a string',
        '{x && "text"}',
        '<Select value={!!x} true="text">{null}</Select>',
      ],
      [
        'AND with a JSX element',
        '{x && <div>Content</div>}',
        '<Select value={!!x} true={<div>Content</div>}>{null}</Select>',
      ],
      [
        'AND with a fragment',
        '{x && <>Fragment content</>}',
        '<Select value={!!x} true={<>Fragment content</>}>{null}</Select>',
      ],
      [
        'AND with a static template literal',
        '{x && `hello`}',
        '<Select value={!!x} true="hello">{null}</Select>',
      ],
      [
        'AND with an empty string',
        '{x && ""}',
        '<Select value={!!x} true="">{null}</Select>',
      ],
      [
        'AND with a nested ternary',
        '{show && (type === "a" ? "Alpha" : "Beta")}',
        '<Select value={!!show} true={<Select value={type} a="Alpha">Beta</Select>}>{null}</Select>',
      ],
      [
        'AND with a nested AND',
        '{x && (y && "nested")}',
        '<Select value={!!x} true={<Select value={!!y} true="nested">{null}</Select>}>{null}</Select>',
      ],
      // The left side is prefixed with !! as written, without parentheses.
      [
        'chained AND',
        '{a && b && "both"}',
        '<Select value={!!a && b} true="both">{null}</Select>',
      ],
      [
        'comparison on the left',
        '{count > 0 && "Has items"}',
        '<Select value={!!count > 0} true="Has items">{null}</Select>',
      ],
      [
        'parenthesized OR on the left',
        '{(a || b) && "text"}',
        '<Select value={!!a || b} true="text">{null}</Select>',
      ],
    ]),
    ...fixes('T, Var', [
      [
        'AND with a dynamic right side',
        '{x && someVar}',
        '<Var>{x && someVar}</Var>',
      ],
      ['AND with a non-string literal', '{x && 42}', '<Var>{x && 42}</Var>'],
      [
        'AND with an interpolated template literal',
        '{x && `hello ${name}`}',
        '<Var>{x && `hello ${name}`}</Var>',
      ],
      ['OR with a string', '{x || "fallback"}', '<Var>{x || "fallback"}</Var>'],
      [
        'nullish coalescing with a string',
        '{x ?? "default"}',
        '<Var>{x ?? "default"}</Var>',
      ],
    ]),
    {
      name: 'AND with dynamic content inside JSX: Var first, then Select',
      code: t('{x && <span>{name}</span>}'),
      output: [
        t('{x && <span><Var>{name}</Var></span>}', 'T, Var'),
        t(
          '<Select value={!!x} true={<span><Var>{name}</Var></span>}>{null}</Select>',
          'T, Var, Select'
        ),
      ],
      errors: errors(2),
    },
  ],
});
