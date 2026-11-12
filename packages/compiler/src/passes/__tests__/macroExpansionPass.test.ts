import { describe, it, expect } from 'vitest';
import { runPasses } from './testHelpers';

/** Runs the macro expansion pass and returns the generated code */
function expand(code: string, options: Record<string, unknown> = {}): string {
  return runPasses(code, ['macroExpansion'], options).code;
}

const AUTO_IMPORT = 'import { t } from "gt-react";';

describe('macroExpansionPass', () => {
  describe('tagged templates', () => {
    it.each([
      [
        'an unbound t',
        'const x = t`Hello, ${name}`;',
        `${AUTO_IMPORT}const x = t("Hello, {0}", { "0": name });`,
      ],
      [
        't imported from gt-react',
        "import { t } from 'gt-react';\nconst x = t`hello ${name}`;",
        `import { t } from 'gt-react';\nconst x = t("hello {0}", { "0": name });`,
      ],
      [
        't imported from gt-react/browser',
        "import { t } from 'gt-react/browser';\nconst x = t`hello ${name}`;",
        `import { t } from 'gt-react/browser';\nconst x = t("hello {0}", { "0": name });`,
      ],
      [
        't imported from gt-react/client',
        "import { t } from 'gt-react/client';\nconst x = t`hello ${name}`;",
        `import { t } from 'gt-react/client';\nconst x = t("hello {0}", { "0": name });`,
      ],
      [
        'derive() mixed with a dynamic expression',
        "import { derive } from 'gt-react/browser';\nconst x = t`${name} says ${derive(greeting)}`;",
        `${AUTO_IMPORT}import { derive } from 'gt-react/browser';\nconst x = t(\`{0} says \${derive(greeting)}\`, { "0": name });`,
      ],
    ])('expands %s', (_name, input, expected) => {
      expect(expand(input)).toBe(expected);
    });

    it('expands a custom stringTranslationMacro into t()', () => {
      expect(
        expand('const x = __`hello ${name}`;', { stringTranslationMacro: '__' })
      ).toBe(`${AUTO_IMPORT}const x = t("hello {0}", { "0": name });`);
    });

    it.each([
      [
        't imported from a non-react GT source',
        "import { t } from 'gt-next';\nconst x = t`hello ${name}`;",
        {},
      ],
      [
        't imported from a non-GT source',
        "import { t } from 'i18next';\nconst x = t`hello ${name}`;",
        {},
      ],
      [
        'a local t variable',
        'const t = (s) => s;\nconst x = t`hello ${name}`;',
        {},
      ],
      [
        't destructured from a non-GT call',
        'const { t } = useTranslation();\nconst x = t`hello ${name}`;',
        {},
      ],
      [
        'enableTaggedTemplate: false',
        'const x = t`Hello, ${name}`;',
        { enableTaggedTemplate: false },
      ],
    ])('leaves the template alone for %s', (_name, input, options) => {
      expect(expand(input, options)).toBe(input);
    });
  });

  // The CallExpression visitor (t(`...`) / t("a" + b) arguments) is
  // intentionally disabled, so call arguments are never rewritten here.
  describe('call arguments', () => {
    it.each([
      ['a plain string', 'const x = t("Hello");', {}],
      ['a template literal', 'const x = t(`Hello, ${name}`);', {}],
      [
        'a template literal with enableTemplateLiteralArg: false',
        'const x = t(`Hello, ${name}`);',
        { enableTemplateLiteralArg: false },
      ],
      ['a concatenation', 'const x = t("Hello, " + name);', {}],
      [
        'a concatenation with enableConcatenationArg: false',
        'const x = t("Hello, " + name);',
        { enableConcatenationArg: false },
      ],
      [
        'a template literal with derive()',
        "import { derive } from 'gt-react/browser';\nconst x = t(`Hello ${derive(getName())}`);",
        {},
      ],
      [
        'a template literal on a non-GT t',
        "import { t } from 'i18next';\nconst x = t(`hello ${name}`);",
        {},
      ],
      [
        'a concatenation on a non-GT t',
        'import { t } from \'i18next\';\nconst x = t("hello " + name);',
        {},
      ],
      [
        'a template literal on a local t',
        'const t = (s) => s;\nconst x = t(`hello ${name}`);',
        {},
      ],
    ])('leaves %s untouched', (_name, input, options) => {
      expect(expand(input, options)).toBe(input);
    });

    // Spec for the deferred CallExpression visitor (disabled in #1129 until
    // derive support for call arguments lands). Un-skip when it is enabled.
    it.skip.each([
      [
        'const x = t(`Hello, ${name}`);',
        `${AUTO_IMPORT}const x = t("Hello, {0}", { "0": name });`,
      ],
      [
        'const x = t("Hello, " + name);',
        `${AUTO_IMPORT}const x = t("Hello, {0}", { "0": name });`,
      ],
      [
        'const x = t("A" + "B" + `C${"D" + `${`E`}F`}`);',
        `${AUTO_IMPORT}const x = t("ABCDEF");`,
      ],
      [
        'const x = t("count: " + 42);',
        `${AUTO_IMPORT}const x = t("count: 42");`,
      ],
      [
        'const x = t(true + " value");',
        `${AUTO_IMPORT}const x = t("true value");`,
      ],
      [
        'const x = t(`A${`B${"C" + "D"}E`}F`);',
        `${AUTO_IMPORT}const x = t("ABCDEF");`,
      ],
      [
        'import { derive } from \'gt-react/browser\';\nconst x = t(`A${derive(getName())}B` + "C" + name);',
        `${AUTO_IMPORT}import { derive } from 'gt-react/browser';\nconst x = t(\`A\${derive(getName())}BC{0}\`, { "0": name });`,
      ],
      [
        'import { derive } from \'gt-react/browser\';\nconst x = t(`A${"B"}${derive(x)}${"C"}D`);',
        `${AUTO_IMPORT}import { derive } from 'gt-react/browser';\nconst x = t(\`AB\${derive(x)}CD\`);`,
      ],
    ])('expands %s', (input, expected) => {
      expect(expand(input)).toBe(expected);
    });
  });

  describe('auto-import', () => {
    it('adds a single import as the first statement when macros expand', () => {
      expect(
        expand(
          "import React from 'react';\nconst a = t`hello ${name}`;\nconst b = t`goodbye ${name}`;"
        )
      ).toBe(
        `${AUTO_IMPORT}import React from 'react';\nconst a = t("hello {0}", { "0": name });\nconst b = t("goodbye {0}", { "0": name });`
      );
    });

    it('imports from gt-react/browser with legacyGtReactImportSource', () => {
      expect(
        expand('const x = t`hello`;', { legacyGtReactImportSource: true })
      ).toBe('import { t } from "gt-react/browser";const x = t("hello");');
    });

    it('expands without importing when enableMacroImportInjection is false', () => {
      expect(
        expand('const x = t`hello`;', { enableMacroImportInjection: false })
      ).toBe('const x = t("hello");');
    });
  });
});
