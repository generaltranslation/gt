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
      name: 'Branch: branch prop is not checked, static props and children',
      code: t(
        '<Branch branch={gender} male="Mr." female="Ms.">Mx.</Branch>',
        'T, Branch'
      ),
    },
    {
      name: 'Branch prop values may be string literals, JSX or fragments',
      code: t(
        '<Branch branch={x} a={"hello"} b={<b>bold</b>} c={<>frag</>}>fallback</Branch>',
        'T, Branch'
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
        'Outer <T><Branch branch={cond} true="a">b</Branch></T>',
        'T, Branch'
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
      name: 'ternary in a Branch prop value',
      code: t(
        '<Branch branch={x} a={cond ? "one" : "two"}>fallback</Branch>',
        'T, Branch'
      ),
      output: t(
        '<Branch branch={x} a=<Branch branch={cond} true="one">two</Branch>>fallback</Branch>',
        'T, Branch'
      ),
      errors: errors(),
    },
    {
      name: 'identifier in a Branch prop value',
      code: t('<Branch branch={x} a={label}>fallback</Branch>', 'T, Branch'),
      output: t(
        '<Branch branch={x} a=<Var>{label}</Var>>fallback</Branch>',
        'T, Branch, Var'
      ),
      errors: errors(),
    },
    {
      name: 'identifier in a Plural prop value',
      code: t('<Plural n={n} one={label}>items</Plural>', 'T, Plural'),
      output: t(
        '<Plural n={n} one=<Var>{label}</Var>>items</Plural>',
        'T, Plural, Var'
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
      name: 'Branch already imported',
      code: t('{cond ? "yes" : "no"}', 'T, Branch'),
      output: t('<Branch branch={cond} true="yes">no</Branch>', 'T, Branch'),
      errors: errors(),
    },
    {
      name: 'aliased Branch for a ternary',
      code: t('{cond ? "yes" : "no"}', 'T, Branch as B'),
      output: t('<B branch={cond} true="yes">no</B>', 'T, Branch as B'),
      errors: errors(),
    },
    {
      name: 'aliased Branch for a logical AND',
      code: t('{active && "Active"}', 'T, Branch as If'),
      output: t('<If branch={!!active} true="Active" />', 'T, Branch as If'),
      errors: errors(),
    },
    {
      name: 'Branch in a separate GT import',
      code: component(
        "import { T } from 'gt-react';\nimport { Branch } from 'gt-react';",
        '<T>{cond ? "a" : "b"}</T>'
      ),
      output: component(
        "import { T } from 'gt-react';\nimport { Branch } from 'gt-react';",
        '<T><Branch branch={cond} true="a">b</Branch></T>'
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
        "import { T as Trans, Branch } from 'gt-react';",
        '<Trans><Branch branch={cond} true="a">b</Branch></Trans>'
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
        "import React from 'react';\nimport { T, Branch } from 'gt-react';\nimport { useState } from 'react';",
        '<T><Branch branch={cond} true="a">b</Branch></T>'
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
      name: 'two ternaries: Branch import added once, one fix per pass',
      code: t('{a ? "x" : "y"}{b ? "m" : "n"}'),
      output: [
        t('<Branch branch={a} true="x">y</Branch>{b ? "m" : "n"}', 'T, Branch'),
        t(
          '<Branch branch={a} true="x">y</Branch><Branch branch={b} true="m">n</Branch>',
          'T, Branch'
        ),
      ],
      errors: errors(2),
    },
    {
      name: 'Var, Branch, Var: each import added on its own pass',
      code: t('{a}{cond ? "x" : "y"}{b}'),
      output: [
        t('<Var>{a}</Var>{cond ? "x" : "y"}{b}', 'T, Var'),
        t(
          '<Var>{a}</Var><Branch branch={cond} true="x">y</Branch>{b}',
          'T, Var, Branch'
        ),
        t(
          '<Var>{a}</Var><Branch branch={cond} true="x">y</Branch><Var>{b}</Var>',
          'T, Var, Branch'
        ),
      ],
      errors: errors(3),
    },
  ],
});

