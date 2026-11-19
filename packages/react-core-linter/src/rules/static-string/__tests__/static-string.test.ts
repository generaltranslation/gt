import { RuleTester } from '@typescript-eslint/rule-tester';
import { staticString } from '../index.js';

// RuleTester.run() registers its own describe/it blocks (vitest globals), so
// it must be called at the top level. Inside it() the cases never execute.
const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
});

/** A module-level statement with msg imported from `source`. */
const msg = (expression: string, source = 'gt-react') => `
import { msg } from '${source}';
const message = ${expression};
`;

type Row = [name: string, expression: string];

const valid = (rows: Row[]) =>
  rows.map(([name, expression]) => ({ name, code: msg(expression) }));

const invalid = (rows: Row[]) =>
  rows.map(([name, expression]) => ({
    name,
    code: msg(expression),
    errors: [{ messageId: 'staticStringRequired' as const }],
  }));

ruleTester.run('static-string', staticString, {
  valid: [
    ...valid([
      ['a string literal', "msg('Save')"],
      ['a template literal without values', 'msg(`Save`)'],
      ['a tagged template', 'msg`Hello, ${{ name }}!`'],
      ['a tagged template with options', "msg({ context: 'button' })`Save`"],
      ['a tagged template with dynamic options', 'msg(options)`Save`'],
      ['a configured tag', "msg({ context: 'button' })"],
    ]),
    {
      name: 'msg from a library outside libs',
      code: msg('msg(label)', 'gt-next'),
      options: [{ libs: ['gt-react'] }],
    },
    {
      name: 'msg from another library',
      code: msg('msg(label)', 'some-lib'),
    },
    {
      name: 'a local msg',
      code: 'const msg = (text) => text;\nmsg(label);',
    },
    {
      name: 'the tag returned by useGT()',
      code: "import { useGT } from 'gt-react';\nconst t = useGT();\nt`Hello, ${{ name }}!`;",
    },
  ],
  invalid: [
    ...invalid([
      ['a variable', 'msg(label)'],
      ['a template literal with values', 'msg(`Hello, ${name}!`)'],
      ['a concatenation', "msg('Hello, ' + name)"],
      ['an array', "msg(['Save', 'Cancel'])"],
      ['a call', 'msg(getLabel())'],
      ['a spread', 'msg(...labels)'],
      ['no argument', 'msg()'],
      ['a second argument', "msg('Save', { $context: 'button' })"],
    ]),
    {
      name: 'msg from gt-next',
      code: msg('msg(label)', 'gt-next'),
      errors: [{ messageId: 'staticStringRequired' }],
    },
  ],
});
