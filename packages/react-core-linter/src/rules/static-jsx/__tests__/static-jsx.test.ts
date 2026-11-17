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
      name: 'Branch: branch prop is not checked, static props',
      code: t(
        '<Branch branch={gender} male="Mr." female="Ms." other="Mx." />',
        'T, Branch'
      ),
    },
    {
      name: 'Branch prop values may be string literals, JSX or fragments',
      code: t(
        '<Branch branch={x} a={"hello"} b={<b>bold</b>} c={<>frag</>} other="fallback" />',
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
        'Outer <T><Branch branch={cond} true="a" other="b" /></T>',
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
        '<Branch branch={x} a=<Branch branch={cond} true="one" other="two" />>fallback</Branch>',
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
      output: t('<Branch branch={cond} true="yes" other="no" />', 'T, Branch'),
      errors: errors(),
    },
    {
      name: 'aliased Branch for a ternary',
      code: t('{cond ? "yes" : "no"}', 'T, Branch as B'),
      output: t('<B branch={cond} true="yes" other="no" />', 'T, Branch as B'),
      errors: errors(),
    },
    {
      name: 'aliased Branch for a logical AND',
      code: t('{active && "Active"}', 'T, Branch as If'),
      output: t(
        '<If branch={!!active} true="Active" other={null} />',
        'T, Branch as If'
      ),
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
        '<T><Branch branch={cond} true="a" other="b" /></T>'
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
        '<Trans><Branch branch={cond} true="a" other="b" /></Trans>'
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
        '<T><Branch branch={cond} true="a" other="b" /></T>'
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
        t(
          '<Branch branch={a} true="x" other="y" />{b ? "m" : "n"}',
          'T, Branch'
        ),
        t(
          '<Branch branch={a} true="x" other="y" /><Branch branch={b} true="m" other="n" />',
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
          '<Var>{a}</Var><Branch branch={cond} true="x" other="y" />{b}',
          'T, Var, Branch'
        ),
        t(
          '<Var>{a}</Var><Branch branch={cond} true="x" other="y" /><Var>{b}</Var>',
          'T, Var, Branch'
        ),
      ],
      errors: errors(3),
    },
    {
      name: 'Var added to the React import after a core import',
      code: component(
        "import { derive } from 'generaltranslation';\nimport { T } from 'gt-react';",
        '<T>{name}</T>'
      ),
      output: component(
        "import { derive } from 'generaltranslation';\nimport { T, Var } from 'gt-react';",
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
      name: 'Branch added to the native import after a compat import',
      code: component(
        "import { useTranslations } from 'gt-next/compat';\nimport { T } from 'gt-next';",
        '<T>{cond ? "yes" : "no"}</T>'
      ),
      output: component(
        "import { useTranslations } from 'gt-next/compat';\nimport { T, Branch } from 'gt-next';",
        '<T><Branch branch={cond} true="yes" other="no" /></T>'
      ),
      options: [{ libs: ['gt-next'] }],
      errors: errors(),
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
        '<Branch branch={cond} true="yes" other="no" />',
      ],
      [
        'surrounding text is preserved',
        'Hello {cond ? "world" : "there"} bye',
        'Hello <Branch branch={cond} true="world" other="there" /> bye',
      ],
      [
        'inside a nested element',
        '<p>{cond ? "a" : "b"}</p>',
        '<p><Branch branch={cond} true="a" other="b" /></p>',
      ],
      [
        'static template literal branches',
        '{cond ? `hello` : `world`}',
        '<Branch branch={cond} true="hello" other="world" />',
      ],
      [
        'JSX element branches',
        '{cond ? <b>Bold</b> : <i>Italic</i>}',
        '<Branch branch={cond} true={<b>Bold</b>} other={<i>Italic</i>} />',
      ],
      [
        'fragment branches',
        '{cond ? <>yes</> : <>no</>}',
        '<Branch branch={cond} true={<>yes</>} other={<>no</>} />',
      ],
      [
        'attribute expressions inside a JSX branch are not reported',
        '{cond ? <a href={url}>Link</a> : "text"}',
        '<Branch branch={cond} true={<a href={url}>Link</a>} other="text" />',
      ],
      [
        'null alternate is a braced other value',
        '{cond ? "visible" : null}',
        '<Branch branch={cond} true="visible" other={null} />',
      ],
      [
        'null consequent is a braced prop value',
        '{cond ? null : "text"}',
        '<Branch branch={cond} true={null} other="text" />',
      ],
      [
        'non-string literal alternate is a braced other value',
        '{cond ? "text" : 42}',
        '<Branch branch={cond} true="text" other={42} />',
      ],
      [
        'empty string alternate',
        '{cond ? "yes" : ""}',
        '<Branch branch={cond} true="yes" other="" />',
      ],
      [
        'empty string consequent',
        '{cond ? "" : "fallback"}',
        '<Branch branch={cond} true="" other="fallback" />',
      ],
      [
        'apostrophes need no escaping',
        `{cond ? "it's" : "they're"}`,
        `<Branch branch={cond} true="it's" other="they're" />`,
      ],
      [
        'double quotes are braced, & and < are kept',
        String.raw`{cond ? "say \"hi\"" : "a & b < c"}`,
        String.raw`<Branch branch={cond} true={"say \"hi\""} other="a & b < c" />`,
      ],
      [
        'an entity is braced, so it stays text',
        '{cond ? "yes" : "&amp;"}',
        '<Branch branch={cond} true="yes" other={"&amp;"} />',
      ],
      [
        'curly braces are kept',
        '{cond ? "{value}" : "{braces}"}',
        '<Branch branch={cond} true="{value}" other="{braces}" />',
      ],
      [
        'escape sequences are written as their cooked value',
        String.raw`{cond ? "path\\to\\file" : "other"}`,
        String.raw`<Branch branch={cond} true="path\to\file" other="other" />`,
      ],
      [
        'nested ternary in the consequent',
        '{a ? (b ? "x" : "y") : "z"}',
        '<Branch branch={a} true={<Branch branch={b} true="x" other="y" />} other="z" />',
      ],
      [
        'nested ternary in the alternate',
        '{a ? "x" : b ? "y" : "z"}',
        '<Branch branch={a} true="x" other={<Branch branch={b} true="y" other="z" />} />',
      ],
      [
        'logical AND in the alternate',
        '{cond ? "a" : x && "b"}',
        '<Branch branch={cond} true="a" other={<Branch branch={!!x} true="b" other={null} />} />',
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
      name: 'dynamic alternate becomes the other prop, then Var',
      code: t('{cond ? "hello" : label}'),
      output: [
        t('<Branch branch={cond} true="hello" other={label} />', 'T, Branch'),
        t(
          '<Branch branch={cond} true="hello" other=<Var>{label}</Var> />',
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
          '<Branch branch={cond} true={getLabel()} other="default" />',
          'T, Branch'
        ),
        t(
          '<Branch branch={cond} true=<Var>{getLabel()}</Var> other="default" />',
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
          '<Branch branch={cond} true={<span><Var>{name}</Var></span>} other={<span>Guest</span>} />',
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
      '<Branch branch={status} active="on" other="off" />',
    ],
    [
      '==',
      '{status == "active" ? "on" : "off"}',
      '<Branch branch={status} active="on" other="off" />',
    ],
    [
      '!== swaps the branches',
      '{status !== "active" ? "other" : "on"}',
      '<Branch branch={status} active="on" other="other" />',
    ],
    [
      '!= swaps the branches',
      '{status != "active" ? "other" : "on"}',
      '<Branch branch={status} active="on" other="other" />',
    ],
    [
      'literal on the left',
      '{"active" === status ? "on" : "off"}',
      '<Branch branch={status} active="on" other="off" />',
    ],
    [
      'literal on the left with !==',
      '{"active" !== status ? "other" : "on"}',
      '<Branch branch={status} active="on" other="other" />',
    ],
    [
      'boolean literal',
      '{x === false ? "off" : "on"}',
      '<Branch branch={x} false="off" other="on" />',
    ],
    [
      'hyphenated literal',
      '{x === "my-value" ? "a" : "b"}',
      '<Branch branch={x} my-value="a" other="b" />',
    ],
    [
      'underscore-prefixed literal',
      '{x === "_private" ? "a" : "b"}',
      '<Branch branch={x} _private="a" other="b" />',
    ],
    [
      'dollar-prefixed literal',
      '{x === "$price" ? "a" : "b"}',
      '<Branch branch={x} $price="a" other="b" />',
    ],
    [
      'optional member expression operand',
      '{user?.role === "admin" ? "yes" : "no"}',
      '<Branch branch={user?.role} admin="yes" other="no" />',
    ],
    [
      'typeof operand',
      '{typeof x === "string" ? "text" : "other"}',
      '<Branch branch={typeof x} string="text" other="other" />',
    ],
    [
      '!== with JSX branches',
      '{role !== "admin" ? <i>User</i> : <b>Admin</b>}',
      '<Branch branch={role} admin={<b>Admin</b>} other={<i>User</i>} />',
    ],
    [
      '!== with null alternate puts null in the prop',
      '{status !== "active" ? "other" : null}',
      '<Branch branch={status} active={null} other="other" />',
    ],
    // Literals that are not valid JSX prop names keep the whole test.
    [
      'the literal "other" would be the fallback branch',
      '{x === "other" ? "a" : "b"}',
      '<Branch branch={x === "other"} true="a" other="b" />',
    ],
    [
      'number literal',
      '{x === 42 ? "a" : "b"}',
      '<Branch branch={x === 42} true="a" other="b" />',
    ],
    [
      'empty string',
      '{x === "" ? "empty" : "full"}',
      '<Branch branch={x === ""} true="empty" other="full" />',
    ],
    [
      'string starting with a digit',
      '{x === "42" ? "a" : "b"}',
      '<Branch branch={x === "42"} true="a" other="b" />',
    ],
    [
      'string starting with a hyphen',
      '{x === "-invalid" ? "a" : "b"}',
      '<Branch branch={x === "-invalid"} true="a" other="b" />',
    ],
    [
      'string with a space',
      '{x === "hello world" ? "a" : "b"}',
      '<Branch branch={x === "hello world"} true="a" other="b" />',
    ],
    [
      'null literal',
      '{x === null ? "none" : "some"}',
      '<Branch branch={x === null} true="none" other="some" />',
    ],
    [
      '!== null does not swap',
      '{x !== null ? "present" : "absent"}',
      '<Branch branch={x !== null} true="present" other="absent" />',
    ],
    // Operands that are not Literal nodes keep the whole test.
    [
      'negative number',
      '{x === -1 ? "a" : "b"}',
      '<Branch branch={x === -1} true="a" other="b" />',
    ],
    [
      'template literal',
      '{x === `val` ? "a" : "b"}',
      '<Branch branch={x === `val`} true="a" other="b" />',
    ],
    // Other tests keep the whole test.
    [
      'relational operator',
      '{x > 0 ? "positive" : "non-positive"}',
      '<Branch branch={x > 0} true="positive" other="non-positive" />',
    ],
    [
      'logical expression',
      '{x === "a" && y === "b" ? "both" : "nope"}',
      '<Branch branch={x === "a" && y === "b"} true="both" other="nope" />',
    ],
    // Negation is unwrapped and swaps the branches.
    [
      'negation',
      '{!cond ? "no" : "yes"}',
      '<Branch branch={cond} true="yes" other="no" />',
    ],
    [
      'double negation',
      '{!!cond ? "yes" : "no"}',
      '<Branch branch={cond} true="yes" other="no" />',
    ],
    [
      'negated equality',
      '{!(x === "val") ? "a" : "b"}',
      '<Branch branch={x} val="b" other="a" />',
    ],
    [
      'negated inequality',
      '{!(x !== "val") ? "a" : "b"}',
      '<Branch branch={x} val="a" other="b" />',
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
        '<Branch branch={color} red="Red" green="Green" blue="Blue" other="Other" />',
      ],
      [
        'collapsed JSX values',
        '{role === "admin" ? <b>Admin</b> : role === "editor" ? <i>Editor</i> : <span>Viewer</span>}',
        '<Branch branch={role} admin={<b>Admin</b>} editor={<i>Editor</i>} other={<span>Viewer</span>} />',
      ],
      [
        'collapsed with null fallback is self-closing',
        '{x === "a" ? "Alpha" : x === "b" ? "Beta" : null}',
        '<Branch branch={x} a="Alpha" b="Beta" other={null} />',
      ],
      [
        'outer !== swaps before collapsing',
        '{x !== "a" ? x === "b" ? "B" : "other" : "A"}',
        '<Branch branch={x} a="A" b="B" other="other" />',
      ],
      [
        'inner !== swaps while collapsing',
        '{x === "a" ? "A" : x !== "b" ? "other" : "B"}',
        '<Branch branch={x} a="A" b="B" other="other" />',
      ],
      [
        'different variables nest',
        '{a === "x" ? "X" : b === "y" ? "Y" : "Z"}',
        '<Branch branch={a} x="X" other={<Branch branch={b} y="Y" other="Z" />} />',
      ],
      [
        'numeric comparisons nest because the tests differ',
        '{count === 0 ? "none" : count === 1 ? "one" : "many"}',
        '<Branch branch={count === 0} true="none" other={<Branch branch={count === 1} true="one" other="many" />} />',
      ],
      [
        'invalid first prop name nests',
        '{x === 42 ? "forty-two" : x === "b" ? "B" : "other"}',
        '<Branch branch={x === 42} true="forty-two" other={<Branch branch={x} b="B" other="other" />} />',
      ],
      [
        'collapses until the variable changes',
        '{x === "a" ? "A" : x === "b" ? "B" : y === "c" ? "C" : "D"}',
        '<Branch branch={x} a="A" b="B" other={<Branch branch={y} c="C" other="D" />} />',
      ],
    ]),
    {
      name: 'dynamic fallback becomes the other prop, then Var',
      code: t('{x === "a" ? "A" : x === "b" ? "B" : fallback}'),
      output: [
        t('<Branch branch={x} a="A" b="B" other={fallback} />', 'T, Branch'),
        t(
          '<Branch branch={x} a="A" b="B" other=<Var>{fallback}</Var> />',
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
          '<Branch branch={x} one="One" other={x === "two" ? a : b} />',
          'T, Branch'
        ),
        t(
          '<Branch branch={x} one="One" other=<Var>{x === "two" ? a : b}</Var> />',
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
        '<Branch branch={!!x} true="text" other={null} />',
      ],
      [
        'AND with a JSX element',
        '{x && <div>Content</div>}',
        '<Branch branch={!!x} true={<div>Content</div>} other={null} />',
      ],
      [
        'AND with a fragment',
        '{x && <>Fragment content</>}',
        '<Branch branch={!!x} true={<>Fragment content</>} other={null} />',
      ],
      [
        'AND with a static template literal',
        '{x && `hello`}',
        '<Branch branch={!!x} true="hello" other={null} />',
      ],
      [
        'AND with an empty string',
        '{x && ""}',
        '<Branch branch={!!x} true="" other={null} />',
      ],
      [
        'AND with a nested ternary',
        '{show && (type === "a" ? "Alpha" : "Beta")}',
        '<Branch branch={!!show} true={<Branch branch={type} a="Alpha" other="Beta" />} other={null} />',
      ],
      [
        'AND with a nested AND',
        '{x && (y && "nested")}',
        '<Branch branch={!!x} true={<Branch branch={!!y} true="nested" other={null} />} other={null} />',
      ],
      // The left side is prefixed with !! as written, without parentheses.
      [
        'chained AND',
        '{a && b && "both"}',
        '<Branch branch={!!a && b} true="both" other={null} />',
      ],
      [
        'comparison on the left',
        '{count > 0 && "Has items"}',
        '<Branch branch={!!count > 0} true="Has items" other={null} />',
      ],
      [
        'parenthesized OR on the left',
        '{(a || b) && "text"}',
        '<Branch branch={!!a || b} true="text" other={null} />',
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
          '<Branch branch={!!x} true={<span><Var>{name}</Var></span>} other={null} />',
          'T, Var, Branch'
        ),
      ],
      errors: errors(2),
    },
  ],
});