ruleTester.run('static-jsx: ternary to Branch', staticJsx, {
  valid: [],
  invalid: [
    ...fixes('T, Branch', [
      [
        'string branches',
        '{cond ? "yes" : "no"}',
        '<Branch branch={cond} true="yes">no</Branch>',
      ],
      [
        'surrounding text is preserved',
        'Hello {cond ? "world" : "there"} bye',
        'Hello <Branch branch={cond} true="world">there</Branch> bye',
      ],
      [
        'inside a nested element',
        '<p>{cond ? "a" : "b"}</p>',
        '<p><Branch branch={cond} true="a">b</Branch></p>',
      ],
      [
        'static template literal branches',
        '{cond ? `hello` : `world`}',
        '<Branch branch={cond} true="hello">world</Branch>',
      ],
      [
        'JSX element branches',
        '{cond ? <b>Bold</b> : <i>Italic</i>}',
        '<Branch branch={cond} true={<b>Bold</b>}><i>Italic</i></Branch>',
      ],
      [
        'fragment branches',
        '{cond ? <>yes</> : <>no</>}',
        '<Branch branch={cond} true={<>yes</>}><>no</></Branch>',
      ],
      [
        'attribute expressions inside a JSX branch are not reported',
        '{cond ? <a href={url}>Link</a> : "text"}',
        '<Branch branch={cond} true={<a href={url}>Link</a>}>text</Branch>',
      ],
      [
        'null alternate is a self-closing Branch',
        '{cond ? "visible" : null}',
        '<Branch branch={cond} true="visible" />',
      ],
      [
        'null consequent is a braced prop value',
        '{cond ? null : "text"}',
        '<Branch branch={cond} true={null}>text</Branch>',
      ],
      [
        'non-string literal alternate is braced children',
        '{cond ? "text" : 42}',
        '<Branch branch={cond} true="text">{42}</Branch>',
      ],
      [
        'empty string alternate',
        '{cond ? "yes" : ""}',
        '<Branch branch={cond} true="yes"></Branch>',
      ],
      [
        'empty string consequent',
        '{cond ? "" : "fallback"}',
        '<Branch branch={cond} true="">fallback</Branch>',
      ],
      [
        'apostrophes need no escaping',
        `{cond ? "it's" : "they're"}`,
        `<Branch branch={cond} true="it's">they're</Branch>`,
      ],
      [
        'double quotes in the prop, & and < in children are escaped',
        String.raw`{cond ? "say \"hi\"" : "a & b < c"}`,
        String.raw`<Branch branch={cond} true={"say \"hi\""}>a &amp; b &lt; c</Branch>`,
      ],
      [
        'curly braces are kept in the prop and escaped in children',
        '{cond ? "{value}" : "{braces}"}',
        '<Branch branch={cond} true="{value}">&#123;braces&#125;</Branch>',
      ],
      [
        'escape sequences are written as their cooked value',
        String.raw`{cond ? "path\\to\\file" : "other"}`,
        String.raw`<Branch branch={cond} true="path\to\file">other</Branch>`,
      ],
      [
        'nested ternary in the consequent',
        '{a ? (b ? "x" : "y") : "z"}',
        '<Branch branch={a} true={<Branch branch={b} true="x">y</Branch>}>z</Branch>',
      ],
      [
        'nested ternary in the alternate',
        '{a ? "x" : b ? "y" : "z"}',
        '<Branch branch={a} true="x"><Branch branch={b} true="y">z</Branch></Branch>',
      ],
      [
        'logical AND in the alternate',
        '{cond ? "a" : x && "b"}',
        '<Branch branch={cond} true="a"><Branch branch={!!x} true="b" /></Branch>',
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
        t('<Branch branch={cond} true="hello">{label}</Branch>', 'T, Branch'),
        t(
          '<Branch branch={cond} true="hello"><Var>{label}</Var></Branch>',
          'T, Branch, Var'
        ),
      ],
      errors: errors(),
    },
    {
      name: 'dynamic consequent becomes a prop, then Var',
      code: t('{cond ? getLabel() : "default"}'),
      output: [
        t(
          '<Branch branch={cond} true={getLabel()}>default</Branch>',
          'T, Branch'
        ),
        t(
          '<Branch branch={cond} true=<Var>{getLabel()}</Var>>default</Branch>',
          'T, Branch, Var'
        ),
      ],
      errors: errors(),
    },
    {
      name: 'dynamic content inside a JSX branch: Var first, then Branch',
      code: t('{cond ? <span>{name}</span> : <span>Guest</span>}'),
      output: [
        t(
          '{cond ? <span><Var>{name}</Var></span> : <span>Guest</span>}',
          'T, Var'
        ),
        t(
          '<Branch branch={cond} true={<span><Var>{name}</Var></span>}><span>Guest</span></Branch>',
          'T, Var, Branch'
        ),
      ],
      errors: errors(2),
    },
  ],
});

ruleTester.run('static-jsx: ternary test to branch prop', staticJsx, {
  valid: [],
  invalid: fixes('T, Branch', [
    // Equality against a literal: the literal becomes the prop name.
    [
      '===',
      '{status === "active" ? "on" : "off"}',
      '<Branch branch={status} active="on">off</Branch>',
    ],
    [
      '==',
      '{status == "active" ? "on" : "off"}',
      '<Branch branch={status} active="on">off</Branch>',
    ],
    [
      '!== swaps the branches',
      '{status !== "active" ? "other" : "on"}',
      '<Branch branch={status} active="on">other</Branch>',
    ],
    [
      '!= swaps the branches',
      '{status != "active" ? "other" : "on"}',
      '<Branch branch={status} active="on">other</Branch>',
    ],
    [
      'literal on the left',
      '{"active" === status ? "on" : "off"}',
      '<Branch branch={status} active="on">off</Branch>',
    ],
    [
      'literal on the left with !==',
      '{"active" !== status ? "other" : "on"}',
      '<Branch branch={status} active="on">other</Branch>',
    ],
    [
      'boolean literal',
      '{x === false ? "off" : "on"}',
      '<Branch branch={x} false="off">on</Branch>',
    ],
    [
      'hyphenated literal',
      '{x === "my-value" ? "a" : "b"}',
      '<Branch branch={x} my-value="a">b</Branch>',
    ],
    [
      'underscore-prefixed literal',
      '{x === "_private" ? "a" : "b"}',
      '<Branch branch={x} _private="a">b</Branch>',
    ],
    [
      'dollar-prefixed literal',
      '{x === "$price" ? "a" : "b"}',
      '<Branch branch={x} $price="a">b</Branch>',
    ],
    [
      'optional member expression operand',
      '{user?.role === "admin" ? "yes" : "no"}',
      '<Branch branch={user?.role} admin="yes">no</Branch>',
    ],
    [
      'typeof operand',
      '{typeof x === "string" ? "text" : "other"}',
      '<Branch branch={typeof x} string="text">other</Branch>',
    ],
    [
      '!== with JSX branches',
      '{role !== "admin" ? <i>User</i> : <b>Admin</b>}',
      '<Branch branch={role} admin={<b>Admin</b>}><i>User</i></Branch>',
    ],
    [
      '!== with null alternate puts null in the prop',
      '{status !== "active" ? "other" : null}',
      '<Branch branch={status} active={null}>other</Branch>',
    ],
    // Literals that are not valid JSX prop names keep the whole test.
    [
      'number literal',
      '{x === 42 ? "a" : "b"}',
      '<Branch branch={x === 42} true="a">b</Branch>',
    ],
    [
      'empty string',
      '{x === "" ? "empty" : "full"}',
      '<Branch branch={x === ""} true="empty">full</Branch>',
    ],
    [
      'string starting with a digit',
      '{x === "42" ? "a" : "b"}',
      '<Branch branch={x === "42"} true="a">b</Branch>',
    ],
    [
      'string starting with a hyphen',
      '{x === "-invalid" ? "a" : "b"}',
      '<Branch branch={x === "-invalid"} true="a">b</Branch>',
    ],
    [
      'string with a space',
      '{x === "hello world" ? "a" : "b"}',
      '<Branch branch={x === "hello world"} true="a">b</Branch>',
    ],
    [
      'null literal',
      '{x === null ? "none" : "some"}',
      '<Branch branch={x === null} true="none">some</Branch>',
    ],
    [
      '!== null does not swap',
      '{x !== null ? "present" : "absent"}',
      '<Branch branch={x !== null} true="present">absent</Branch>',
    ],
    // Operands that are not Literal nodes keep the whole test.
    [
      'negative number',
      '{x === -1 ? "a" : "b"}',
      '<Branch branch={x === -1} true="a">b</Branch>',
    ],
    [
      'template literal',
      '{x === `val` ? "a" : "b"}',
      '<Branch branch={x === `val`} true="a">b</Branch>',
    ],
    // Other tests keep the whole test.
    [
      'relational operator',
      '{x > 0 ? "positive" : "non-positive"}',
      '<Branch branch={x > 0} true="positive">non-positive</Branch>',
    ],
    [
      'logical expression',
      '{x === "a" && y === "b" ? "both" : "nope"}',
      '<Branch branch={x === "a" && y === "b"} true="both">nope</Branch>',
    ],
    // Negation is unwrapped and swaps the branches.
    [
      'negation',
      '{!cond ? "no" : "yes"}',
      '<Branch branch={cond} true="yes">no</Branch>',
    ],
    [
      'double negation',
      '{!!cond ? "yes" : "no"}',
      '<Branch branch={cond} true="yes">no</Branch>',
    ],
    [
      'negated equality',
      '{!(x === "val") ? "a" : "b"}',
      '<Branch branch={x} val="b">a</Branch>',
    ],
    [
      'negated inequality',
      '{!(x !== "val") ? "a" : "b"}',
      '<Branch branch={x} val="a">b</Branch>',
    ],
  ]),
});

ruleTester.run('static-jsx: chained ternaries', staticJsx, {
  valid: [],
  invalid: [
    ...fixes('T, Branch', [
      [
        'same variable collapses into one Branch',
        '{color === "red" ? "Red" : color === "green" ? "Green" : color === "blue" ? "Blue" : "Other"}',
        '<Branch branch={color} red="Red" green="Green" blue="Blue">Other</Branch>',
      ],
      [
        'collapsed JSX values',
        '{role === "admin" ? <b>Admin</b> : role === "editor" ? <i>Editor</i> : <span>Viewer</span>}',
        '<Branch branch={role} admin={<b>Admin</b>} editor={<i>Editor</i>}><span>Viewer</span></Branch>',
      ],
      [
        'collapsed with null fallback is self-closing',
        '{x === "a" ? "Alpha" : x === "b" ? "Beta" : null}',
        '<Branch branch={x} a="Alpha" b="Beta" />',
      ],
      [
        'outer !== swaps before collapsing',
        '{x !== "a" ? x === "b" ? "B" : "other" : "A"}',
        '<Branch branch={x} a="A" b="B">other</Branch>',
      ],
      [
        'inner !== swaps while collapsing',
        '{x === "a" ? "A" : x !== "b" ? "other" : "B"}',
        '<Branch branch={x} a="A" b="B">other</Branch>',
      ],
      [
        'different variables nest',
        '{a === "x" ? "X" : b === "y" ? "Y" : "Z"}',
        '<Branch branch={a} x="X"><Branch branch={b} y="Y">Z</Branch></Branch>',
      ],
      [
        'numeric comparisons nest because the tests differ',
        '{count === 0 ? "none" : count === 1 ? "one" : "many"}',
        '<Branch branch={count === 0} true="none"><Branch branch={count === 1} true="one">many</Branch></Branch>',
      ],
      [
        'invalid first prop name nests',
        '{x === 42 ? "forty-two" : x === "b" ? "B" : "other"}',
        '<Branch branch={x === 42} true="forty-two"><Branch branch={x} b="B">other</Branch></Branch>',
      ],
      [
        'collapses until the variable changes',
        '{x === "a" ? "A" : x === "b" ? "B" : y === "c" ? "C" : "D"}',
        '<Branch branch={x} a="A" b="B"><Branch branch={y} c="C">D</Branch></Branch>',
      ],
    ]),
    {
      name: 'dynamic fallback becomes children, then Var',
      code: t('{x === "a" ? "A" : x === "b" ? "B" : fallback}'),
      output: [
        t('<Branch branch={x} a="A" b="B">{fallback}</Branch>', 'T, Branch'),
        t(
          '<Branch branch={x} a="A" b="B"><Var>{fallback}</Var></Branch>',
          'T, Branch, Var'
        ),
      ],
      errors: errors(),
    },
    {
      name: 'inner ternary without translatable content is not collapsed',
      code: t('{x === "one" ? "One" : x === "two" ? a : b}'),
      output: [
        t(
          '<Branch branch={x} one="One">{x === "two" ? a : b}</Branch>',
          'T, Branch'
        ),
        t(
          '<Branch branch={x} one="One"><Var>{x === "two" ? a : b}</Var></Branch>',
          'T, Branch, Var'
        ),
      ],
      errors: errors(),
    },
  ],
});

ruleTester.run('static-jsx: logical expressions', staticJsx, {
  valid: [],
  invalid: [
    ...fixes('T, Branch', [
      [
        'AND with a string',
        '{x && "text"}',
        '<Branch branch={!!x} true="text" />',
      ],
      [
        'AND with a JSX element',
        '{x && <div>Content</div>}',
        '<Branch branch={!!x} true={<div>Content</div>} />',
      ],
      [
        'AND with a fragment',
        '{x && <>Fragment content</>}',
        '<Branch branch={!!x} true={<>Fragment content</>} />',
      ],
      [
        'AND with a static template literal',
        '{x && `hello`}',
        '<Branch branch={!!x} true="hello" />',
      ],
      [
        'AND with an empty string',
        '{x && ""}',
        '<Branch branch={!!x} true="" />',
      ],
      [
        'AND with a nested ternary',
        '{show && (type === "a" ? "Alpha" : "Beta")}',
        '<Branch branch={!!show} true={<Branch branch={type} a="Alpha">Beta</Branch>} />',
      ],
      [
        'AND with a nested AND',
        '{x && (y && "nested")}',
        '<Branch branch={!!x} true={<Branch branch={!!y} true="nested" />} />',
      ],
      // The left side is prefixed with !! as written, without parentheses.
      [
        'chained AND',
        '{a && b && "both"}',
        '<Branch branch={!!a && b} true="both" />',
      ],
      [
        'comparison on the left',
        '{count > 0 && "Has items"}',
        '<Branch branch={!!count > 0} true="Has items" />',
      ],
      [
        'parenthesized OR on the left',
        '{(a || b) && "text"}',
        '<Branch branch={!!a || b} true="text" />',
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
      name: 'AND with dynamic content inside JSX: Var first, then Branch',
      code: t('{x && <span>{name}</span>}'),
      output: [
        t('{x && <span><Var>{name}</Var></span>}', 'T, Var'),
        t(
          '<Branch branch={!!x} true={<span><Var>{name}</Var></span>} />',
          'T, Var, Branch'
        ),
      ],
      errors: errors(2),
    },
  ],
});
