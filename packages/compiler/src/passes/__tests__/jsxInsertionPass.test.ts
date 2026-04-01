import { describe, it, expect } from 'vitest';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import { jsxInsertionPass } from '../jsxInsertionPass';
import { initializeState } from '../../state/utils/initializeState';

// --- Helpers ---

function transform(code: string): {
  code: string;
  gtTranslateCalls: t.CallExpression[];
  gtVarCalls: t.CallExpression[];
  imports: t.ImportDeclaration[];
} {
  const state = initializeState({ enableAutoJsxInjection: true }, 'test.tsx');
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['typescript'],
  });
  traverse(ast, jsxInsertionPass(state));

  const gtTranslateCalls: t.CallExpression[] = [];
  const gtVarCalls: t.CallExpression[] = [];
  const imports: t.ImportDeclaration[] = [];

  traverse(ast, {
    CallExpression(path) {
      if (path.node.arguments.length < 1) return;
      const firstArg = path.node.arguments[0];
      if (t.isIdentifier(firstArg, { name: 'GtInternalTranslateJsx' })) {
        gtTranslateCalls.push(path.node);
      } else if (t.isIdentifier(firstArg, { name: 'GtInternalVar' })) {
        gtVarCalls.push(path.node);
      }
    },
    ImportDeclaration(path) {
      imports.push(path.node);
    },
  });

  return { code: generate(ast).code, gtTranslateCalls, gtVarCalls, imports };
}

// --- Tests ---

