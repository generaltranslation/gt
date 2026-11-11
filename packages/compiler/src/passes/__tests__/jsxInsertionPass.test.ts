import { describe, it, expect } from 'vitest';
import * as t from '@babel/types';
import {
  runPasses,
  findJsxCalls,
  importSources,
  importedNames,
} from './testHelpers';

// The insertion pass runs on compiled JSX (jsx()/jsxs() calls). Each case
// names the JSX it was compiled from and gives the compiled form.

const IMPORTS = `
  import { jsx, jsxs } from 'react/jsx-runtime';
  import { Fragment } from 'react';
  import { T, Var, Num, Currency, DateTime, RelativeTime, Branch, Plural, Derive } from 'gt-react';
`;

function insert(code: string, options: Record<string, unknown> = {}) {
  const { ast, code: output } = runPasses(code, ['jsxInsertion'], {
    enableAutoJsxInjection: true,
    ...options,
  });
  return {
    ast,
    output,
    tCalls: findJsxCalls(ast, 'GtInternalTranslateJsx'),
    varCalls: findJsxCalls(ast, 'GtInternalVar'),
  };
}

function insertedCounts(code: string): Counts {
  const { tCalls, varCalls } = insert(code);
  return { t: tCalls.length, var: varCalls.length };
}

/** Kinds of the children of a call's `children` array: 'Var' or the node type */
function childKinds(call: t.CallExpression): string[] {
  const props = call.arguments[1] as t.ObjectExpression;
  const children = props.properties.find(
    (p): p is t.ObjectProperty =>
      t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'children' })
  )!.value as t.ArrayExpression;
  return children.elements.map((el) =>
    t.isCallExpression(el) &&
    t.isIdentifier(el.arguments[0], { name: 'GtInternalVar' })
      ? 'Var'
      : el!.type
  );
}

function calleeName(call: t.CallExpression): string {
  return (call.callee as t.Identifier).name;
}

/** Number of inserted _T and _Var wrappers */
type Counts = { t: number; var: number };
type Case = [jsx: string, compiled: string, counts: Counts];

