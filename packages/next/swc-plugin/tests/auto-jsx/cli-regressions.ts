/** Historical CLI/compiler counterexamples retained as strict parity regressions. */
export const cliRegressionExamples = {
  'expression-text': {
    input: 'export const Page = () => <p>{"Hello"}</p>;',
    control: 'export const Page = () => <p>Hello</p>;',
  },
  'children-attribute': {
    input: 'export const Page = () => <p children="Hello" />;',
    control: 'export const Page = () => <p>Hello</p>;',
  },
  'child-array': {
    input: 'export const Page = () => <p>{["Hello", name]}</p>;',
    control: 'export const Page = () => <p>Hello {name}</p>;',
  },
  'expression-jsx-region': {
    input: 'export const Page = () => <p>Hello {<b>Hi {name}</b>}</p>;',
    control: 'export const Page = () => <p>Hello <b>Hi {name}</b></p>;',
  },
  'static-expression': {
    input: 'export const Page = () => <p>Hello {undefined}</p>;',
    control: 'export const Page = () => <p>Hello {name}</p>;',
  },
  'typescript-expression': {
    input: 'export const Page = () => <p>Hello {("world" as string)}</p>;',
    control: 'export const Page = () => <p>Hello {(name as string)}</p>;',
  },
  'manual-t-descendants': {
    input:
      'import { T } from "gt-next"; export const Page = () => <T>{ok && <b>Hello {name}</b>}</T>;',
    control:
      'import { T } from "gt-next"; export const Page = () => <T><b>Hello {name}</b></T>;',
  },
  'opaque-root-props': {
    input:
      'import { Branch } from "gt-next"; export const Page = () => <Branch branch={mode} yes={name} />;',
    control:
      'import { Branch } from "gt-next"; export const Page = () => <p><Branch branch={mode} yes={name} /></p>;',
  },
  'opaque-prop-descendants': {
    input:
      'import { Branch } from "gt-next"; export const Page = () => <p><Branch branch={<b>Choice {name}</b>} yes="Yes" /></p>;',
    control:
      'import { Branch } from "gt-next"; export const Page = () => <p><Branch branch={mode} yes="Yes" /></p>;',
  },
  'derive-prop-descendants': {
    input:
      'import { Derive } from "gt-next"; export const Page = () => <p><Derive context={ok ? <b>Hello {name}</b> : null} /></p>;',
    control:
      'import { Derive } from "gt-next"; export const Page = () => <p><Derive context={name} /></p>;',
  },
  'derive-children': {
    input:
      'import { Derive } from "gt-next"; export const Page = () => <p><Derive children={<b>Hello {name}</b>} /></p>;',
    control:
      'import { Derive } from "gt-next"; export const Page = () => <p><Derive><b>Hello {name}</b></Derive></p>;',
  },
  'opaque-key': {
    input:
      'import { Branch } from "gt-next"; export const Page = () => <p><Branch key={name} yes="Yes" /></p>;',
    control:
      'import { Branch } from "gt-next"; export const Page = () => <p><Branch key="stable" yes="Yes" /></p>;',
  },
  'create-element-fallback': {
    input:
      'export const Page = () => <p {...props} key={name}>Hello {name}</p>;',
    control:
      'export const Page = () => <p key={name} {...props}>Hello {name}</p>;',
  },
  'import-shadowing': {
    input:
      'import { T } from "gt-next"; export const Keep = T; export const Page = (T) => <T>Hello {name}</T>;',
    control:
      'import { T } from "gt-next"; export const Keep = T; export const Page = () => <T>Hello {name}</T>;',
  },
  'type-only-import': {
    input:
      'import type { T } from "gt-next"; const T = Local; export const Page = () => <T>Hello {name}</T>;',
    control: 'const T = Local; export const Page = () => <T>Hello {name}</T>;',
  },
  'intrinsic-import-alias': {
    input:
      'import { T as t } from "gt-next"; export const Page = () => <t>Hello {name}</t>;',
    control:
      'import { T as Translate } from "gt-next"; export const Page = () => <Translate>Hello {name}</Translate>;',
  },
  'string-import-name': {
    input:
      'import { "T" as T } from "gt-next"; export const Page = () => <T>Hello {name}</T>;',
    control:
      'import { T } from "gt-next"; export const Page = () => <T>Hello {name}</T>;',
  },
  'import-source-prefix': {
    input:
      'import { T } from "gt-next/custom"; export const Page = () => <T>Hello {name}</T>;',
    control:
      'import { T } from "gt-next"; export const Page = () => <T>Hello {name}</T>;',
  },
  'existing-internal-helper': {
    input:
      'import { GtInternalTranslateJsx } from "gt-next"; export const Page = () => <GtInternalTranslateJsx>Hello {name}</GtInternalTranslateJsx>;',
    control:
      'import { T } from "gt-next"; export const Page = () => <T>Hello {name}</T>;',
  },
  'jsx-runtime': {
    input:
      '/** @jsxImportSource @emotion/react */ export const Page = () => <p>Hello {name}</p>;',
    control:
      '/** @jsxImportSource react */ export const Page = () => <p>Hello {name}</p>;',
  },
};