describe('jsxInsertionPass', () => {
  // ===== T insertion =====

  it('wraps string children in _T', () => {
    // BEFORE JSX:  <div>Hello</div>
    // AFTER JSX:   <div><_T>Hello</_T></div>
    const code = `
      import { jsx } from 'react/jsx-runtime';
      jsx("div", { children: "Hello" });
    `;
    const { gtTranslateCalls, code: out } = transform(code);
    expect(gtTranslateCalls).toHaveLength(1);
    expect(out).toContain('GtInternalTranslateJsx');
  });

  it('wraps numeric children in _T', () => {
    // BEFORE JSX:  <span>{42}</span>
    // AFTER JSX:   <span><_T>{42}</_T></span>
    const code = `
      import { jsx } from 'react/jsx-runtime';
      jsx("span", { children: 42 });
    `;
    const { gtTranslateCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(1);
  });

  // ===== Var wrapping =====

  it('wraps identifier in _Var inside _T', () => {
    // BEFORE JSX:  <div>Hello {name}</div>
    // AFTER JSX:   <div><_T>Hello <_Var>{name}</_Var></_T></div>
    const code = `
      import { jsxs } from 'react/jsx-runtime';
      jsxs("div", { children: ["Hello ", name] });
    `;
    const { gtTranslateCalls, gtVarCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(1);
    expect(gtVarCalls).toHaveLength(1);
  });

  it('wraps member expression in _Var', () => {
    // BEFORE JSX:  <div>Price: {obj.price}</div>
    // AFTER JSX:   <div><_T>Price: <_Var>{obj.price}</_Var></_T></div>
    const code = `
      import { jsxs } from 'react/jsx-runtime';
      jsxs("div", { children: ["Price: ", obj.price] });
    `;
    const { gtTranslateCalls, gtVarCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(1);
    expect(gtVarCalls).toHaveLength(1);
  });

  it('wraps conditional in _Var', () => {
    // BEFORE JSX:  <div>Status: {x ? "a" : "b"}</div>
    // AFTER JSX:   <div><_T>Status: <_Var>{x ? "a" : "b"}</_Var></_T></div>
    const code = `
      import { jsxs } from 'react/jsx-runtime';
      jsxs("div", { children: ["Status: ", x ? "a" : "b"] });
    `;
    const { gtTranslateCalls, gtVarCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(1);
    expect(gtVarCalls).toHaveLength(1);
  });

  it('wraps non-jsx call in _Var', () => {
    // BEFORE JSX:  <div>Result: {getValue()}</div>
    // AFTER JSX:   <div><_T>Result: <_Var>{getValue()}</_Var></_T></div>
    const code = `
      import { jsxs } from 'react/jsx-runtime';
      jsxs("div", { children: ["Result: ", getValue()] });
    `;
    const { gtTranslateCalls, gtVarCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(1);
    expect(gtVarCalls).toHaveLength(1);
  });

  it('wraps interpolated template literal in _Var', () => {
    // BEFORE JSX:  <div>Hello {`${name}!`}</div>
    // AFTER JSX:   <div><_T>Hello <_Var>{`${name}!`}</_Var></_T></div>
    const code = `
      import { jsxs } from 'react/jsx-runtime';
      jsxs("div", { children: ["Hello ", \`\${name}!\`] });
    `;
    const { gtTranslateCalls, gtVarCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(1);
    expect(gtVarCalls).toHaveLength(1);
  });

  it('does NOT wrap string literals in _Var', () => {
    // BEFORE JSX:  <div>Hello World</div>
    // AFTER JSX:   <div><_T>Hello World</_T></div>
    const code = `
      import { jsxs } from 'react/jsx-runtime';
      jsxs("div", { children: ["Hello ", "World"] });
    `;
    const { gtTranslateCalls, gtVarCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(1);
    expect(gtVarCalls).toHaveLength(0);
  });

  it('does NOT wrap nested jsx elements in _Var', () => {
    // BEFORE JSX:  <div>Hello <b>World</b></div>
    // AFTER JSX:   <div><_T>Hello <b>World</b></_T></div>
    const code = `
      import { jsxs, jsx } from 'react/jsx-runtime';
      jsxs("div", { children: ["Hello ", jsx("b", { children: "World" })] });
    `;
    const { gtTranslateCalls, gtVarCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(1);
    expect(gtVarCalls).toHaveLength(0);
  });

  it('does NOT wrap static template literal in _Var', () => {
    // BEFORE JSX:  <div>{`Hello`}</div>
    // AFTER JSX:   <div><_T>{`Hello`}</_T></div>
    const code = `
      import { jsx } from 'react/jsx-runtime';
      jsx("div", { children: \`Hello\` });
    `;
    const { gtTranslateCalls, gtVarCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(1);
    expect(gtVarCalls).toHaveLength(0);
  });

  // ===== Skip cases =====

  it('does NOT insert _T when no children', () => {
    // BEFORE JSX:  <div />
    // AFTER JSX:   <div />  — unchanged
    const code = `
      import { jsx } from 'react/jsx-runtime';
      jsx("div", {});
    `;
    const { gtTranslateCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(0);
  });

  it('does NOT insert _T when only dynamic content and whitespace', () => {
    // BEFORE JSX:  <div>{firstName} {lastName}</div>
    // AFTER JSX:   <div>{firstName} {lastName}</div>  — unchanged
    const code = `
      import { jsxs } from 'react/jsx-runtime';
      jsxs("div", { children: [firstName, " ", lastName] });
    `;
    const { gtTranslateCalls, gtVarCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(0);
    expect(gtVarCalls).toHaveLength(0);
  });

  // ===== User-inserted components (hands off) =====

  it('does NOT insert _T when component is user T', () => {
    // BEFORE JSX:  <T>Hello</T>
    // AFTER JSX:   <T>Hello</T>  — unchanged
    const code = `
      import { jsx } from 'react/jsx-runtime';
      import { T } from 'gt-react';
      jsx(T, { children: "Hello" });
    `;
    const { gtTranslateCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(0);
  });

  it('does NOT modify children of user T with user Var', () => {
    // BEFORE JSX:  <T>Hello <Var>{name}</Var></T>
    // AFTER JSX:   <T>Hello <Var>{name}</Var></T>  — unchanged
    const code = `
      import { jsx, jsxs } from 'react/jsx-runtime';
      import { T, Var } from 'gt-react';
      jsxs(T, { children: ["Hello ", jsx(Var, { children: name })] });
    `;
    const { gtTranslateCalls, gtVarCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(0);
    expect(gtVarCalls).toHaveLength(0);
  });

  it('does NOT insert _T or _Var anywhere inside nested user T', () => {
    // BEFORE JSX:  <T>Hello <span>{name} <b>World</b></span></T>
    // AFTER JSX:   unchanged — user T means completely hands off all descendants
    const code = `
      import { jsx, jsxs } from 'react/jsx-runtime';
      import { T } from 'gt-react';
      jsx(T, { children: jsxs("span", { children: [name, " ", jsx("b", { children: "World" })] }) });
    `;
    const { gtTranslateCalls, gtVarCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(0);
    expect(gtVarCalls).toHaveLength(0);
  });

  it('inserts _T but does NOT touch user Var', () => {
    // BEFORE JSX:  <div>Hello <Var>{name}</Var></div>
    // AFTER JSX:   <div><_T>Hello <Var>{name}</Var></_T></div>
    const code = `
      import { jsx, jsxs } from 'react/jsx-runtime';
      import { Var } from 'gt-react';
      jsxs("div", { children: ["Hello ", jsx(Var, { children: name })] });
    `;
    const { gtTranslateCalls, gtVarCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(1);
    expect(gtVarCalls).toHaveLength(0);
  });

  it('inserts _T but does NOT touch user Num', () => {
    // BEFORE JSX:  <div>Price: <Num>{price}</Num></div>
    // AFTER JSX:   <div><_T>Price: <Num>{price}</Num></_T></div>
    const code = `
      import { jsx, jsxs } from 'react/jsx-runtime';
      import { Num } from 'gt-react';
      jsxs("div", { children: ["Price: ", jsx(Num, { children: price })] });
    `;
    const { gtTranslateCalls, gtVarCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(1);
    expect(gtVarCalls).toHaveLength(0);
  });

  // ===== Nesting =====

  it('inserts _T at deepest level with text', () => {
    // BEFORE JSX:  <div><span>Click me</span></div>
    // AFTER JSX:   <div><span><_T>Click me</_T></span></div>
    const code = `
      import { jsx } from 'react/jsx-runtime';
      jsx("div", { children: jsx("span", { children: "Click me" }) });
    `;
    const { gtTranslateCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(1);
  });

  it('inserts _T three levels deep', () => {
    // BEFORE JSX:  <main><section><p>Deep</p></section></main>
    // AFTER JSX:   <main><section><p><_T>Deep</_T></p></section></main>
    const code = `
      import { jsx } from 'react/jsx-runtime';
      jsx("main", { children:
        jsx("section", { children:
          jsx("p", { children: "Deep" })
        })
      });
    `;
    const { gtTranslateCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(1);
  });

  it('inserts _T at parent when parent has direct text', () => {
    // BEFORE JSX:  <div>Hello <b>World</b> today</div>
    // AFTER JSX:   <div><_T>Hello <b>World</b> today</_T></div>
    const code = `
      import { jsxs, jsx } from 'react/jsx-runtime';
      jsxs("div", { children: ["Hello ", jsx("b", { children: "World" }), " today"] });
    `;
    const { gtTranslateCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(1);
  });

  it('handles siblings with text at different depths', () => {
    // BEFORE JSX:  <div><span>A</span><p><em>B</em></p></div>
    // AFTER JSX:   <div><span><_T>A</_T></span><p><em><_T>B</_T></em></p></div>
    const code = `
      import { jsx, jsxs } from 'react/jsx-runtime';
      jsxs("div", { children: [
        jsx("span", { children: "A" }),
        jsx("p", { children: jsx("em", { children: "B" }) })
      ] });
    `;
    const { gtTranslateCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(2);
  });

  // ===== Branch/Derive =====

  it('inserts _T at parent when child is Branch', () => {
    // BEFORE JSX:  <div><Branch branch="test">Fallback</Branch></div>
    // AFTER JSX:   <div><_T><Branch branch="test">Fallback</Branch></_T></div>
    const code = `
      import { jsx } from 'react/jsx-runtime';
      import { Branch } from 'gt-react';
      jsx("div", { children: jsx(Branch, { branch: "test", children: "Fallback" }) });
    `;
    const { gtTranslateCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(1);
  });

  it('does NOT insert _T inside Branch prop arguments', () => {
    // BEFORE JSX:  <div><Branch branch="mode" summary={<p>Summary text</p>}>Fallback</Branch></div>
    // AFTER JSX:   <div><_T><Branch branch="mode" summary={<p>Summary text</p>}>Fallback</Branch></_T></div>
    // The summary prop JSX should NOT get its own _T — Branch args are opaque
    const code = `
      import { jsx } from 'react/jsx-runtime';
      import { Branch } from 'gt-react';
      jsx("div", { children: jsx(Branch, { branch: "mode", summary: jsx("p", { children: "Summary text" }), children: "Fallback" }) });
    `;
    const { gtTranslateCalls } = transform(code);
    // Only 1 _T at the div level wrapping Branch — no _T inside the summary prop
    expect(gtTranslateCalls).toHaveLength(1);
  });

  it('does NOT insert _T inside Plural prop arguments', () => {
    // BEFORE JSX:  <div><Plural n={count} one={<span>One item</span>} other={<span>Many items</span>} /></div>
    // AFTER JSX:   <div><_T><Plural ... /></_T></div>
    // The one/other prop JSX should NOT get _T — Plural args are opaque
    const code = `
      import { jsx } from 'react/jsx-runtime';
      import { Plural } from 'gt-react';
      jsx("div", { children: jsx(Plural, { n: count, one: jsx("span", { children: "One item" }), other: jsx("span", { children: "Many items" }) }) });
    `;
    const { gtTranslateCalls } = transform(code);
    // Only 1 _T at div level — no _T inside one/other props
    expect(gtTranslateCalls).toHaveLength(1);
  });

  it('does NOT insert _T inside Branch children either', () => {
    // BEFORE JSX:  <div><Branch branch="test"><p>Fallback text</p></Branch></div>
    // AFTER JSX:   <div><_T><Branch branch="test"><p>Fallback text</p></Branch></_T></div>
    // Branch children are also opaque — no _T inside them
    const code = `
      import { jsx } from 'react/jsx-runtime';
      import { Branch } from 'gt-react';
      jsx("div", { children: jsx(Branch, { branch: "test", children: jsx("p", { children: "Fallback text" }) }) });
    `;
    const { gtTranslateCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(1);
  });

  it('wraps dynamic Branch prop value in _Var', () => {
    // BEFORE JSX:  <div><Branch branch="hello" hello={count} /></div>
    // AFTER JSX:   <div><_T><Branch branch="hello" hello={<_Var>{count}</_Var>} /></_T></div>
    // count is dynamic → _Var wraps it (Branch is inside _T region)
    const code = `
      import { jsx } from 'react/jsx-runtime';
      import { Branch } from 'gt-react';
      jsx("div", { children: jsx(Branch, { branch: "hello", hello: count }) });
    `;
    const { gtTranslateCalls, gtVarCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(1);
    expect(gtVarCalls).toHaveLength(1);
  });

  it('wraps ternary in Branch prop with _Var and inserts _T in nested JSX', () => {
    // BEFORE JSX:  <div><Branch branch="mode" summary={cond ? <p>Option A</p> : <p>Option B</p>}>Fallback</Branch></div>
    // AFTER JSX:   <div><_T><Branch branch="mode" summary={<_Var>{cond ? <p><_T>Option A</_T></p> : <p><_T>Option B</_T></p>}</_Var>}>Fallback</Branch></_T></div>
    // The ternary is dynamic → _Var. The <p> elements inside have text → each gets _T.
    const code = `
      import { jsx } from 'react/jsx-runtime';
      import { Branch } from 'gt-react';
      jsx("div", { children: jsx(Branch, { branch: "mode", summary: cond ? jsx("p", { children: "Option A" }) : jsx("p", { children: "Option B" }), children: "Fallback" }) });
    `;
    const { gtTranslateCalls, gtVarCalls } = transform(code);
    // 3 _Ts: one at div (wrapping Branch), one for "Option A", one for "Option B"
    expect(gtTranslateCalls).toHaveLength(3);
    // 1 _Var: the ternary expression
    expect(gtVarCalls).toHaveLength(1);
  });

  // ===== Non-children props (independent subtrees) =====

  it('inserts _T in a non-children prop independently from children', () => {
    // BEFORE JSX:  <Card header={<h1>Title</h1>}>Body text</Card>
    // AFTER JSX:   <Card header={<h1><_T>Title</_T></h1>}><_T>Body text</_T></Card>
    const code = `
      import { jsx } from 'react/jsx-runtime';
      jsx(Card, { header: jsx("h1", { children: "Title" }), children: "Body text" });
    `;
    const { gtTranslateCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(2);
  });

  it('inserts _T in prop JSX even when children have no text', () => {
    // BEFORE JSX:  <Card header={<h1>Title</h1>}><div /></Card>
    // AFTER JSX:   <Card header={<h1><_T>Title</_T></h1>}><div /></Card>
    const code = `
      import { jsx } from 'react/jsx-runtime';
      jsx(Card, { header: jsx("h1", { children: "Title" }), children: jsx("div", {}) });
    `;
    const { gtTranslateCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(1);
  });

  it('does NOT let parent _T claim leak into non-children prop', () => {
    // BEFORE JSX:  <div>Hello <Button icon={<span>X</span>}>Click</Button></div>
    // AFTER JSX:   <div><_T>Hello <Button icon={<span><_T>X</_T></span>}>Click</Button></_T></div>
    // div has direct text "Hello " → _T at div, "Click" is part of that unit.
    // But "X" in icon prop is independent → gets its own _T.
    const code = `
      import { jsx, jsxs } from 'react/jsx-runtime';
      jsxs("div", { children: ["Hello ", jsx(Button, { icon: jsx("span", { children: "X" }), children: "Click" })] });
    `;
    const { gtTranslateCalls } = transform(code);
    // 2 _Ts: one at div ("Hello ... Click"), one for "X" in icon prop (independent)
    expect(gtTranslateCalls).toHaveLength(2);
  });

  it('inserts _T in multiple non-children props independently', () => {
    // BEFORE JSX:  <Layout header={<h1>Header</h1>} footer={<p>Footer</p>}>Main</Layout>
    // AFTER JSX:   each prop and children gets its own _T
    const code = `
      import { jsx } from 'react/jsx-runtime';
      jsx(Layout, {
        header: jsx("h1", { children: "Header" }),
        footer: jsx("p", { children: "Footer" }),
        children: "Main"
      });
    `;
    const { gtTranslateCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(3);
  });

  // ===== Imports =====

  it('injects import when insertions happen', () => {
    const code = `
      import { jsx } from 'react/jsx-runtime';
      jsx("div", { children: "Hello" });
    `;
    const { imports } = transform(code);
    const gtImport = imports.find((i) => i.source.value === 'gt-react/browser');
    expect(gtImport).toBeDefined();
    const names = gtImport!.specifiers
      .filter((s): s is t.ImportSpecifier => t.isImportSpecifier(s))
      .map((s) => (s.imported as t.Identifier).name);
    expect(names).toContain('GtInternalTranslateJsx');
    expect(names).toContain('GtInternalVar');
  });

  it('does NOT inject import when no insertions', () => {
    const code = `
      import { jsx } from 'react/jsx-runtime';
      jsx("div", {});
    `;
    const { imports } = transform(code);
    const gtImport = imports.find((i) => i.source.value === 'gt-react/browser');
    expect(gtImport).toBeUndefined();
  });

  // ===== Structural: Var must be nested inside T =====

  it('Var wrapper appears as a descendant of T wrapper, not a sibling', () => {
    // BEFORE JSX:  <div>Hello {name}</div>
    // AFTER JSX:   <div><_T>Hello <_Var>{name}</_Var></_T></div>
    // The _Var must be INSIDE the _T's children, not alongside it
    const code = `
      import { jsxs } from 'react/jsx-runtime';
      jsxs("div", { children: ["Hello ", name] });
    `;
    const { gtTranslateCalls, gtVarCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(1);
    expect(gtVarCalls).toHaveLength(1);

    // The T call's children should be an array containing the Var call
    const tCall = gtTranslateCalls[0];
    const tProps = tCall.arguments[1];
    expect(t.isObjectExpression(tProps)).toBe(true);
    const tChildrenProp = (tProps as t.ObjectExpression).properties.find(
      (p) =>
        t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'children' })
    ) as t.ObjectProperty;
    expect(tChildrenProp).toBeDefined();

    // children should be an array with the Var call inside it
    const tChildren = tChildrenProp.value;
    expect(t.isArrayExpression(tChildren)).toBe(true);
    const elements = (tChildren as t.ArrayExpression).elements;
    // First element: "Hello " string
    expect(t.isStringLiteral(elements[0])).toBe(true);
    // Second element: the Var wrapper call
    expect(t.isCallExpression(elements[1])).toBe(true);
    const varCall = elements[1] as t.CallExpression;
    expect(
      t.isIdentifier(varCall.arguments[0], { name: 'GtInternalVar' })
    ).toBe(true);
  });

  it('multiple Var wrappers are all inside the same T wrapper', () => {
    // BEFORE JSX:  <div>Hello {firstName}, welcome to {city}!</div>
    // AFTER JSX:   <div><_T>Hello <_Var>{firstName}</_Var>, welcome to <_Var>{city}</_Var>!</_T></div>
    const code = `
      import { jsxs } from 'react/jsx-runtime';
      jsxs("div", { children: ["Hello ", firstName, ", welcome to ", city, "!"] });
    `;
    const { gtTranslateCalls, gtVarCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(1);
    expect(gtVarCalls).toHaveLength(2);

    // Both Var calls should be inside the T's children array
    const tCall = gtTranslateCalls[0];
    const tProps = tCall.arguments[1] as t.ObjectExpression;
    const tChildrenProp = tProps.properties.find(
      (p) =>
        t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'children' })
    ) as t.ObjectProperty;
    const tChildren = tChildrenProp.value as t.ArrayExpression;

    // Should have 5 elements: "Hello ", Var(firstName), ", welcome to ", Var(city), "!"
    expect(tChildren.elements).toHaveLength(5);
    expect(t.isStringLiteral(tChildren.elements[0])).toBe(true);
    expect(t.isCallExpression(tChildren.elements[1])).toBe(true);
    expect(
      t.isIdentifier((tChildren.elements[1] as t.CallExpression).arguments[0], {
        name: 'GtInternalVar',
      })
    ).toBe(true);
    expect(t.isStringLiteral(tChildren.elements[2])).toBe(true);
    expect(t.isCallExpression(tChildren.elements[3])).toBe(true);
    expect(
      t.isIdentifier((tChildren.elements[3] as t.CallExpression).arguments[0], {
        name: 'GtInternalVar',
      })
    ).toBe(true);
    expect(t.isStringLiteral(tChildren.elements[4])).toBe(true);
  });

  // ===== Aliased callee names (Vite dev mode) =====

  it('handles aliased jsxDEV import', () => {
    // Vite dev mode compiles to: import { jsxDEV as _jsxDEV } from 'react/jsx-dev-runtime'
    // BEFORE JSX:  <div>Hello</div>
    // AFTER JSX:   <div><_T>Hello</_T></div>
    const code = `
      import { jsxDEV as _jsxDEV } from 'react/jsx-dev-runtime';
      _jsxDEV("div", { children: "Hello" });
    `;
    const { gtTranslateCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(1);
  });

  it('handles mixed aliased jsx and jsxs', () => {
    // BEFORE JSX:  <div>Hello <b>World</b></div>
    // AFTER JSX:   <div><_T>Hello <b>World</b></_T></div>
    // jsxs used for div (multiple children), jsx used for b (single child)
    const code = `
      import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
      _jsxs("div", { children: ["Hello ", _jsx("b", { children: "World" })] });
    `;
    const { gtTranslateCalls, gtVarCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(1);
    expect(gtVarCalls).toHaveLength(0); // b is a jsx element, not dynamic
  });

  it('wraps dynamic content in _Var with aliased callee', () => {
    // BEFORE JSX:  <div>Hello {name}</div>
    // AFTER JSX:   <div><_T>Hello <_Var>{name}</_Var></_T></div>
    const code = `
      import { jsxDEV as _jsxDEV } from 'react/jsx-dev-runtime';
      _jsxDEV("div", { children: ["Hello ", name] });
    `;
    const { gtTranslateCalls, gtVarCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(1);
    expect(gtVarCalls).toHaveLength(1);
  });

  it('handles deep nesting with aliased callee', () => {
    // BEFORE JSX:  <div><span>Click me</span></div>
    // AFTER JSX:   <div><span><_T>Click me</_T></span></div>
    const code = `
      import { jsxDEV as _jsxDEV } from 'react/jsx-dev-runtime';
      _jsxDEV("div", { children: _jsxDEV("span", { children: "Click me" }) });
    `;
    const { gtTranslateCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(1);
  });
});