describe('jsxInsertionPass', () => {
  describe('_T insertion', () => {
    it.each<Case>([
      [
        '<div>Hello</div>',
        `jsx("div", { children: "Hello" })`,
        { t: 1, var: 0 },
      ],
      [
        '<div>{`Hello`}</div>',
        'jsx("div", { children: `Hello` })',
        { t: 1, var: 0 },
      ],
      [
        '<div>こんにちは {name}</div>',
        `jsxs("div", { children: ["こんにちは ", name] })`,
        { t: 1, var: 1 },
      ],
      [
        '<>Hello World</>',
        `jsx(require("react").Fragment, { children: "Hello World" })`,
        { t: 1, var: 0 },
      ],
      [
        '<div {...otherProps}>Hello</div>',
        `jsx("div", { ...otherProps, children: "Hello" })`,
        { t: 1, var: 0 },
      ],
      // No translatable text: left unchanged
      ['<div />', `jsx("div", {})`, { t: 0, var: 0 }],
      [
        '<span>{42}</span> (numbers are data)',
        `jsx("span", { children: 42 })`,
        { t: 0, var: 0 },
      ],
      ['<div>{""}</div>', `jsx("div", { children: "" })`, { t: 0, var: 0 }],
      [
        '<div>{"   "}</div>',
        `jsx("div", { children: "   " })`,
        { t: 0, var: 0 },
      ],
      [
        '<div>{true} {false}</div>',
        `jsxs("div", { children: [true, " ", false] })`,
        { t: 0, var: 0 },
      ],
      [
        '<div>{firstName} {lastName}</div>',
        `jsxs("div", { children: [firstName, " ", lastName] })`,
        { t: 0, var: 0 },
      ],
      [
        '<ul>{items.map(i => <li>{i.name}</li>)}</ul>',
        `jsx("ul", { children: items.map(i => jsx("li", { children: i.name })) })`,
        { t: 0, var: 0 },
      ],
      // Malformed calls are a graceful no-op
      [
        'jsx("div", someVariable)',
        `jsx("div", someVariable)`,
        { t: 0, var: 0 },
      ],
      ['jsx("div")', `jsx("div")`, { t: 0, var: 0 }],
    ])('%s', (_jsx, compiled, counts) => {
      expect(insertedCounts(`${IMPORTS}${compiled};`)).toEqual(counts);
    });

    it.each([
      [
        'a jsx() imported from a non-React source',
        `import { jsx } from 'some-other-lib'; jsx("div", { children: "Hello" });`,
      ],
      [
        'a non-jsx function call',
        `someFunction("div", { children: "Hello" });`,
      ],
    ])('ignores %s', (_name, code) => {
      expect(insertedCounts(code)).toEqual({ t: 0, var: 0 });
    });
  });

  describe('_Var wrapping of children next to text', () => {
    // <div>Label: {expression}</div>
    const withText = (expression: string) =>
      `${IMPORTS}jsxs("div", { children: ["Label: ", ${expression}] });`;

    it.each([
      'name',
      'obj.price',
      'user?.name',
      'x ? "a" : "b"',
      'name ?? "Anonymous"',
      'getValue()',
      'await fetchData()',
      '"$" + amount',
      '`${name}!`',
      'html`<b>${x}</b>`',
      'items.map(i => jsx("li", { children: i.name }))',
    ])('wraps dynamic expression %s in _Var', (expression) => {
      expect(insertedCounts(withText(expression))).toEqual({ t: 1, var: 1 });
    });

    it.each([
      '"World"',
      '-5',
      'null',
      'undefined',
      'NaN',
      'Infinity',
      'jsx("b", { children: "World" })',
    ])('does not wrap static child %s', (expression) => {
      expect(insertedCounts(withText(expression))).toEqual({ t: 1, var: 0 });
    });

    it('gives each dynamic child its own _Var, nested inside the _T', () => {
      // <div>{a + "hello"}sometext{b}{c} and {d + e}</div>
      const { tCalls, varCalls } = insert(
        `${IMPORTS}jsxs("div", { children: [a + "hello", "sometext", b, c, " and ", d + e] });`
      );
      expect(tCalls).toHaveLength(1);
      expect(varCalls).toHaveLength(4);
      expect(childKinds(tCalls[0])).toEqual([
        'Var',
        'StringLiteral',
        'Var',
        'Var',
        'StringLiteral',
        'Var',
      ]);
    });
  });

  describe('scoping', () => {
    it.each<Case>([
      // _T goes on the highest element with text and claims its subtree
      [
        '<main><section><article><p><span>Deep text</span></p></article></section></main>',
        `jsx("main", { children: jsx("section", { children: jsx("article", { children: jsx("p", { children: jsx("span", { children: "Deep text" }) }) }) }) })`,
        { t: 1, var: 0 },
      ],
      [
        '<main>Root text <section><article><p><span>{name}</span></p></article></section></main>',
        `jsxs("main", { children: ["Root text ", jsx("section", { children: jsx("article", { children: jsx("p", { children: jsx("span", { children: name }) }) }) })] })`,
        { t: 1, var: 1 },
      ],
      // Siblings without text at the parent are independent
      [
        '<div><span>A</span><p><em>B</em></p></div>',
        `jsxs("div", { children: [jsx("span", { children: "A" }), jsx("p", { children: jsx("em", { children: "B" }) })] })`,
        { t: 2, var: 0 },
      ],
      [
        '<div> <span>A</span> <span>B</span> </div>',
        `jsxs("div", { children: [" ", jsx("span", { children: "A" }), " ", jsx("span", { children: "B" }), " "] })`,
        { t: 2, var: 0 },
      ],
      [
        '<tr><td>Name</td><td>{user.name}</td><td>Age: {user.age}</td></tr>',
        `jsxs("tr", { children: [jsx("td", { children: "Name" }), jsx("td", { children: user.name }), jsxs("td", { children: ["Age: ", user.age] })] })`,
        { t: 2, var: 1 },
      ],
      [
        'function Header() { return <h1>Welcome</h1> } function Footer() { return <p>Copyright {year}</p> }',
        `function Header() { return jsx("h1", { children: "Welcome" }); }
         function Footer() { return jsxs("p", { children: ["Copyright ", year] }); }`,
        { t: 2, var: 1 },
      ],
      // JSX inside an auto-inserted _Var is still processed
      [
        '<div>Status: {isActive ? <span>Active</span> : <span>Inactive</span>}</div>',
        `jsxs("div", { children: ["Status: ", isActive ? jsx("span", { children: "Active" }) : jsx("span", { children: "Inactive" })] })`,
        { t: 3, var: 1 },
      ],
      [
        '<div>Hello {show && visible && <span>Content</span>}</div>',
        `jsxs("div", { children: ["Hello ", show && visible && jsx("span", { children: "Content" })] })`,
        { t: 2, var: 1 },
      ],
      [
        '<div>{flag ? <p>Yes</p> : <p>No</p>}</div> (no text at the parent)',
        `jsx("div", { children: flag ? jsx("p", { children: "Yes" }) : jsx("p", { children: "No" }) })`,
        { t: 2, var: 0 },
      ],
      // Non-children props are independent subtrees
      [
        '<Card header={<h1>Title</h1>}>Body text</Card>',
        `jsx(Card, { header: jsx("h1", { children: "Title" }), children: "Body text" })`,
        { t: 2, var: 0 },
      ],
      [
        '<Card header={<h1>Title</h1>}><div /></Card>',
        `jsx(Card, { header: jsx("h1", { children: "Title" }), children: jsx("div", {}) })`,
        { t: 1, var: 0 },
      ],
      [
        '<Layout header={<h1>Header</h1>} footer={<p>Footer</p>}>Main</Layout>',
        `jsx(Layout, { header: jsx("h1", { children: "Header" }), footer: jsx("p", { children: "Footer" }), children: "Main" })`,
        { t: 3, var: 0 },
      ],
      [
        '<Card header={<h1>Title {count}</h1>}>Body</Card>',
        `jsx(Card, { header: jsxs("h1", { children: ["Title ", count] }), children: "Body" })`,
        { t: 2, var: 1 },
      ],
      [
        '<div>Hello <Button icon={<span>X</span>}>Click</Button></div> (parent claim does not leak into the prop)',
        `jsxs("div", { children: ["Hello ", jsx(Button, { icon: jsx("span", { children: "X" }), children: "Click" })] })`,
        { t: 2, var: 0 },
      ],
    ])('%s', (_jsx, compiled, counts) => {
      expect(insertedCounts(`${IMPORTS}${compiled};`)).toEqual(counts);
    });

    it('handles a page mixing text, links, Derive and Branch', () => {
      const code = `${IMPORTS}
        jsxs("div", { children: [
          jsx("header", { children: jsxs("h1", { children: ["Welcome to ", siteName] }) }),
          jsxs("nav", { children: [
            jsx("a", { children: "Home" }),
            jsx("a", { children: "About" })
          ] }),
          jsxs("main", { children: [
            "Hello ",
            jsx(Derive, { children: getGreeting() }),
            "!"
          ] }),
          jsx("footer", { children: jsx(Branch, { branch: "type", legal: "Legal info", children: "Default footer" }) })
        ] });
      `;
      // _T: h1, two links, main (text + Derive), footer (Branch). _Var: {siteName}
      expect(insertedCounts(code)).toEqual({ t: 5, var: 1 });
    });
  });

  describe('user-written GT components are left alone', () => {
    it.each(['Var', 'Num', 'Currency', 'DateTime', 'RelativeTime'])(
      '<div>Value: <%s>{value}</%s></div> gets _T but no _Var',
      (component) => {
        expect(
          insertedCounts(
            `${IMPORTS}jsxs("div", { children: ["Value: ", jsx(${component}, { children: value })] });`
          )
        ).toEqual({ t: 1, var: 0 });
      }
    );

    it.each<Case>([
      ['<T>Hello</T>', `jsx(T, { children: "Hello" })`, { t: 0, var: 0 }],
      [
        '<T>Hello <span>{name} <b>World</b></span></T>',
        `jsx(T, { children: jsxs("span", { children: [name, " ", jsx("b", { children: "World" })] }) })`,
        { t: 0, var: 0 },
      ],
      [
        '<div><T>Manual</T><span>Auto</span></div>',
        `jsxs("div", { children: [jsx(T, { children: "Manual" }), jsx("span", { children: "Auto" })] })`,
        { t: 1, var: 0 },
      ],
      [
        '<div>Hello <Var>{x}</Var> and {y}</div>',
        `jsxs("div", { children: ["Hello ", jsx(Var, { children: x }), " and ", y] })`,
        { t: 1, var: 1 },
      ],
      // Nothing inside a user variable component is touched
      [
        '<div>Hello <Var>{flag ? <p>A</p> : <p>B</p>}</Var></div>',
        `jsxs("div", { children: ["Hello ", jsx(Var, { children: flag ? jsx("p", { children: "A" }) : jsx("p", { children: "B" }) })] })`,
        { t: 1, var: 0 },
      ],
      [
        '<div>Items: <Var>{items.map(i => <li>{i.name}</li>)}</Var></div>',
        `jsxs("div", { children: ["Items: ", jsx(Var, { children: items.map(i => jsx("li", { children: i.name })) })] })`,
        { t: 1, var: 0 },
      ],
      [
        '<div>Card: <Var>{<Card header={<h1>Title</h1>}>Body</Card>}</Var></div>',
        `jsxs("div", { children: ["Card: ", jsx(Var, { children: jsx(Card, { header: jsx("h1", { children: "Title" }), children: "Body" }) })] })`,
        { t: 1, var: 0 },
      ],
      [
        '<div>Price: <Num>{flag ? <span>Discounted</span> : price}</Num></div>',
        `jsxs("div", { children: ["Price: ", jsx(Num, { children: flag ? jsx("span", { children: "Discounted" }) : price })] })`,
        { t: 1, var: 0 },
      ],
      [
        '<Layout sidebar={<Var>{<nav>Links</nav>}</Var>}>Body text</Layout>',
        `jsx(Layout, { sidebar: jsx(Var, { children: jsx("nav", { children: "Links" }) }), children: "Body text" })`,
        { t: 1, var: 0 },
      ],
      // ...and insertion resumes for siblings after the component closes
      [
        '<div><Var>{<p>Opaque</p>}</Var><span>Auto {x}</span></div>',
        `jsxs("div", { children: [jsx(Var, { children: jsx("p", { children: "Opaque" }) }), jsxs("span", { children: ["Auto ", x] })] })`,
        { t: 1, var: 1 },
      ],
    ])('%s', (_jsx, compiled, counts) => {
      expect(insertedCounts(`${IMPORTS}${compiled};`)).toEqual(counts);
    });

    it.each([
      [
        'GtInternalTranslateJsx',
        `import { jsx } from 'react/jsx-runtime';
         import { GtInternalTranslateJsx } from 'gt-react/browser';
         jsx("div", { children: jsx(GtInternalTranslateJsx, { children: "Hello" }) });`,
        { t: 1, var: 0 },
      ],
      [
        'GtInternalVar',
        `import { jsx, jsxs } from 'react/jsx-runtime';
         import { GtInternalTranslateJsx, GtInternalVar } from 'gt-react/browser';
         jsxs("div", { children: ["Hello ", jsx(GtInternalVar, { children: name })] });`,
        { t: 1, var: 1 },
      ],
    ])('does not re-wrap an existing %s', (_name, code, counts) => {
      expect(insertedCounts(code)).toEqual(counts);
    });
  });

  describe('Branch, Plural and Derive', () => {
    it.each<Case>([
      // Branch/Plural trigger _T at the parent (or around themselves at the
      // root); their props and children get no _T of their own
      [
        '<div><Branch branch="x" a="A" b="B">Fallback</Branch></div>',
        `jsx("div", { children: jsx(Branch, { branch: "x", a: "A", b: "B", children: "Fallback" }) })`,
        { t: 1, var: 0 },
      ],
      [
        '<Branch branch="x" a="A">Default</Branch> (root)',
        `jsx(Branch, { branch: "x", a: "A", children: "Default" })`,
        { t: 1, var: 0 },
      ],
      [
        '<Plural n={n} one={<strong>one</strong>}>other</Plural> (root)',
        `jsx(Plural, { n: n, one: jsx("strong", { children: "one" }), children: "other" })`,
        { t: 1, var: 0 },
      ],
      [
        '<div><Branch branch="mode" summary={<p>Summary text</p>}>Fallback</Branch></div>',
        `jsx("div", { children: jsx(Branch, { branch: "mode", summary: jsx("p", { children: "Summary text" }), children: "Fallback" }) })`,
        { t: 1, var: 0 },
      ],
      [
        '<div><Plural n={count} one={<span>One item</span>} other={<span>Many items</span>} /></div>',
        `jsx("div", { children: jsx(Plural, { n: count, one: jsx("span", { children: "One item" }), other: jsx("span", { children: "Many items" }) }) })`,
        { t: 1, var: 0 },
      ],
      [
        '<div><Branch branch="test"><p>Fallback text</p></Branch></div>',
        `jsx("div", { children: jsx(Branch, { branch: "test", children: jsx("p", { children: "Fallback text" }) }) })`,
        { t: 1, var: 0 },
      ],
      [
        '<div>Label: <Branch branch="x">fb</Branch><Plural n={c} one="1" other="n" /></div>',
        `jsxs("div", { children: ["Label: ", jsx(Branch, { branch: "x", children: "fb" }), jsx(Plural, { n: c, one: "1", other: "n" })] })`,
        { t: 1, var: 0 },
      ],
      [
        '<div><Plural n={c}><Branch branch="x">fb</Branch></Plural></div>',
        `jsx("div", { children: jsx(Plural, { n: c, children: jsx(Branch, { branch: "x", children: "fb" }) }) })`,
        { t: 1, var: 0 },
      ],
      // Dynamic content props are wrapped in _Var; control and data-* props are not
      [
        '<div><Branch branch="hello" hello={count} /></div>',
        `jsx("div", { children: jsx(Branch, { branch: "hello", hello: count }) })`,
        { t: 1, var: 1 },
      ],
      [
        '<div><Branch branch="x" data-testid="test" hello={val}>fb</Branch></div>',
        `jsx("div", { children: jsx(Branch, { branch: "x", "data-testid": "test", hello: val, children: "fb" }) })`,
        { t: 1, var: 1 },
      ],
      [
        '<div><Branch branch="mode" summary={cond ? <p>Option A</p> : <p>Option B</p>}>Fallback</Branch></div>',
        `jsx("div", { children: jsx(Branch, { branch: "mode", summary: cond ? jsx("p", { children: "Option A" }) : jsx("p", { children: "Option B" }), children: "Fallback" }) })`,
        { t: 3, var: 1 },
      ],
      // Derive children are opaque: no _Var
      [
        '<div>Hello <Derive>{getName()}</Derive></div>',
        `jsxs("div", { children: ["Hello ", jsx(Derive, { children: getName() })] })`,
        { t: 1, var: 0 },
      ],
      [
        '<div>Hello <Derive>{getX()}</Derive> and {z}</div>',
        `jsxs("div", { children: ["Hello ", jsx(Derive, { children: getX() }), " and ", z] })`,
        { t: 1, var: 1 },
      ],
      [
        '<><Derive>{getContent()}</Derive></>',
        `jsx(Fragment, { children: jsx(Derive, { children: getContent() }) })`,
        { t: 1, var: 0 },
      ],
      // The visitor cannot know an element sits inside Derive, so it still
      // inserts there; removeInjectedT() strips the nested _T at runtime
      [
        '<div>Hello <Derive><Branch branch="x">fb</Branch></Derive></div>',
        `jsxs("div", { children: ["Hello ", jsx(Derive, { children: jsx(Branch, { branch: "x", children: "fb" }) })] })`,
        { t: 2, var: 0 },
      ],
      [
        '<div>Hello <Derive><Derive>{getInner()}</Derive></Derive></div>',
        `jsxs("div", { children: ["Hello ", jsx(Derive, { children: jsx(Derive, { children: getInner() }) })] })`,
        { t: 2, var: 0 },
      ],
      [
        '<div>Label: <Derive><>Hello {name}</></Derive></div>',
        `jsxs("div", { children: ["Label: ", jsx(Derive, { children: jsxs(Fragment, { children: ["Hello ", name] }) })] })`,
        { t: 2, var: 1 },
      ],
    ])('%s', (_jsx, compiled, counts) => {
      expect(insertedCounts(`${IMPORTS}${compiled};`)).toEqual(counts);
    });

    it('never wraps the Plural selector prop in _Var', () => {
      // <div><Plural n={count} one="item" other="items" /></div>
      const { output, tCalls, varCalls } = insert(
        `${IMPORTS}jsx("div", { children: jsx(Plural, { n: count, one: "item", other: "items" }) });`
      );
      expect(tCalls).toHaveLength(1);
      expect(varCalls).toHaveLength(0);
      expect(output).toMatch(/n:\s*count/);
    });

    it.each<[jsx: string, compiled: string, kept: RegExp[]]>([
      [
        '<div><Branch branch="mode" Ernest={<>Hello {userName}</>} /></div>',
        `jsx("div", { children: jsx(Branch, { branch: "mode", Ernest: jsxs(Fragment, { children: ["Hello ", userName] }) }) })`,
        [/branch:\s*"mode"/],
      ],
      // Fallback children are processed element by element, not wrapped whole
      [
        '<>Hello, my good friend<Branch branch={userName}>Fallback with Var {userName}</Branch></>',
        `jsxs(Fragment, { children: ["Hello, my good friend", jsxs(Branch, { branch: userName, children: ["Fallback with Var ", userName] })] })`,
        [/branch:\s*userName/, /"Fallback with Var "/],
      ],
      [
        '<div><Plural n={count}>You have {count} items</Plural></div>',
        `jsx("div", { children: jsxs(Plural, { n: count, children: ["You have ", count, " items"] }) })`,
        [/n:\s*count/, /"You have "/, /" items"/],
      ],
    ])(
      '%s wraps only the dynamic identifier in _Var',
      (_jsx, compiled, kept) => {
        const { output, tCalls, varCalls } = insert(`${IMPORTS}${compiled};`);
        expect(tCalls).toHaveLength(1);
        expect(varCalls).toHaveLength(1);
        const varProps = varCalls[0].arguments[1] as t.ObjectExpression;
        expect(
          t.isIdentifier((varProps.properties[0] as t.ObjectProperty).value)
        ).toBe(true);
        for (const pattern of kept) expect(output).toMatch(pattern);
      }
    );
  });

  describe('jsx callee of the inserted wrappers', () => {
    it.each([
      [
        'jsx for a single-child _T',
        `import { jsx } from 'react/jsx-runtime'; jsx("div", { children: "Hello" });`,
        { t: 'jsx', var: undefined },
      ],
      [
        'jsxs for an array-children _T, jsx for _Var',
        `import { jsx, jsxs } from 'react/jsx-runtime'; jsxs("div", { children: ["Hello ", name] });`,
        { t: 'jsxs', var: 'jsx' },
      ],
      [
        'aliased jsx / jsxs imports',
        `import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime'; _jsxs("div", { children: ["Hello ", name] });`,
        { t: '_jsxs', var: '_jsx' },
      ],
      [
        'jsxDEV for both in dev mode',
        `import { jsxDEV as _jsxDEV } from 'react/jsx-dev-runtime'; _jsxDEV("div", { children: ["Hello ", name] });`,
        { t: '_jsxDEV', var: '_jsxDEV' },
      ],
    ])('uses %s', (_name, code, callees) => {
      const { tCalls, varCalls } = insert(code);
      expect(tCalls).toHaveLength(1);
      expect(calleeName(tCalls[0])).toBe(callees.t);
      expect(varCalls.map(calleeName)).toEqual(
        callees.var ? [callees.var] : []
      );
    });

    it('switches the parent from jsxs to jsx once its children are a single _T', () => {
      const { output } = insert(
        `import { jsx, jsxs } from 'react/jsx-runtime'; jsxs("div", { children: ["Hello ", name] });`
      );
      expect(output).toMatch(/\bjsx\("div"/);
      expect(output).not.toMatch(/\bjsxs\("div"/);
    });

    it('sets jsxDEV isStaticChildren for the parent, _T and _Var with array children', () => {
      const { output, tCalls, varCalls } = insert(`
        import { jsxDEV } from 'react/jsx-dev-runtime';
        jsxDEV("div", { children: ["Hello ", name] }, undefined, true);
      `);
      // Parent now has a single _T child
      expect(output).toMatch(
        /jsxDEV\("div",\s*\{[\s\S]*?\},\s*void 0,\s*false/
      );
      expect(tCalls).toHaveLength(1);
      expect(t.isBooleanLiteral(tCalls[0].arguments[3], { value: true })).toBe(
        true
      );
      expect(varCalls).toHaveLength(1);
      expect(
        t.isBooleanLiteral(varCalls[0].arguments[3], { value: false })
      ).toBe(true);
    });

    it('sets jsxDEV isStaticChildren=false for a single-child _T', () => {
      const { tCalls } = insert(`
        import { jsxDEV } from 'react/jsx-dev-runtime';
        jsxDEV("div", { children: "Hello" }, undefined, false);
      `);
      expect(tCalls).toHaveLength(1);
      expect(t.isBooleanLiteral(tCalls[0].arguments[3], { value: false })).toBe(
        true
      );
    });
  });

  describe('import injection', () => {
    const HELLO = `import { jsx } from 'react/jsx-runtime'; jsx("div", { children: "Hello" });`;

    it('imports GtInternalTranslateJsx and GtInternalVar from gt-react', () => {
      const { ast } = insert(HELLO);
      expect(importedNames(ast, 'gt-react')).toEqual(
        expect.arrayContaining(['GtInternalTranslateJsx', 'GtInternalVar'])
      );
    });

    it.each([
      [
        'gt-react/browser with the legacy flag',
        { legacyGtReactImportSource: true },
        'gt-react/browser',
      ],
      [
        'a configured autoJsxImportSource',
        { autoJsxImportSource: 'gt-next' },
        'gt-next',
      ],
    ])('imports from %s', (_name, options, source) => {
      const sources = importSources(insert(HELLO, options).ast);
      expect(sources.filter((s) => s === source)).toHaveLength(1);
    });

    it('does not inject an import when nothing was inserted', () => {
      const { ast } = insert(
        `import { jsx } from 'react/jsx-runtime'; jsx("div", {});`
      );
      expect(importSources(ast)).toEqual(['react/jsx-runtime']);
    });

    it.each([
      ['gt-react/browser', {}],
      ['@acme/gt', { autoJsxImportSource: '@acme/gt' }],
    ])('does not duplicate an existing import from %s', (source, options) => {
      const { ast } = insert(
        `import { GtInternalTranslateJsx, GtInternalVar } from '${source}';\n${HELLO}`,
        options
      );
      expect(importSources(ast).filter((s) => s === source)).toHaveLength(1);
    });
  });
});
