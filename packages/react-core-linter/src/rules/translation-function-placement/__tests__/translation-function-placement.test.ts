import { RuleTester } from '@typescript-eslint/rule-tester';
import { translationFunctionPlacement } from '../index.js';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

const imports = `import { getGT, getLocale } from 'gt-tanstack-start';\n`;

// Run at the top level: RuleTester registers its own tests, which vitest
// never runs when they are registered from inside another test.
ruleTester.run('translation-function-placement', translationFunctionPlacement, {
  valid: [
    // Route loaders, head data and server functions
    `${imports}
    export const Route = createFileRoute('/pricing')({
      loader: async () => ({ title: (await getGT())('Pricing') }),
      beforeLoad: () => { if (getLocale() === 'de') throw redirect({ to: '/' }); },
    });`,
    `${imports}
    const sendReceipt = createServerFn().handler(async () => {
      const gt = await getGT();
      return gt('Your receipt');
    });`,
    `${imports}
    async function loadTitle() {
      return (await getGT())('Pricing');
    }`,
    // An event handler inside a component runs after render
    `${imports}
    function SaveButton() {
      return <button onClick={async () => toast((await getGT())('Saved'))} />;
    }`,
    // useCallback stores its callback for later, like an event handler
    `${imports}
    function SaveButton() {
      const save = useCallback(async () => toast((await getGT())('Saved')), []);
      return <button onClick={save} />;
    }`,
    `import * as i18n from 'gt-tanstack-start';
    export const Route = createFileRoute('/')({
      loader: async () => (await i18n.getGT())('Title'),
    });`,
    `import * as server from 'gt-next/server';
    const gt = await server.getGT();`,
    // Same names from other libraries, or not imported at all
    `import { getGT } from 'gt-next/server';
    const gt = await getGT();`,
    `const gt = await getGT();`,
    // An anonymous default export that doesn't render isn't a component
    `${imports}
    export default async function () {
      return (await getGT())('Title');
    }`,
  ],
  invalid: [
    {
      code: `import * as i18n from 'gt-tanstack-start';
      export const locale = i18n.getLocale();`,
      errors: [{ messageId: 'moduleScope', data: { name: 'getLocale' } }],
    },
    {
      code: `import * as i18n from 'gt-tanstack-start';
      function Page() {
        return <p>{i18n.getLocale()}</p>;
      }`,
      errors: [
        {
          messageId: 'inComponent',
          data: { name: 'getLocale', hook: 'useLocale' },
        },
      ],
    },
    {
      code: `${imports}export default (() => <p>{getLocale()}</p>) satisfies React.FC;`,
      errors: [
        {
          messageId: 'inComponent',
          data: { name: 'getLocale', hook: 'useLocale' },
        },
      ],
    },
    {
      code: `${imports}const Page = (() => <p>{getLocale()}</p>) as React.FC;`,
      errors: [
        {
          messageId: 'inComponent',
          data: { name: 'getLocale', hook: 'useLocale' },
        },
      ],
    },
    {
      code: `${imports}
      export default function () {
        return (<p>{getLocale()}</p>) as React.ReactNode;
      }`,
      errors: [
        {
          messageId: 'inComponent',
          data: { name: 'getLocale', hook: 'useLocale' },
        },
      ],
    },
    {
      code: `${imports}export const locale = (() => getLocale())();`,
      errors: [{ messageId: 'moduleScope', data: { name: 'getLocale' } }],
    },
    {
      code: `${imports}const gt = await (async () => getGT())();`,
      errors: [{ messageId: 'moduleScope', data: { name: 'getGT' } }],
    },
    {
      code: `${imports}
      const Card = memo(function render() {
        return <p>{getLocale()}</p>;
      });`,
      errors: [
        {
          messageId: 'inComponent',
          data: { name: 'getLocale', hook: 'useLocale' },
        },
      ],
    },
    {
      code: `${imports}
      const Input = forwardRef(function render(props, ref) {
        return <input ref={ref} placeholder={getLocale()} />;
      });`,
      errors: [
        {
          messageId: 'inComponent',
          data: { name: 'getLocale', hook: 'useLocale' },
        },
      ],
    },
    {
      code: `${imports}
      export const Route = createFileRoute('/')({
        component: function render() {
          return <p>{getLocale()}</p>;
        },
      });`,
      errors: [
        {
          messageId: 'inComponent',
          data: { name: 'getLocale', hook: 'useLocale' },
        },
      ],
    },
    {
      code: `${imports}export default memo(() => use(getGT())('Card'));`,
      errors: [
        { messageId: 'inComponent', data: { name: 'getGT', hook: 'useGT' } },
      ],
    },
    {
      code: `${imports}export default () => <p>{getLocale()}</p>;`,
      errors: [
        {
          messageId: 'inComponent',
          data: { name: 'getLocale', hook: 'useLocale' },
        },
      ],
    },
    {
      code: `${imports}
      export default function () {
        const locale = getLocale();
        return locale ? <p>{locale}</p> : null;
      }`,
      errors: [
        {
          messageId: 'inComponent',
          data: { name: 'getLocale', hook: 'useLocale' },
        },
      ],
    },
    {
      code: `${imports}const gt = await getGT();`,
      errors: [{ messageId: 'moduleScope', data: { name: 'getGT' } }],
    },
    {
      code: `${imports}export const locale = getLocale();`,
      errors: [{ messageId: 'moduleScope', data: { name: 'getLocale' } }],
    },
    {
      code: `import { getGT as translator } from 'gt-tanstack-start';
      const title = translator().then((gt) => gt('Pricing'));`,
      errors: [{ messageId: 'moduleScope', data: { name: 'getGT' } }],
    },
    {
      code: `${imports}
      function Pricing() {
        const locale = getLocale();
        return <p>{locale}</p>;
      }`,
      errors: [
        {
          messageId: 'inComponent',
          data: { name: 'getLocale', hook: 'useLocale' },
        },
      ],
    },
    {
      code: `${imports}
      const Pricing = () => {
        useEffect(() => {
          getGT().then(setGt);
        }, []);
        return null;
      };`,
      errors: [
        { messageId: 'inComponent', data: { name: 'getGT', hook: 'useGT' } },
      ],
    },
    {
      code: `${imports}
      function useTitle() {
        return React.useMemo(() => getGT(), []);
      }`,
      errors: [
        { messageId: 'inComponent', data: { name: 'getGT', hook: 'useGT' } },
      ],
    },
    {
      code: `${imports}
      const Card = memo(function () {
        return use(getGT())('Card');
      });`,
      errors: [
        { messageId: 'inComponent', data: { name: 'getGT', hook: 'useGT' } },
      ],
    },
    {
      code: `${imports}
      export const Route = createFileRoute('/')({
        component: () => <p>{getLocale()}</p>,
        pendingComponent: () => <p>{getLocale()}</p>,
      });`,
      errors: [
        {
          messageId: 'inComponent',
          data: { name: 'getLocale', hook: 'useLocale' },
        },
        {
          messageId: 'inComponent',
          data: { name: 'getLocale', hook: 'useLocale' },
        },
      ],
    },
  ],
});
