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
  const state = initializeState(
    { enableAutoJsxInjection: true },
    'test.tsx'
  );
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

  // ===== Imports =====

  it('injects import when insertions happen', () => {
    const code = `
      import { jsx } from 'react/jsx-runtime';
      jsx("div", { children: "Hello" });
    `;
    const { imports } = transform(code);
    const gtImport = imports.find(
      (i) => i.source.value === 'gt-react/browser'
    );
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
    const gtImport = imports.find(
      (i) => i.source.value === 'gt-react/browser'
    );
    expect(gtImport).toBeUndefined();
  });
});
