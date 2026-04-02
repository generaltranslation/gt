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

  it('inserts _T but does NOT touch user RelativeTime', () => {
    // BEFORE JSX:  <div>Updated: <RelativeTime>{date}</RelativeTime></div>
    // AFTER JSX:   <div><_T>Updated: <RelativeTime>{date}</RelativeTime></_T></div>
    const code = `
      import { jsx, jsxs } from 'react/jsx-runtime';
      import { RelativeTime } from 'gt-react';
      jsxs("div", { children: ["Updated: ", jsx(RelativeTime, { children: date })] });
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

  it('each dynamic child gets its own individual _Var (1-to-1 mapping)', () => {
    // BEFORE JSX:  <div>{a + "hello"}sometext{b}{c} and {d + e}</div>
    // AFTER JSX:   <div><_T><_Var>{a+"hello"}</_Var>sometext<_Var>{b}</_Var><_Var>{c}</_Var> and <_Var>{d+e}</_Var></_T></div>
    // 4 dynamic expressions → 4 _Vars, 2 static strings
    const code = `
      import { jsxs } from 'react/jsx-runtime';
      jsxs("div", { children: [a + "hello", "sometext", b, c, " and ", d + e] });
    `;
    const { gtTranslateCalls, gtVarCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(1);
    expect(gtVarCalls).toHaveLength(4);

    // Verify the T's children array has the correct structure:
    // [Var(a+"hello"), "sometext", Var(b), Var(c), " and ", Var(d+e)]
    const tCall = gtTranslateCalls[0];
    const tProps = tCall.arguments[1] as t.ObjectExpression;
    const tChildrenProp = tProps.properties.find(
      (p) =>
        t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'children' })
    ) as t.ObjectProperty;
    const tChildren = tChildrenProp.value as t.ArrayExpression;

    expect(tChildren.elements).toHaveLength(6);
    // Element 0: Var(a + "hello")
    expect(t.isCallExpression(tChildren.elements[0])).toBe(true);
    expect(
      t.isIdentifier((tChildren.elements[0] as t.CallExpression).arguments[0], {
        name: 'GtInternalVar',
      })
    ).toBe(true);
    // Element 1: "sometext"
    expect(t.isStringLiteral(tChildren.elements[1])).toBe(true);
    // Element 2: Var(b)
    expect(t.isCallExpression(tChildren.elements[2])).toBe(true);
    expect(
      t.isIdentifier((tChildren.elements[2] as t.CallExpression).arguments[0], {
        name: 'GtInternalVar',
      })
    ).toBe(true);
    // Element 3: Var(c)
    expect(t.isCallExpression(tChildren.elements[3])).toBe(true);
    expect(
      t.isIdentifier((tChildren.elements[3] as t.CallExpression).arguments[0], {
        name: 'GtInternalVar',
      })
    ).toBe(true);
    // Element 4: " and "
    expect(t.isStringLiteral(tChildren.elements[4])).toBe(true);
    // Element 5: Var(d + e)
    expect(t.isCallExpression(tChildren.elements[5])).toBe(true);
    expect(
      t.isIdentifier((tChildren.elements[5] as t.CallExpression).arguments[0], {
        name: 'GtInternalVar',
      })
    ).toBe(true);
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

  // ===== jsx vs jsxs callee correctness =====

  it('uses jsx callee for _T wrapping a single child', () => {
    // <div>Hello</div> → _T wraps "Hello" (single child)
    const code = `
      import { jsx } from 'react/jsx-runtime';
      jsx("div", { children: "Hello" });
    `;
    const { gtTranslateCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(1);
    expect(t.isIdentifier(gtTranslateCalls[0].callee, { name: 'jsx' })).toBe(
      true
    );
  });

  it('uses jsxs callee for _T wrapping multiple children', () => {
    // <div>Hello {name}</div> → _T wraps ["Hello ", _Var(name)] (array)
    const code = `
      import { jsx, jsxs } from 'react/jsx-runtime';
      jsxs("div", { children: ["Hello ", name] });
    `;
    const { gtTranslateCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(1);
    expect(t.isIdentifier(gtTranslateCalls[0].callee, { name: 'jsxs' })).toBe(
      true
    );
  });

  it('uses jsx callee for _Var (always single child)', () => {
    const code = `
      import { jsx, jsxs } from 'react/jsx-runtime';
      jsxs("div", { children: ["Hello ", name] });
    `;
    const { gtVarCalls } = transform(code);
    expect(gtVarCalls).toHaveLength(1);
    expect(t.isIdentifier(gtVarCalls[0].callee, { name: 'jsx' })).toBe(true);
  });

  it('uses aliased jsxs for _T with array children', () => {
    const code = `
      import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
      _jsxs("div", { children: ["Hello ", name] });
    `;
    const { gtTranslateCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(1);
    expect(t.isIdentifier(gtTranslateCalls[0].callee, { name: '_jsxs' })).toBe(
      true
    );
  });

  it('uses aliased jsx for _Var with aliased imports', () => {
    const code = `
      import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
      _jsxs("div", { children: ["Hello ", name] });
    `;
    const { gtVarCalls } = transform(code);
    expect(gtVarCalls).toHaveLength(1);
    expect(t.isIdentifier(gtVarCalls[0].callee, { name: '_jsx' })).toBe(true);
  });

  it('uses jsxDEV for both _T and _Var in dev mode', () => {
    const code = `
      import { jsxDEV as _jsxDEV } from 'react/jsx-dev-runtime';
      _jsxDEV("div", { children: ["Hello ", name] });
    `;
    const { gtTranslateCalls, gtVarCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(1);
    expect(gtVarCalls).toHaveLength(1);
    expect(
      t.isIdentifier(gtTranslateCalls[0].callee, { name: '_jsxDEV' })
    ).toBe(true);
    expect(t.isIdentifier(gtVarCalls[0].callee, { name: '_jsxDEV' })).toBe(
      true
    );
  });

  it('parent div callee changes from jsxs to jsx after wrapping children in _T', () => {
    // Before: jsxs("div", { children: ["Hello ", name] })
    // After:  jsx("div", { children: jsxs(_T, { children: [...] }) })
    const code = `
      import { jsx, jsxs } from 'react/jsx-runtime';
      jsxs("div", { children: ["Hello ", name] });
    `;
    const { code: output } = transform(code);
    // The outer div should now use jsx (single child: the _T wrapper)
    expect(output).toMatch(/\bjsx\("div"/);
    expect(output).not.toMatch(/\bjsxs\("div"/);
  });

  // ===== jsxDEV isStaticChildren correctness =====

  it('sets parent isStaticChildren to false after wrapping in _T', () => {
    // Parent had array children (isStaticChildren=true), now has single _T child → false
    const code = `
      import { jsxDEV } from 'react/jsx-dev-runtime';
      jsxDEV("div", { children: ["Hello ", name] }, undefined, true);
    `;
    const { code: output } = transform(code);
    expect(output).toMatch(/jsxDEV\("div",\s*\{[\s\S]*?\},\s*void 0,\s*false/);
  });

  it('generated _T wrapper includes isStaticChildren=true for array children', () => {
    // _T wrapping ["Hello ", _Var(name)] → array children → isStaticChildren=true
    const code = `
      import { jsxDEV } from 'react/jsx-dev-runtime';
      jsxDEV("div", { children: ["Hello ", name] }, undefined, true);
    `;
    const { gtTranslateCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(1);
    const tCall = gtTranslateCalls[0];
    expect(tCall.arguments.length).toBeGreaterThanOrEqual(4);
    expect(t.isBooleanLiteral(tCall.arguments[3], { value: true })).toBe(true);
  });

  it('generated _T wrapper includes isStaticChildren=false for single child', () => {
    // _T wrapping "Hello" → single child → isStaticChildren=false
    const code = `
      import { jsxDEV } from 'react/jsx-dev-runtime';
      jsxDEV("div", { children: "Hello" }, undefined, false);
    `;
    const { gtTranslateCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(1);
    const tCall = gtTranslateCalls[0];
    expect(tCall.arguments.length).toBeGreaterThanOrEqual(4);
    expect(t.isBooleanLiteral(tCall.arguments[3], { value: false })).toBe(true);
  });

  it('generated _Var wrapper includes isStaticChildren=false (always single child)', () => {
    const code = `
      import { jsxDEV } from 'react/jsx-dev-runtime';
      jsxDEV("div", { children: ["Hello ", name] }, undefined, true);
    `;
    const { gtVarCalls } = transform(code);
    expect(gtVarCalls).toHaveLength(1);
    const varCall = gtVarCalls[0];
    expect(varCall.arguments.length).toBeGreaterThanOrEqual(4);
    expect(t.isBooleanLiteral(varCall.arguments[3], { value: false })).toBe(
      true
    );
  });

  it('_T wrapper has isStaticChildren=true when it has array children alongside _Var', () => {
    // Parent wraps in _T with ["Hello ", _Var(name)] → _T has array → isStaticChildren=true
    const code = `
      import { jsxDEV } from 'react/jsx-dev-runtime';
      jsxDEV("div", { children: ["Hello ", name] }, undefined, true);
    `;
    const { gtTranslateCalls } = transform(code);
    const tCall = gtTranslateCalls[0];
    expect(t.isBooleanLiteral(tCall.arguments[3], { value: true })).toBe(true);
  });

  // ===== Fragments (Rule 13) =====

  it('inserts _T inside a fragment with text', () => {
    // BEFORE JSX:  <>Hello World</>
    // AFTER JSX:   <><_T>Hello World</_T></>
    const code = `
      import { jsx } from 'react/jsx-runtime';
      jsx(require("react").Fragment, { children: "Hello World" });
    `;
    const { gtTranslateCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(1);
  });

  // ===== Ternary with JSX inside auto Var (Rule 14 / 7a) =====

  it('inserts _T inside JSX branches of a ternary wrapped in auto _Var', () => {
    // BEFORE JSX:  <div>Status: {isActive ? <span>Active</span> : <span>Inactive</span>}</div>
    // AFTER JSX:   <div><_T>Status: <_Var>{isActive ? <span><_T>Active</_T></span> : <span><_T>Inactive</_T></span>}</_Var></_T></div>
    //
    // The ternary is dynamic → _Var. Since _Var is auto-inserted, JSX inside it
    // is still fair game → <span>Active</span> and <span>Inactive</span> each get _T.
    //
    // 3 _T total: outer (div), Active, Inactive
    const code = `
      import { jsx, jsxs } from 'react/jsx-runtime';
      jsxs("div", { children: ["Status: ", isActive ? jsx("span", { children: "Active" }) : jsx("span", { children: "Inactive" })] });
    `;
    const { gtTranslateCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(3);
  });

  // ===== User Var with JSX inside is opaque (Rule 7b) =====

  it('does NOT insert _T inside user-written Var even if it contains JSX with text', () => {
    // BEFORE JSX:  <T>Status: <Var>{isActive ? <span>Active</span> : <span>Inactive</span>}</Var></T>
    // AFTER JSX:   unchanged — user Var is opaque, nothing inside is touched
    //
    // "Active" and "Inactive" do NOT get _T because they are inside a user Var.
    // 0 _T insertions (the user T is not auto-inserted)
    const code = `
      import { jsx, jsxs } from 'react/jsx-runtime';
      import { T, Var } from 'gt-react';
      jsxs(T, { children: ["Status: ", jsx(Var, { children: isActive ? jsx("span", { children: "Active" }) : jsx("span", { children: "Inactive" }) })] });
    `;
    const { gtTranslateCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(0);
  });

  // ===== Control props must NOT be Var-wrapped =====

  it('does NOT Var-wrap Plural n prop (control prop, not translatable)', () => {
    // BEFORE JSX:  <div><Plural n={count} one="item" other="items" /></div>
    // AFTER JSX:   <div><_T><Plural n={count} one="item" other="items" /></_T></div>
    // n is the selector — left as-is, never wrapped in Var
    const code = `
      import { jsx } from 'react/jsx-runtime';
      import { Plural } from 'gt-react';
      jsx("div", { children: jsx(Plural, { n: count, one: "item", other: "items" }) });
    `;
    const { gtTranslateCalls, gtVarCalls, code: output } = transform(code);
    expect(gtTranslateCalls).toHaveLength(1);
    expect(gtVarCalls).toHaveLength(0);
    expect(output).toMatch(/n:\s*count/);
  });

  it('Var-wraps dynamic content inside Branch content prop JSX', () => {
    // BEFORE JSX:  <div><Branch branch="mode" Ernest={<>Hello {userName}</>} /></div>
    // AFTER JSX:   <div><_T><Branch branch="mode" Ernest={<>Hello <_Var>{userName}</_Var></>} /></_T></div>
    // branch is the selector (static string here), Ernest is a content prop with dynamic content
    const code = `
      import { jsx, jsxs } from 'react/jsx-runtime';
      import { Fragment } from 'react';
      import { Branch } from 'gt-react';
      jsx("div", { children: jsx(Branch, {
        branch: "mode",
        Ernest: jsxs(Fragment, { children: ["Hello ", userName] })
      }) });
    `;
    const { gtTranslateCalls, gtVarCalls, code: output } = transform(code);
    expect(gtTranslateCalls).toHaveLength(1);
    expect(gtVarCalls).toHaveLength(1);
    expect(output).toMatch(/branch:\s*"mode"/);
  });

  // ===== Opaque component children (fallback) processing =====

  it('Var-wraps dynamic content inside Branch children (fallback) without losing text', () => {
    // BEFORE JSX:  <><text><Branch branch={userName}>Fallback with Var {userName}</Branch></>
    // AFTER JSX:   <><_T><text><Branch branch={userName}>Fallback with Var <_Var>{userName}</_Var></Branch></_T></>
    // Branch children is ["Fallback with Var ", userName] — must be processed
    // element-by-element, NOT wrapped as a single Var.
    const code = `
      import { jsx, jsxs } from 'react/jsx-runtime';
      import { Fragment } from 'react';
      import { Branch } from 'gt-react';
      jsxs(Fragment, { children: [
        "Hello, my good friend",
        jsxs(Branch, {
          branch: userName,
          children: ["Fallback with Var ", userName]
        })
      ] });
    `;
    const { gtTranslateCalls, gtVarCalls, code: output } = transform(code);
    expect(gtTranslateCalls).toHaveLength(1);
    expect(gtVarCalls).toHaveLength(1);
    expect(output).toContain('Fallback with Var');
    expect(output).toMatch(/branch:\s*userName/);
    // Var wraps userName (Identifier), NOT the entire children array
    const varProps = gtVarCalls[0].arguments[1] as t.ObjectExpression;
    const varChildrenProp = varProps.properties.find(
      (p) =>
        t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'children' })
    ) as t.ObjectProperty;
    expect(t.isIdentifier(varChildrenProp.value)).toBe(true);
  });

  it('Var-wraps dynamic content inside Plural children (fallback) without losing text', () => {
    // BEFORE JSX:  <div><Plural n={count}>You have {count} items</Plural></div>
    // AFTER JSX:   <div><_T><Plural n={count}>You have <_Var>{count}</_Var> items</Plural></_T></div>
    const code = `
      import { jsx, jsxs } from 'react/jsx-runtime';
      import { Plural } from 'gt-react';
      jsx("div", { children: jsxs(Plural, {
        n: count,
        children: ["You have ", count, " items"]
      }) });
    `;
    const { gtTranslateCalls, gtVarCalls, code: output } = transform(code);
    expect(gtTranslateCalls).toHaveLength(1);
    expect(gtVarCalls).toHaveLength(1);
    expect(output).toContain('You have');
    expect(output).toContain('items');
    expect(output).toMatch(/n:\s*count/);
    // Var wraps count (Identifier), NOT the entire children array
    const varProps = gtVarCalls[0].arguments[1] as t.ObjectExpression;
    const varChildrenProp = varProps.properties.find(
      (p) =>
        t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'children' })
    ) as t.ObjectProperty;
    expect(t.isIdentifier(varChildrenProp.value)).toBe(true);
  });

  it('does NOT Var-wrap Derive children (opaque content)', () => {
    // BEFORE JSX:  <div>Hello <Derive>{getName()}</Derive></div>
    // AFTER JSX:   <div><_T>Hello <Derive>{getName()}</Derive></_T></div>
    // Derive children are opaque — no Var wrapping
    const code = `
      import { jsx, jsxs } from 'react/jsx-runtime';
      import { Derive } from 'gt-react';
      jsxs("div", { children: ["Hello ", jsx(Derive, { children: getName() })] });
    `;
    const { gtTranslateCalls, gtVarCalls } = transform(code);
    expect(gtTranslateCalls).toHaveLength(1);
    expect(gtVarCalls).toHaveLength(0);
  });

  // ===== Branch prop value with dynamic content gets _Var =====

  it('inserts _Var inside Branch prop value that has dynamic content alongside text', () => {
    // BEFORE JSX:
    //   <>
    //     Hello, my good friend
    //     <Branch branch={userName} Ernest={<>Branch with Var {userName}</>} />
    //   </>
    //
    // AFTER JSX:
    //   <>
    //     <_T>
    //       Hello, my good friend
    //       <Branch branch={userName} Ernest={<>Branch with Var <_Var>{userName}</_Var></>} />
    //     </_T>
    //   </>
    //
    // Fragment has text "Hello, my good friend" → _T wraps at fragment level.
    // Branch is opaque → T wraps from parent (the fragment).
    // The `branch` prop is the selector — left as-is (not wrapped in Var).
    // The `Ernest` prop VALUE has text + dynamic content → {userName} gets _Var.
    //
    // This should NOT error during compilation.
    const code = `
      import { jsx, jsxs } from 'react/jsx-runtime';
      import { Fragment } from 'react';
      import { Branch } from 'gt-react';
      jsxs(Fragment, { children: [
        "Hello, my good friend",
        jsx(Branch, {
          branch: userName,
          Ernest: jsxs(Fragment, { children: ["Branch with Var ", userName] })
        })
      ] });
    `;
    const { gtTranslateCalls, gtVarCalls, code: output } = transform(code);
    // _T wraps the fragment content (text + Branch)
    expect(gtTranslateCalls.length).toBeGreaterThanOrEqual(1);
    // _Var wraps {userName} INSIDE the Ernest prop value, not the branch selector
    expect(gtVarCalls.length).toBeGreaterThanOrEqual(1);
    // The branch selector prop should NOT be Var-wrapped
    // The output should still have `branch: userName` directly, not `branch: jsx(GtInternalVar, ...)`
    expect(output).toMatch(/branch:\s*userName/);
  });
});
