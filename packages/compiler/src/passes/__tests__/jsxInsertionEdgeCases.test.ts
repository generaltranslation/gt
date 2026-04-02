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

// --- Edge Case Tests ---

describe('jsxInsertionPass edge cases', () => {
  // ===== 1. Deep nesting stress =====

  describe('deep nesting', () => {
    it('5-level nesting — _T at leaf only', () => {
      // BEFORE JSX:  <main><section><article><p><span>Deep text</span></p></article></section></main>
      // AFTER JSX:   <main><section><article><p><span><_T>Deep text</_T></span></p></article></section></main>
      const code = `
        import { jsx } from 'react/jsx-runtime';
        jsx("main", { children:
          jsx("section", { children:
            jsx("article", { children:
              jsx("p", { children:
                jsx("span", { children: "Deep text" })
              })
            })
          })
        });
      `;
      const { gtTranslateCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
    });

    it('5-level nesting — text at root claims subtree, _Var deep inside', () => {
      // BEFORE JSX:  <main>Root text <section><article><p><span>{name}</span></p></article></section></main>
      // AFTER JSX:   <main><_T>Root text <section><article><p><span><_Var>{name}</_Var></span></p></article></section></_T></main>
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        jsxs("main", { children: ["Root text ",
          jsx("section", { children:
            jsx("article", { children:
              jsx("p", { children:
                jsx("span", { children: name })
              })
            })
          })
        ] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(1);
    });

    it('nested fragments inside fragments', () => {
      // BEFORE JSX:  <><>Hello World</></>
      // AFTER JSX:   <><><_T>Hello World</_T></></>
      const code = `
        import { jsx } from 'react/jsx-runtime';
        jsx(require("react").Fragment, { children:
          jsx(require("react").Fragment, { children: "Hello World" })
        });
      `;
      const { gtTranslateCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
    });
  });

  // ===== 2. Multiple opaque components in one tree =====

  describe('multiple opaque components', () => {
    it('Branch + Plural siblings inside parent with text', () => {
      // BEFORE JSX:  <div>Label: <Branch branch="x">fb</Branch><Plural n={c} one="1" other="n" /></div>
      // AFTER JSX:   <div><_T>Label: <Branch ...></_T></div>
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        import { Branch, Plural } from 'gt-react';
        jsxs("div", { children: [
          "Label: ",
          jsx(Branch, { branch: "x", children: "fb" }),
          jsx(Plural, { n: c, one: "1", other: "n" })
        ] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(0);
    });

    it('Branch inside Plural children (fallback) — both opaque', () => {
      // BEFORE JSX:  <div><Plural n={c}><Branch branch="x">fb</Branch></Plural></div>
      // AFTER JSX:   <div><_T><Plural n={c}><Branch branch="x">fb</Branch></Plural></_T></div>
      const code = `
        import { jsx } from 'react/jsx-runtime';
        import { Branch, Plural } from 'gt-react';
        jsx("div", { children: jsx(Plural, { n: c, children: jsx(Branch, { branch: "x", children: "fb" }) }) });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(0);
    });

    it('Derive wrapping Branch — Derive opaque, Branch inside untouched', () => {
      // BEFORE JSX:  <div>Hello <Derive><Branch branch="x">fb</Branch></Derive></div>
      // AFTER JSX:   <div><_T>Hello <Derive><Branch branch="x">fb</Branch></Derive></_T></div>
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        import { Derive, Branch } from 'gt-react';
        jsxs("div", { children: ["Hello ", jsx(Derive, { children: jsx(Branch, { branch: "x", children: "fb" }) })] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(0);
    });
  });

  // ===== 3. Conditional rendering combos =====

  describe('conditional rendering', () => {
    it('nested ternary — _Var around outer, inner JSX each gets _T', () => {
      // BEFORE JSX:  <div>Result: {a ? (b ? <span>A+B</span> : <span>A-B</span>) : <span>C</span>}</div>
      // AFTER JSX:   <div><_T>Result: <_Var>{a ? (b ? <span><_T>A+B</_T></span> : <span><_T>A-B</_T></span>) : <span><_T>C</_T></span>}</_Var></_T></div>
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        jsxs("div", { children: [
          "Result: ",
          a ? (b ? jsx("span", { children: "A+B" }) : jsx("span", { children: "A-B" })) : jsx("span", { children: "C" })
        ] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      // 4 _T: outer div, "A+B", "A-B", "C"
      expect(gtTranslateCalls).toHaveLength(4);
      expect(gtVarCalls).toHaveLength(1);
    });

    it('logical AND chain', () => {
      // BEFORE JSX:  <div>Hello {show && visible && <span>Content</span>}</div>
      // AFTER JSX:   <div><_T>Hello <_Var>{show && visible && <span><_T>Content</_T></span>}</_Var></_T></div>
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        jsxs("div", { children: ["Hello ", show && visible && jsx("span", { children: "Content" })] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      // 2 _T: div and "Content" inside span
      expect(gtTranslateCalls).toHaveLength(2);
      expect(gtVarCalls).toHaveLength(1);
    });

    it('logical OR fallback with JSX', () => {
      // BEFORE JSX:  <div>Hello {content || <span>Fallback</span>}</div>
      // AFTER JSX:   <div><_T>Hello <_Var>{content || <span><_T>Fallback</_T></span>}</_Var></_T></div>
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        jsxs("div", { children: ["Hello ", content || jsx("span", { children: "Fallback" })] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(2);
      expect(gtVarCalls).toHaveLength(1);
    });

    it('ternary with no surrounding text — no _T at parent', () => {
      // BEFORE JSX:  <div>{flag ? <p>Yes</p> : <p>No</p>}</div>
      // AFTER JSX:   <div>{flag ? <p><_T>Yes</_T></p> : <p><_T>No</_T></p>}</div>
      const code = `
        import { jsx } from 'react/jsx-runtime';
        jsx("div", { children: flag ? jsx("p", { children: "Yes" }) : jsx("p", { children: "No" }) });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      // 2 _T: "Yes" and "No", no _T at div (no text)
      expect(gtTranslateCalls).toHaveLength(2);
      expect(gtVarCalls).toHaveLength(0);
    });
  });

  // ===== 4. Iterator patterns =====

  describe('iterator patterns', () => {
    it('.map() as only child — no text = no _T at parent', () => {
      // BEFORE JSX:  <ul>{items.map(i => <li>{i.name}</li>)}</ul>
      // AFTER JSX:   <ul>{items.map(i => <li>{i.name}</li>)}</ul>  — unchanged at ul level
      const code = `
        import { jsx } from 'react/jsx-runtime';
        jsx("ul", { children: items.map(i => jsx("li", { children: i.name })) });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      // No text at ul → no _T, no _Var
      expect(gtTranslateCalls).toHaveLength(0);
      expect(gtVarCalls).toHaveLength(0);
    });

    it('.map() alongside text — _Var wraps the map call', () => {
      // BEFORE JSX:  <ul>Items: {items.map(i => <li>{i.name}</li>)}</ul>
      // AFTER JSX:   <ul><_T>Items: <_Var>{items.map(...)}</_Var></_T></ul>
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        jsxs("ul", { children: ["Items: ", items.map(i => jsx("li", { children: i.name }))] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(1);
    });
  });

  // ===== 5. Edge case expressions =====

  describe('edge case expressions', () => {
    it('negative number — NOT wrapped in _Var', () => {
      // BEFORE JSX:  <div>Temperature: {-5}</div>
      // AFTER JSX:   <div><_T>Temperature: {-5}</_T></div>
      const code = `
        import { jsxs } from 'react/jsx-runtime';
        jsxs("div", { children: ["Temperature: ", -5] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(0);
    });

    it('boolean literals — NOT triggering _T alone', () => {
      // BEFORE JSX:  <div>{true} {false}</div>
      // AFTER JSX:   <div>{true} {false}</div>  — unchanged (no text)
      const code = `
        import { jsxs } from 'react/jsx-runtime';
        jsxs("div", { children: [true, " ", false] });
      `;
      const { gtTranslateCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(0);
    });

    it('null literal — valid child inside _T, not wrapped', () => {
      // BEFORE JSX:  <div>Text {null}</div>
      // AFTER JSX:   <div><_T>Text {null}</_T></div>
      const code = `
        import { jsxs } from 'react/jsx-runtime';
        jsxs("div", { children: ["Text ", null] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(0);
    });

    it('undefined, NaN, Infinity — special identifiers NOT wrapped', () => {
      // BEFORE JSX:  <div>Special: {undefined} {NaN} {Infinity}</div>
      // AFTER JSX:   <div><_T>Special: {undefined} {NaN} {Infinity}</_T></div>
      const code = `
        import { jsxs } from 'react/jsx-runtime';
        jsxs("div", { children: ["Special: ", undefined, " ", NaN, " ", Infinity] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(0);
    });

    it('empty string — does NOT trigger _T', () => {
      // BEFORE JSX:  <div>{""}</div>
      // AFTER JSX:   <div>{""}</div>  — unchanged
      const code = `
        import { jsx } from 'react/jsx-runtime';
        jsx("div", { children: "" });
      `;
      const { gtTranslateCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(0);
    });
  });

  // ===== 6. Multiple non-children props stress =====

  describe('multiple non-children props', () => {
    it('4 props with text + children = 5 independent _T', () => {
      // BEFORE JSX:  <Layout header={<h1>H</h1>} footer={<p>F</p>} sidebar={<nav>S</nav>} extra={<div>E</div>}>Main</Layout>
      // AFTER JSX:   each prop JSX gets its own _T + children gets _T
      const code = `
        import { jsx } from 'react/jsx-runtime';
        jsx(Layout, {
          header: jsx("h1", { children: "H" }),
          footer: jsx("p", { children: "F" }),
          sidebar: jsx("nav", { children: "S" }),
          extra: jsx("div", { children: "E" }),
          children: "Main"
        });
      `;
      const { gtTranslateCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(5);
    });

    it('non-children prop with text + dynamic = independent _T + _Var', () => {
      // BEFORE JSX:  <Card header={<h1>Title {count}</h1>}>Body</Card>
      // AFTER JSX:   <Card header={<h1><_T>Title <_Var>{count}</_Var></_T></h1>}><_T>Body</_T></Card>
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        jsx(Card, {
          header: jsxs("h1", { children: ["Title ", count] }),
          children: "Body"
        });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(2);
      expect(gtVarCalls).toHaveLength(1);
    });
  });

  // ===== 7. Self-closing and empty elements =====

  describe('self-closing and empty', () => {
    it('self-closing element — unchanged', () => {
      const code = `
        import { jsx } from 'react/jsx-runtime';
        jsx("img", {});
      `;
      const { gtTranslateCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(0);
    });

    it('element with empty props — unchanged', () => {
      const code = `
        import { jsx } from 'react/jsx-runtime';
        jsx("div", {});
      `;
      const { gtTranslateCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(0);
    });
  });

  // ===== 8. Whitespace edge cases =====

  describe('whitespace', () => {
    it('only whitespace children — no _T', () => {
      const code = `
        import { jsx } from 'react/jsx-runtime';
        jsx("div", { children: "   " });
      `;
      const { gtTranslateCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(0);
    });

    it('whitespace between elements — each child gets independent _T', () => {
      // BEFORE JSX:  <div> <span>A</span> <span>B</span> </div>
      // AFTER JSX:   <div> <span><_T>A</_T></span> <span><_T>B</_T></span> </div>
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        jsxs("div", { children: [" ", jsx("span", { children: "A" }), " ", jsx("span", { children: "B" }), " "] });
      `;
      const { gtTranslateCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(2);
    });
  });

  // ===== 9. Mixed GT components with user content =====

  describe('mixed GT components', () => {
    it('user T next to auto-insertable content', () => {
      // BEFORE JSX:  <div><T>Manual</T><span>Auto</span></div>
      // AFTER JSX:   <div><T>Manual</T><span><_T>Auto</_T></span></div>
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        import { T } from 'gt-react';
        jsxs("div", { children: [jsx(T, { children: "Manual" }), jsx("span", { children: "Auto" })] });
      `;
      const { gtTranslateCalls } = transform(code);
      // 1 auto _T for "Auto" in span. User T untouched.
      expect(gtTranslateCalls).toHaveLength(1);
    });

    it('user Var alongside auto _Var', () => {
      // BEFORE JSX:  <div>Hello <Var>{x}</Var> and {y}</div>
      // AFTER JSX:   <div><_T>Hello <Var>{x}</Var> and <_Var>{y}</_Var></_T></div>
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        import { Var } from 'gt-react';
        jsxs("div", { children: ["Hello ", jsx(Var, { children: x }), " and ", y] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(1); // only {y} gets auto _Var
    });

    it('user Currency + user DateTime in same tree', () => {
      // BEFORE JSX:  <div>Paid <Currency>{amount}</Currency> on <DateTime>{date}</DateTime></div>
      // AFTER JSX:   <div><_T>Paid <Currency>...</Currency> on <DateTime>...</DateTime></_T></div>
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        import { Currency, DateTime } from 'gt-react';
        jsxs("div", { children: ["Paid ", jsx(Currency, { children: amount }), " on ", jsx(DateTime, { children: date })] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(0); // user components untouched
    });
  });

  // ===== 10. Idempotency — already-inserted components =====

  describe('idempotency', () => {
    it('GtInternalTranslateJsx already in tree — skip', () => {
      const code = `
        import { jsx } from 'react/jsx-runtime';
        import { GtInternalTranslateJsx } from 'gt-react/browser';
        jsx("div", { children: jsx(GtInternalTranslateJsx, { children: "Hello" }) });
      `;
      const { gtTranslateCalls } = transform(code);
      // The existing GtInternalTranslateJsx is counted but no NEW ones added
      expect(gtTranslateCalls).toHaveLength(1);
    });

    it('GtInternalVar already in tree — skip', () => {
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        import { GtInternalTranslateJsx, GtInternalVar } from 'gt-react/browser';
        jsxs("div", { children: ["Hello ", jsx(GtInternalVar, { children: name })] });
      `;
      const { gtTranslateCalls } = transform(code);
      // _T wraps the div children (text + existing _Var)
      expect(gtTranslateCalls).toHaveLength(1);
    });
  });

  // ===== 11. Non-React jsx calls (graceful handling) =====

  describe('non-React calls', () => {
    it('jsx from non-React source — ignored', () => {
      const code = `
        import { jsx } from 'some-other-lib';
        jsx("div", { children: "Hello" });
      `;
      const { gtTranslateCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(0);
    });

    it('non-jsx function call — ignored', () => {
      const code = `
        someFunction("div", { children: "Hello" });
      `;
      const { gtTranslateCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(0);
    });
  });

  // ===== 12. Already imported GtInternalTranslateJsx =====

  describe('existing GT import', () => {
    it('does not inject duplicate import when already imported', () => {
      const code = `
        import { GtInternalTranslateJsx, GtInternalVar } from 'gt-react/browser';
        import { jsx } from 'react/jsx-runtime';
        jsx("div", { children: "Hello" });
      `;
      const { imports } = transform(code);
      const gtImports = imports.filter(
        (i) => i.source.value === 'gt-react/browser'
      );
      expect(gtImports).toHaveLength(1); // no duplicate
    });
  });

  // ===== 13. Branch/Plural with only static content =====

  describe('static-only opaque props', () => {
    it('Branch with all static props — no _Var', () => {
      // BEFORE JSX:  <div><Branch branch="x" a="A" b="B">Fallback</Branch></div>
      // AFTER JSX:   <div><_T><Branch branch="x" a="A" b="B">Fallback</Branch></_T></div>
      const code = `
        import { jsx } from 'react/jsx-runtime';
        import { Branch } from 'gt-react';
        jsx("div", { children: jsx(Branch, { branch: "x", a: "A", b: "B", children: "Fallback" }) });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(0);
    });

    it('Plural with all static forms — no _Var', () => {
      // BEFORE JSX:  <div><Plural n={count} one="item" other="items" /></div>
      // AFTER JSX:   <div><_T><Plural n={count} one="item" other="items" /></_T></div>
      const code = `
        import { jsx } from 'react/jsx-runtime';
        import { Plural } from 'gt-react';
        jsx("div", { children: jsx(Plural, { n: count, one: "item", other: "items" }) });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(0);
    });
  });

  // ===== 14. data-* attributes on Branch =====

  describe('data-* attributes', () => {
    it('data-testid on Branch — skipped as control prop', () => {
      // BEFORE JSX:  <div><Branch branch="x" data-testid="test" hello={val}>fb</Branch></div>
      // AFTER JSX:   <div><_T><Branch branch="x" data-testid="test" hello={<_Var>{val}</_Var>}>fb</Branch></_T></div>
      const code = `
        import { jsx } from 'react/jsx-runtime';
        import { Branch } from 'gt-react';
        jsx("div", { children: jsx(Branch, { branch: "x", "data-testid": "test", hello: val, children: "fb" }) });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(1); // only hello={val} gets _Var
    });
  });

  // ===== 15. Derive edge cases =====

  describe('Derive edge cases', () => {
    it('Static (deprecated alias) treated exactly like Derive', () => {
      // BEFORE JSX:  <div>Hello <Static>{getLabel()}</Static></div>
      // AFTER JSX:   <div><_T>Hello <Static>{getLabel()}</Static></_T></div>
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        import { Static } from 'gt-react';
        jsxs("div", { children: ["Hello ", jsx(Static, { children: getLabel() })] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(0);
    });

    it('multiple Derive siblings — single _T, both opaque', () => {
      // BEFORE JSX:  <div>The <Derive>{getSubject()}</Derive> plays with the <Derive>{getObject()}</Derive></div>
      // AFTER JSX:   <div><_T>The <Derive>...</Derive> plays with the <Derive>...</Derive></_T></div>
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        import { Derive } from 'gt-react';
        jsxs("div", { children: [
          "The ", jsx(Derive, { children: getSubject() }),
          " plays with the ", jsx(Derive, { children: getObject() })
        ] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(0);
    });

    it('Derive wrapping fragment with text + dynamic — Derive children opaque to insertion pass, but Babel visitor still visits the Fragment independently', () => {
      // BEFORE JSX:  <div>Label: <Derive><>Hello {name}</></Derive></div>
      // AFTER JSX:   <div><_T>Label: <Derive><><_T>Hello <_Var>{name}</_Var></_T></></Derive></_T></div>
      //
      // The insertion pass marks Derive children as opaque (skips processOpaqueComponentProps children for Derive).
      // BUT the Fragment inside Derive is a separate jsx() call that the Babel visitor encounters independently.
      // Since the Fragment has text "Hello" + dynamic {name}, it gets _T + _Var.
      // This is correct — the compiler can't know this is under Derive. removeInjectedT strips it at runtime.
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        import { Derive } from 'gt-react';
        import { Fragment } from 'react';
        jsxs("div", { children: [
          "Label: ",
          jsx(Derive, { children: jsxs(Fragment, { children: ["Hello ", name] }) })
        ] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      // 2 _T: one at div, one inside the Fragment (Babel visitor visits it independently)
      expect(gtTranslateCalls).toHaveLength(2);
      // 1 _Var: {name} inside the Fragment's _T region
      expect(gtVarCalls).toHaveLength(1);
    });

    it('nested Derive — outer opaque stops all descendant processing', () => {
      // BEFORE JSX:  <div>Hello <Derive><Derive>{getInner()}</Derive></Derive></div>
      // AFTER JSX:   <div><_T>Hello <Derive><Derive>{getInner()}</Derive></Derive></_T></div>
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        import { Derive } from 'gt-react';
        jsxs("div", { children: [
          "Hello ",
          jsx(Derive, { children: jsx(Derive, { children: getInner() }) })
        ] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(0);
    });

    it('Derive alongside user Var — both opaque, no auto _Var', () => {
      // BEFORE JSX:  <div>Price: <Var>{price}</Var> for <Derive>{getItem()}</Derive></div>
      // AFTER JSX:   <div><_T>Price: <Var>{price}</Var> for <Derive>{getItem()}</Derive></_T></div>
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        import { Var, Derive } from 'gt-react';
        jsxs("div", { children: [
          "Price: ", jsx(Var, { children: price }),
          " for ", jsx(Derive, { children: getItem() })
        ] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(0);
    });

    it('Derive alongside dynamic expression — Derive opaque, dynamic gets _Var', () => {
      // BEFORE JSX:  <div>Hello <Derive>{getX()}</Derive> and {z}</div>
      // AFTER JSX:   <div><_T>Hello <Derive>{getX()}</Derive> and <_Var>{z}</_Var></_T></div>
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        import { Derive } from 'gt-react';
        jsxs("div", { children: [
          "Hello ", jsx(Derive, { children: getX() }),
          " and ", z
        ] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(1);
    });
  });

  // ===== 16. Cross-component interactions =====

  describe('cross-component interactions', () => {
    it('Plural inside Derive — Derive opaque, Plural not processed', () => {
      // BEFORE JSX:  <div>Hello <Derive><Plural n={count} one="item" other="items" /></Derive></div>
      // AFTER JSX:   <div><_T>Hello <Derive><Plural n={count} one="item" other="items" /></Derive></_T></div>
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        import { Derive, Plural } from 'gt-react';
        jsxs("div", { children: [
          "Hello ",
          jsx(Derive, { children: jsx(Plural, { n: count, one: "item", other: "items" }) })
        ] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(0);
    });

    it('Fragment wrapping only Derive — _T at fragment (opaque GT child triggers it)', () => {
      // BEFORE JSX:  <><Derive>{getContent()}</Derive></>
      // AFTER JSX:   <><_T><Derive>{getContent()}</Derive></_T></>
      const code = `
        import { jsx } from 'react/jsx-runtime';
        import { Derive } from 'gt-react';
        import { Fragment } from 'react';
        jsx(Fragment, { children: jsx(Derive, { children: getContent() }) });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(0);
    });

    it('Branch + Derive + dynamic expression siblings', () => {
      // BEFORE JSX:  <div>Hello <Derive>{getX()}</Derive>, <Branch branch="y">fb</Branch> and {z}</div>
      // AFTER JSX:   <div><_T>Hello <Derive>...</Derive>, <Branch ...>fb</Branch> and <_Var>{z}</_Var></_T></div>
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        import { Derive, Branch } from 'gt-react';
        jsxs("div", { children: [
          "Hello ", jsx(Derive, { children: getX() }),
          ", ", jsx(Branch, { branch: "y", children: "fb" }),
          " and ", z
        ] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(1);
    });
  });

  // ===== 17. User Var opaqueness stress tests =====

  describe('user Var opaqueness stress', () => {
    it('user Var with ternary containing JSX — NO _T inside either branch', () => {
      // BEFORE JSX:  <div>Hello <Var>{flag ? <p>A</p> : <p>B</p>}</Var></div>
      // AFTER JSX:   <div><_T>Hello <Var>{flag ? <p>A</p> : <p>B</p>}</Var></_T></div>
      // 1 _T at div. 0 auto _Var. "A" and "B" do NOT get _T. User Var is fully opaque.
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        import { Var } from 'gt-react';
        jsxs("div", { children: [
          "Hello ",
          jsx(Var, { children: flag ? jsx("p", { children: "A" }) : jsx("p", { children: "B" }) })
        ] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(0);
    });

    it('user Var with .map() returning JSX — no insertion inside', () => {
      // BEFORE JSX:  <div>Items: <Var>{items.map(i => <li>{i.name}</li>)}</Var></div>
      // AFTER JSX:   <div><_T>Items: <Var>{items.map(...)}</Var></_T></div>
      // 1 _T at div. 0 auto _Var. <li> elements NOT processed.
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        import { Var } from 'gt-react';
        jsxs("div", { children: [
          "Items: ",
          jsx(Var, { children: items.map(i => jsx("li", { children: i.name })) })
        ] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(0);
    });

    it('user Var with logical AND containing JSX — no insertion inside', () => {
      // BEFORE JSX:  <div>Content: <Var>{show && <span>Visible {x}</span>}</Var></div>
      // AFTER JSX:   <div><_T>Content: <Var>{show && <span>Visible {x}</span>}</Var></_T></div>
      // 1 _T at div. 0 auto _Var. <span> NOT processed, {x} NOT Var-wrapped.
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        import { Var } from 'gt-react';
        jsxs("div", { children: [
          "Content: ",
          jsx(Var, { children: show && jsxs("span", { children: ["Visible ", x] }) })
        ] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(0);
    });

    it('user Var with OR fallback containing JSX — no insertion inside', () => {
      // BEFORE JSX:  <div>Value: <Var>{value || <span>Default</span>}</Var></div>
      // AFTER JSX:   <div><_T>Value: <Var>{value || <span>Default</span>}</Var></_T></div>
      // 1 _T at div. 0 auto _Var.
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        import { Var } from 'gt-react';
        jsxs("div", { children: [
          "Value: ",
          jsx(Var, { children: value || jsx("span", { children: "Default" }) })
        ] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(0);
    });

    it('user Var with nested component containing prop JSX — no insertion inside', () => {
      // BEFORE JSX:  <div>Card: <Var>{<Card header={<h1>Title</h1>}>Body</Card>}</Var></div>
      // AFTER JSX:   <div><_T>Card: <Var>{<Card ...>Body</Card>}</Var></_T></div>
      // 1 _T at div. 0 auto _Var. "Title" in header prop NOT _T-wrapped. "Body" NOT _T-wrapped.
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        import { Var } from 'gt-react';
        jsxs("div", { children: [
          "Card: ",
          jsx(Var, { children: jsx(Card, { header: jsx("h1", { children: "Title" }), children: "Body" }) })
        ] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(0);
    });

    it('user Num with JSX inside — same opaqueness as Var', () => {
      // BEFORE JSX:  <div>Price: <Num>{flag ? <span>Discounted</span> : price}</Num></div>
      // AFTER JSX:   <div><_T>Price: <Num>{flag ? <span>Discounted</span> : price}</Num></_T></div>
      // 1 _T at div. 0 auto _Var. <span> NOT processed.
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        import { Num } from 'gt-react';
        jsxs("div", { children: [
          "Price: ",
          jsx(Num, { children: flag ? jsx("span", { children: "Discounted" }) : price })
        ] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(0);
    });

    it('user Var depth counter resets between siblings — auto insertion resumes after Var', () => {
      // BEFORE JSX:  <div><Var>{<p>Opaque</p>}</Var><span>Auto {x}</span></div>
      // AFTER JSX:   <div><Var>{<p>Opaque</p>}</Var><span><_T>Auto <_Var>{x}</_Var></_T></span></div>
      // Var is opaque, but sibling span is NOT inside Var — auto insertion resumes.
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        import { Var } from 'gt-react';
        jsxs("div", { children: [
          jsx(Var, { children: jsx("p", { children: "Opaque" }) }),
          jsxs("span", { children: ["Auto ", x] })
        ] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      // 0 _T inside Var. 1 _T in span. 1 _Var for {x}.
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(1);
    });

    it('user Var in non-children prop — Var scope prevents insertion in that prop', () => {
      // BEFORE JSX:  <Layout sidebar={<Var>{<nav>Links</nav>}</Var>}>Body text</Layout>
      // AFTER JSX:   <Layout sidebar={<Var>{<nav>Links</nav>}</Var>}><_T>Body text</_T></Layout>
      // sidebar: Var opaque, "Links" NOT _T-wrapped. children: "Body text" gets _T.
      const code = `
        import { jsx } from 'react/jsx-runtime';
        import { Var } from 'gt-react';
        jsx(Layout, {
          sidebar: jsx(Var, { children: jsx("nav", { children: "Links" }) }),
          children: "Body text"
        });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      // 1 _T for "Body text". 0 for "Links" (inside Var).
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(0);
    });
  });

  // ===== 18. Real-world-ish component patterns =====

  describe('real-world patterns', () => {
    it('nav bar with multiple links — each link gets independent _T', () => {
      // BEFORE JSX:  <nav><a>Home</a><a>About</a><a>Contact</a></nav>
      // AFTER JSX:   <nav><a><_T>Home</_T></a><a><_T>About</_T></a><a><_T>Contact</_T></a></nav>
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        jsxs("nav", { children: [
          jsx("a", { children: "Home" }),
          jsx("a", { children: "About" }),
          jsx("a", { children: "Contact" })
        ] });
      `;
      const { gtTranslateCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(3);
    });

    it('table row with mixed static/dynamic cells', () => {
      // BEFORE JSX:  <tr><td>Name</td><td>{user.name}</td><td>Age: {user.age}</td></tr>
      // AFTER JSX:   <tr><td><_T>Name</_T></td><td>{user.name}</td><td><_T>Age: <_Var>{user.age}</_Var></_T></td></tr>
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        jsxs("tr", { children: [
          jsx("td", { children: "Name" }),
          jsx("td", { children: user.name }),
          jsxs("td", { children: ["Age: ", user.age] })
        ] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      // "Name" and "Age: {user.age}" get _T. Middle td has no text.
      expect(gtTranslateCalls).toHaveLength(2);
      expect(gtVarCalls).toHaveLength(1);
    });

    it('form with labels and inputs — labels get _T, inputs unchanged', () => {
      // BEFORE JSX:  <form><label>Email</label><input /><label>Password</label><input /></form>
      // AFTER JSX:   <form><label><_T>Email</_T></label><input /><label><_T>Password</_T></label><input /></form>
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        jsxs("form", { children: [
          jsx("label", { children: "Email" }),
          jsx("input", {}),
          jsx("label", { children: "Password" }),
          jsx("input", {})
        ] });
      `;
      const { gtTranslateCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(2);
    });

    it('card component with header prop + body + footer prop', () => {
      // BEFORE JSX:  <Card header={<h2>Welcome {name}</h2>} footer={<small>Updated {date}</small>}>Main content here</Card>
      // AFTER JSX:   each gets independent _T, dynamic expressions get _Var
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        jsx(Card, {
          header: jsxs("h2", { children: ["Welcome ", name] }),
          footer: jsxs("small", { children: ["Updated ", date] }),
          children: "Main content here"
        });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      // 3 _T: header, footer, children — all independent
      expect(gtTranslateCalls).toHaveLength(3);
      // 2 _Var: {name} in header, {date} in footer
      expect(gtVarCalls).toHaveLength(2);
    });

    it('error boundary pattern — text in fallback prop', () => {
      // BEFORE JSX:  <ErrorBoundary fallback={<p>Something went wrong</p>}><App /></ErrorBoundary>
      // AFTER JSX:   <ErrorBoundary fallback={<p><_T>Something went wrong</_T></p>}><App /></ErrorBoundary>
      const code = `
        import { jsx } from 'react/jsx-runtime';
        jsx(ErrorBoundary, {
          fallback: jsx("p", { children: "Something went wrong" }),
          children: jsx(App, {})
        });
      `;
      const { gtTranslateCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
    });
  });

  // ===== 18. Expression-heavy children =====

  describe('expression-heavy children', () => {
    it('6 dynamic expressions + text = 6 _Vars in one _T', () => {
      // BEFORE JSX:  <p>{a} {b} {c} says {d} to {e} about {f}</p>
      // AFTER JSX:   <p><_T><_Var>{a}</_Var> ... says <_Var>{d}</_Var> to <_Var>{e}</_Var> about <_Var>{f}</_Var></_T></p>
      const code = `
        import { jsxs } from 'react/jsx-runtime';
        jsxs("p", { children: [a, " ", b, " ", c, " says ", d, " to ", e, " about ", f] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(6);
    });

    it('binary expression with string concat — dynamic, gets _Var', () => {
      // BEFORE JSX:  <div>Result: {"$" + amount}</div>
      // AFTER JSX:   <div><_T>Result: <_Var>{"$" + amount}</_Var></_T></div>
      const code = `
        import { jsxs } from 'react/jsx-runtime';
        jsxs("div", { children: ["Result: ", "$" + amount] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(1);
    });

    it('tagged template literal — dynamic, gets _Var', () => {
      // BEFORE JSX:  <div>Value: {html`<b>${x}</b>`}</div>
      // AFTER JSX:   <div><_T>Value: <_Var>{html`<b>${x}</b>`}</_Var></_T></div>
      const code = `
        import { jsxs } from 'react/jsx-runtime';
        jsxs("div", { children: ["Value: ", html\`<b>\${x}</b>\`] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(1);
    });

    it('optional chaining expression — dynamic, gets _Var', () => {
      // BEFORE JSX:  <div>Name: {user?.name}</div>
      // AFTER JSX:   <div><_T>Name: <_Var>{user?.name}</_Var></_T></div>
      const code = `
        import { jsxs } from 'react/jsx-runtime';
        jsxs("div", { children: ["Name: ", user?.name] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(1);
    });

    it('nullish coalescing — dynamic, gets _Var', () => {
      // BEFORE JSX:  <div>Name: {name ?? "Anonymous"}</div>
      // AFTER JSX:   <div><_T>Name: <_Var>{name ?? "Anonymous"}</_Var></_T></div>
      const code = `
        import { jsxs } from 'react/jsx-runtime';
        jsxs("div", { children: ["Name: ", name ?? "Anonymous"] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(1);
    });

    it('await expression — dynamic, gets _Var', () => {
      // BEFORE JSX:  <div>Data: {await fetchData()}</div>
      // AFTER JSX:   <div><_T>Data: <_Var>{await fetchData()}</_Var></_T></div>
      const code = `
        import { jsxs } from 'react/jsx-runtime';
        jsxs("div", { children: ["Data: ", await fetchData()] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(1);
    });
  });

  // ===== 19. User Var depth counter stress =====

  describe('user Var depth counter', () => {
    it('user Var with deeply nested JSX — nothing inside is touched', () => {
      // BEFORE JSX:  <div>Hello <Var>{show ? <div><span>Deep {x}</span></div> : null}</Var></div>
      // AFTER JSX:   <div><_T>Hello <Var>{...}</_Var></_T></div>  — everything inside Var is opaque
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        import { Var } from 'gt-react';
        jsxs("div", { children: [
          "Hello ",
          jsx(Var, { children: show ? jsx("div", { children: jsxs("span", { children: ["Deep ", x] }) }) : null })
        ] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      // 1 _T at div, 0 auto _Var (user Var handles it, "Deep" inside not touched)
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(0);
    });

    it('adjacent user Var components — each is independently opaque', () => {
      // BEFORE JSX:  <div>A <Var>{x}</Var> B <Var>{y}</Var> C</div>
      // AFTER JSX:   <div><_T>A <Var>{x}</Var> B <Var>{y}</Var> C</_T></div>
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        import { Var } from 'gt-react';
        jsxs("div", { children: [
          "A ", jsx(Var, { children: x }),
          " B ", jsx(Var, { children: y }),
          " C"
        ] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(0);
    });

    it('user Num followed by auto-insertable content in sibling', () => {
      // BEFORE JSX:  <div><span>Price: <Num>{price}</Num></span><span>Buy {item} now!</span></div>
      // AFTER JSX:   first span: _T wraps, Num untouched. second span: _T wraps, {item} gets auto _Var
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        import { Num } from 'gt-react';
        jsxs("div", { children: [
          jsxs("span", { children: ["Price: ", jsx(Num, { children: price })] }),
          jsxs("span", { children: ["Buy ", item, " now!"] })
        ] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      // 2 _T: one per span
      expect(gtTranslateCalls).toHaveLength(2);
      // 1 auto _Var: {item} in second span
      expect(gtVarCalls).toHaveLength(1);
    });
  });

  // ===== 20. Multiple jsx calls in one file (multiple components) =====

  describe('multiple components in one file', () => {
    it('two separate component returns — each processed independently', () => {
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        function Header() {
          return jsx("h1", { children: "Welcome" });
        }
        function Footer() {
          return jsxs("p", { children: ["Copyright ", year] });
        }
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      // 2 _T: one in Header, one in Footer
      expect(gtTranslateCalls).toHaveLength(2);
      // 1 _Var: {year} in Footer
      expect(gtVarCalls).toHaveLength(1);
    });

    it('component with conditional return paths — both get processed', () => {
      const code = `
        import { jsx } from 'react/jsx-runtime';
        function Status({ ok }) {
          if (ok) return jsx("span", { children: "Success" });
          return jsx("span", { children: "Error" });
        }
      `;
      const { gtTranslateCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(2);
    });
  });

  // ===== 21. Adversarial / pathological inputs =====

  describe('adversarial inputs', () => {
    it('extremely long string — still gets _T', () => {
      const longText = 'A'.repeat(10000);
      const code = `
        import { jsx } from 'react/jsx-runtime';
        jsx("div", { children: "${longText}" });
      `;
      const { gtTranslateCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
    });

    it('unicode content — treated as translatable text', () => {
      // BEFORE JSX:  <div>こんにちは {name}</div>
      // AFTER JSX:   <div><_T>こんにちは <_Var>{name}</_Var></_T></div>
      const code = `
        import { jsxs } from 'react/jsx-runtime';
        jsxs("div", { children: ["こんにちは ", name] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(1);
    });

    it('emoji content — treated as translatable text', () => {
      const code = `
        import { jsx } from 'react/jsx-runtime';
        jsx("div", { children: "Hello 🌍" });
      `;
      const { gtTranslateCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
    });

    it('children prop is a single jsx call (not array) — still processed', () => {
      // BEFORE JSX:  <div><span>Only child</span></div>
      // AFTER JSX:   <div><span><_T>Only child</_T></span></div>
      const code = `
        import { jsx } from 'react/jsx-runtime';
        jsx("div", { children: jsx("span", { children: "Only child" }) });
      `;
      const { gtTranslateCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
    });

    it('props arg is not an object — graceful no-op', () => {
      const code = `
        import { jsx } from 'react/jsx-runtime';
        jsx("div", someVariable);
      `;
      const { gtTranslateCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(0);
    });

    it('no second argument — graceful no-op', () => {
      const code = `
        import { jsx } from 'react/jsx-runtime';
        jsx("div");
      `;
      const { gtTranslateCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(0);
    });

    it('spread in props alongside explicit children — children still found', () => {
      const code = `
        import { jsx } from 'react/jsx-runtime';
        jsx("div", { ...otherProps, children: "Hello" });
      `;
      const { gtTranslateCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
    });
  });

  // ===== 22. Branch children with nested JSX =====

  describe('Branch children with complex content', () => {
    it('Branch children with nested element containing text — children processed as fallback', () => {
      // BEFORE JSX:  <div><Branch branch="x"><p>Fallback paragraph</p></Branch></div>
      // AFTER JSX:   <div><_T><Branch branch="x"><p>Fallback paragraph</p></Branch></_T></div>
      // The <p> inside Branch children is a jsx call — handled by processChildren
      const code = `
        import { jsx } from 'react/jsx-runtime';
        import { Branch } from 'gt-react';
        jsx("div", { children: jsx(Branch, { branch: "x", children: jsx("p", { children: "Fallback paragraph" }) }) });
      `;
      const { gtTranslateCalls } = transform(code);
      // 1 _T at div wrapping Branch. The <p> inside Branch children is static JSX, not re-processed.
      expect(gtTranslateCalls).toHaveLength(1);
    });

    it('Branch with multiple content props, each with different content types', () => {
      // BEFORE JSX:  <div><Branch branch="x" a="simple" b={dynamic} c={<span>JSX</span>}>fb</Branch></div>
      // AFTER JSX:   a stays (static), b gets _Var, c's children get recursed into
      const code = `
        import { jsx } from 'react/jsx-runtime';
        import { Branch } from 'gt-react';
        jsx("div", { children: jsx(Branch, {
          branch: "x",
          a: "simple",
          b: dynamic,
          c: jsx("span", { children: "JSX" }),
          children: "fb"
        }) });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
      // b={dynamic} gets _Var. a is static string. c is static JSX.
      expect(gtVarCalls).toHaveLength(1);
    });

    it('Plural with all plural forms as JSX elements', () => {
      // BEFORE JSX:  <div><Plural n={c} one={<b>one item</b>} other={<b>many items</b>} /></div>
      // AFTER JSX:   <div><_T><Plural n={c} one={<b>one item</b>} other={<b>many items</b>} /></_T></div>
      // JSX prop values are static — no _T inside, no _Var
      const code = `
        import { jsx } from 'react/jsx-runtime';
        import { Plural } from 'gt-react';
        jsx("div", { children: jsx(Plural, {
          n: c,
          one: jsx("b", { children: "one item" }),
          other: jsx("b", { children: "many items" })
        }) });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      expect(gtTranslateCalls).toHaveLength(1);
      expect(gtVarCalls).toHaveLength(0);
    });
  });

  // ===== 23. Deeply mixed trees =====

  describe('deeply mixed trees', () => {
    it('realistic page layout: header text + nav links + main with Derive + footer with Branch', () => {
      // A realistic page with multiple components at different levels
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        import { Derive, Branch } from 'gt-react';
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
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      // header h1: _T wraps "Welcome to {siteName}" → 1 _T, 1 _Var
      // nav a "Home": _T → 1 _T
      // nav a "About": _T → 1 _T
      // main: "Hello " + Derive + "!" → _T at main (text + opaque) → 1 _T, 0 _Var
      // footer: Branch triggers _T → 1 _T
      expect(gtTranslateCalls).toHaveLength(5);
      expect(gtVarCalls).toHaveLength(1); // {siteName}
    });

    it('3 levels of independent _T — no leaking between levels', () => {
      // BEFORE JSX:  <div><section><span>Inner</span></section><p>Sibling {x}</p></div>
      // AFTER JSX:   <div><section><span><_T>Inner</_T></span></section><p><_T>Sibling <_Var>{x}</_Var></_T></p></div>
      const code = `
        import { jsx, jsxs } from 'react/jsx-runtime';
        jsxs("div", { children: [
          jsx("section", { children: jsx("span", { children: "Inner" }) }),
          jsxs("p", { children: ["Sibling ", x] })
        ] });
      `;
      const { gtTranslateCalls, gtVarCalls } = transform(code);
      // 2 independent _T: "Inner" in span, "Sibling {x}" in p
      expect(gtTranslateCalls).toHaveLength(2);
      expect(gtVarCalls).toHaveLength(1);
    });
  });
});
