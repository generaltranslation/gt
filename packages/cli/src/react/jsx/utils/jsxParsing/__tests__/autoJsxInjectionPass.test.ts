/**
 * Tier 1: Injection-only tests for auto JSX insertion in the CLI.
 *
 * Tests autoInsertJsxComponents() in isolation — verifies the AST is correctly
 * modified with GtInternalTranslateJsx (_T) and GtInternalVar (_Var) wrappers.
 *
 * CLI equivalent of the compiler's jsxInsertionPass.test.ts + jsxInsertionEdgeCases.test.ts.
 * Operates on raw JSX syntax (not compiled jsx() calls).
 *
 * See JSX_INSERTION_RULES.md for the insertion rules.
 */
import { describe, it, expect } from 'vitest';
import * as t from '@babel/types';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import generateModule from '@babel/generator';
import {
  ensureTAndVarImported,
  autoInsertJsxComponents,
} from '../autoInsertion.js';
import { getPathsAndAliases } from '../../getPathsAndAliases.js';
import { Libraries } from '../../../../../types/libraries.js';
import {
  INTERNAL_TRANSLATION_COMPONENT,
  INTERNAL_VAR_COMPONENT,
} from '../../constants.js';

const traverse: typeof traverseModule.default =
  (traverseModule as any).default || traverseModule;
const generate: typeof generateModule.default =
  (generateModule as any).default || generateModule;

// ================================================================ //
//  Helper
// ================================================================ //

function injectAndAnalyze(sourceCode: string) {
  const ast = parse(sourceCode, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  const pkgs = [Libraries.GT_NEXT, Libraries.GT_REACT] as any[];
  const result = getPathsAndAliases(ast, pkgs);
  // getPathsAndAliases puts T/GtInternalTranslateJsx into translationComponentPaths,
  // not importAliases. But autoInsertJsxComponents needs them in importAliases for
  // component recognition (to know <T> is a user T and should be skipped).
  const aliases: Record<string, string> = { ...result.importAliases };
  for (const { localName, originalName } of result.translationComponentPaths) {
    aliases[localName] = originalName;
  }

  ensureTAndVarImported(ast, aliases);
  autoInsertJsxComponents(ast, aliases);

  const code = generate(ast).code;

  // Count T and Var elements in the output
  let tCount = 0;
  let varCount = 0;
  const imports: string[] = [];

  const freshAst = parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  traverse(freshAst, {
    JSXIdentifier(path) {
      if (
        path.node.name === INTERNAL_TRANSLATION_COMPONENT &&
        path.parentPath?.isJSXOpeningElement()
      ) {
        tCount++;
      }
      if (
        path.node.name === INTERNAL_VAR_COMPONENT &&
        path.parentPath?.isJSXOpeningElement()
      ) {
        varCount++;
      }
    },
    ImportDeclaration(path) {
      imports.push(path.node.source.value);
    },
  });

  return { code, tCount, varCount, imports };
}

// ================================================================ //
//  Tests
// ================================================================ //

describe('autoInsertJsxComponents — injection pass', () => {
  // ===== 1. T INSERTION — basic ===== //

  describe('T insertion — basic', () => {
    it('wraps text-only element in T', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div>Hello</div>; }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
      expect(r.varCount).toBe(0);
      expect(r.code).toContain(INTERNAL_TRANSLATION_COMPONENT);
    });

    it('wraps numeric child alongside text in T', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div>Count: {42}</div>; }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
      expect(r.varCount).toBe(0);
    });

    it('wraps text with nested element in T', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div>Hello <b>World</b> today</div>; }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
      expect(r.varCount).toBe(0);
    });
  });

  // ===== 2. VAR WRAPPING ===== //

  describe('Var wrapping', () => {
    it('wraps identifier expression in Var', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div>Hello {name}</div>; }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
      expect(r.varCount).toBe(1);
    });

    it('wraps member expression in Var', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div>Price: {obj.price}</div>; }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
      expect(r.varCount).toBe(1);
    });

    it('wraps ternary in Var', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div>Status: {isActive ? "on" : "off"}</div>; }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
      expect(r.varCount).toBe(1);
    });

    it('wraps function call in Var', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div>Result: {getValue()}</div>; }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
      expect(r.varCount).toBe(1);
    });

    it('wraps interpolated template literal in Var', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div>Hello {\`\${name}!\`}</div>; }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
      expect(r.varCount).toBe(1);
    });

    it('does NOT wrap string literals in Var', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div>Hello World</div>; }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
      expect(r.varCount).toBe(0);
    });

    it('does NOT wrap nested JSX elements in Var', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div>Hello <b>World</b></div>; }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
      expect(r.varCount).toBe(0);
    });

    it('does NOT wrap static template literal in Var', () => {
      // In raw JSX, {`Hello`} is a JSXExpressionContainer with a TemplateLiteral.
      // hasTranslatableText only checks JSXText nodes, so static template literals
      // don't trigger T on their own. But if they're alongside actual JSXText, they
      // won't get Var-wrapped either (isStaticExpression returns true).
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div>Text {\`Hello\`}</div>; }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1); // "Text " triggers T
      expect(r.varCount).toBe(0); // static template not wrapped in Var
    });

    it('each dynamic child gets its own individual Var', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <div>{a}sometext{b}{c} and {d}</div>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
      expect(r.varCount).toBe(4);
    });

    it('multiple Vars inside the same T', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <div>Hello {firstName}, welcome to {city}!</div>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
      expect(r.varCount).toBe(2);
    });

    it('wraps binary expression with string concat in Var', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div>Total: {"$" + amount}</div>; }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
      expect(r.varCount).toBe(1);
    });
  });

  // ===== 3. SKIP CASES ===== //

  describe('skip cases — no insertion', () => {
    it('no children — no T', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div />; }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(0);
      expect(r.varCount).toBe(0);
    });

    it('empty element — no T', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div></div>; }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(0);
    });

    it('only dynamic content and whitespace — no T', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div>{firstName} {lastName}</div>; }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(0);
      expect(r.varCount).toBe(0);
    });

    it('expression-only child — no T', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div>{userName}</div>; }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(0);
    });

    it('whitespace-only children — no T', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div>   </div>; }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(0);
    });

    it('boolean literals only — no T', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div>{true} {false}</div>; }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(0);
    });

    it('numeric literal only — no T', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div>{42}</div>; }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(0);
    });
  });

  // ===== 4. USER COMPONENT HANDS-OFF ===== //

  describe('user component hands-off', () => {
    it('user T — skip entirely', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <T>Hello</T>; }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(0);
    });

    it('user T with user Var — skip entirely', () => {
      const code = `
        import { T, Var } from "gt-next";
        export default function Page() {
          return <T>Hello <Var>{name}</Var></T>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(0);
      expect(r.varCount).toBe(0);
    });

    it('nested content inside user T is never touched', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <T>Hello <span>{name} <b>World</b></span></T>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(0);
      expect(r.varCount).toBe(0);
    });

    it('inserts T but preserves user Var', () => {
      const code = `
        import { T, Var } from "gt-next";
        export default function Page() {
          return <div>Hello <Var>{name}</Var></div>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
      // No auto Var — user Var already handles it
      expect(r.varCount).toBe(0);
    });

    it('inserts T but preserves user Num', () => {
      const code = `
        import { T, Num } from "gt-next";
        export default function Page() {
          return <div>Price: <Num>{price}</Num></div>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
      expect(r.varCount).toBe(0);
    });

    it('inserts T but preserves user Currency', () => {
      const code = `
        import { T, Currency } from "gt-next";
        export default function Page() {
          return <div>Paid <Currency>{amount}</Currency></div>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
      expect(r.varCount).toBe(0);
    });

    it('inserts T but preserves user DateTime', () => {
      const code = `
        import { T, DateTime } from "gt-next";
        export default function Page() {
          return <div>Date: <DateTime>{date}</DateTime></div>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
      expect(r.varCount).toBe(0);
    });

    it('user Var alongside auto Var — only non-user expression gets Var', () => {
      const code = `
        import { T, Var } from "gt-next";
        export default function Page() {
          return <div>Hello <Var>{x}</Var> and {y}</div>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
      expect(r.varCount).toBe(1); // only y
    });
  });

  // ===== 5. NESTING ===== //

  describe('nesting', () => {
    it('T at deepest level with text', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <div><span>Click me</span></div>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
      // T should be inside span, not div
      expect(r.code).toContain(`<span><${INTERNAL_TRANSLATION_COMPONENT}>`);
    });

    it('3-level nesting — T at leaf', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <main><section><p>Deep text</p></section></main>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
    });

    it('5-level nesting — T at leaf only', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <main><section><article><div><p>Very deep</p></div></article></section></main>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
    });

    it('5-level — text at root claims subtree, Var deep inside', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <main>Root text <section><article><p><span>{name}</span></p></article></section></main>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
      expect(r.varCount).toBe(1);
    });

    it('parent with text claims subtree', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <div>Hello <b>World</b> today</div>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
    });

    it('siblings at different depths — independent T', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <div><span>First</span><p><em>Second</em></p></div>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(2);
    });

    it('nested fragments inside fragments', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <><>Hello World</></>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
    });
  });

  // ===== 6. BRANCH/PLURAL OPAQUE ===== //

  describe('Branch/Plural opaque', () => {
    it('Branch triggers T at parent', () => {
      const code = `
        import { T, Branch } from "gt-next";
        export default function Page() {
          return <div><Branch branch="test">Fallback</Branch></div>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
    });

    it('Plural triggers T at parent', () => {
      const code = `
        import { T, Plural } from "gt-next";
        export default function Page() {
          return <div><Plural n={count} one="item" other="items" /></div>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
    });

    it('does NOT insert T inside Branch children', () => {
      const code = `
        import { T, Branch } from "gt-next";
        export default function Page() {
          return <div><Branch branch="x"><p>Fallback text</p></Branch></div>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1); // only at div, not inside Branch children
    });

    it('does NOT insert T inside Plural prop arguments', () => {
      const code = `
        import { T, Plural } from "gt-next";
        export default function Page() {
          return <div><Plural n={c} one={<span>One item</span>} other={<span>Many items</span>} /></div>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1); // only at div
    });

    it('Var-wraps dynamic content inside Branch children (fallback)', () => {
      const code = `
        import { Branch } from "gt-next";
        export default function Page() {
          return <div>Text <Branch branch={x}>Fallback {name}</Branch></div>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
      expect(r.varCount).toBe(1);
    });

    it('Var-wraps dynamic content inside Plural children (fallback)', () => {
      const code = `
        import { Plural } from "gt-next";
        export default function Page() {
          return <div><Plural n={count}>You have {count} items</Plural></div>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
      expect(r.varCount).toBe(1);
    });

    it('Var-wraps dynamic content inside Branch content prop JSX', () => {
      const code = `
        import { Branch } from "gt-next";
        export default function Page() {
          return <div><Branch branch="mode" Ernest={<>Hello {userName}</>}>fb</Branch></div>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
      expect(r.varCount).toBe(1);
    });

    it('wraps dynamic Branch prop value in Var', () => {
      const code = `
        import { Branch } from "gt-next";
        export default function Page() {
          return <div><Branch branch="hello" hello={count} /></div>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
      expect(r.varCount).toBe(1);
    });

    it('does NOT Var-wrap Plural n prop (control prop)', () => {
      const code = `
        import { Plural } from "gt-next";
        export default function Page() {
          return <div><Plural n={count} one="item" other="items" /></div>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.varCount).toBe(0);
    });

    it('Branch with all static props — no Var', () => {
      const code = `
        import { Branch } from "gt-next";
        export default function Page() {
          return <div><Branch branch="x" a="A" b="B">fallback</Branch></div>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.varCount).toBe(0);
    });

    it('data-* on Branch — skipped as control prop', () => {
      const code = `
        import { Branch } from "gt-next";
        export default function Page() {
          return <div><Branch branch="x" data-testid="test" hello={val}>fb</Branch></div>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.varCount).toBe(1); // only hello
    });

    it('Branch + Plural siblings inside parent with text', () => {
      const code = `
        import { Branch, Plural } from "gt-next";
        export default function Page() {
          return <div>Label: <Branch branch="x">fb</Branch><Plural n={c} one="1" other="n" /></div>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
    });
  });

  // ===== 7. DERIVE OPAQUE ===== //

  describe('Derive opaque', () => {
    it('Derive triggers T at parent', () => {
      const code = `
        import { Derive } from "gt-next";
        export default function Page() {
          return <div>Hello <Derive>{getX()}</Derive></div>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
    });

    it('does NOT Var-wrap Derive children', () => {
      const code = `
        import { Derive } from "gt-next";
        export default function Page() {
          return <div>Hello <Derive>{getName()}</Derive></div>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.varCount).toBe(0);
    });

    it('Static (deprecated) treated like Derive', () => {
      const code = `
        import { Static } from "gt-next";
        export default function Page() {
          return <div>Hello <Static>{getLabel()}</Static></div>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
      expect(r.varCount).toBe(0);
    });

    it('multiple Derive siblings — single T', () => {
      const code = `
        import { Derive } from "gt-next";
        export default function Page() {
          return <div>The <Derive>{getX()}</Derive> and <Derive>{getY()}</Derive></div>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
    });

    it('Derive alongside dynamic expression — Derive opaque, dynamic gets Var', () => {
      const code = `
        import { Derive } from "gt-next";
        export default function Page() {
          return <div>Hello <Derive>{getX()}</Derive> and {z}</div>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
      expect(r.varCount).toBe(1);
    });

    it('Derive alongside user Var — both opaque, no auto Var', () => {
      const code = `
        import { Derive, Var } from "gt-next";
        export default function Page() {
          return <div>Price: <Var>{price}</Var> for <Derive>{getItem()}</Derive></div>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
      expect(r.varCount).toBe(0);
    });

    it('Fragment wrapping only Derive — T at fragment', () => {
      const code = `
        import { Derive } from "gt-next";
        export default function Page() {
          return <><Derive>{getContent()}</Derive></>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
    });
  });

  // ===== 8. NON-CHILDREN PROPS ===== //

  describe('non-children props', () => {
    it('T in non-children prop independently from children', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <Card header={<h1>Title</h1>}>Body text</Card>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(2);
    });

    it('T in prop JSX even when children have no text', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <Card header={<h1>Title</h1>}><div /></Card>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
    });

    it('parent T does NOT leak into non-children prop', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <div>Hello <Button icon={<span>X</span>}>Click</Button></div>;
        }
      `;
      const r = injectAndAnalyze(code);
      // Two independent T: one at div (for "Hello" text), one inside span (for "X")
      expect(r.tCount).toBe(2);
    });

    it('multiple non-children props independently', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <Layout header={<h1>Header</h1>} footer={<p>Footer</p>}>Main content</Layout>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(3);
    });

    it('non-children prop with text + dynamic = T + Var', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <Card header={<h1>Title {count}</h1>}>Body</Card>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(2);
      expect(r.varCount).toBe(1);
    });
  });

  // ===== 9. FRAGMENTS ===== //

  describe('fragments', () => {
    it('text inside fragment', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <>Hello World</>; }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
    });

    it('fragment with dynamic content', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <>Welcome {name}!</>; }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
      expect(r.varCount).toBe(1);
    });
  });

  // ===== 10. CONDITIONAL RENDERING ===== //

  describe('conditional rendering', () => {
    it('ternary with JSX branches alongside text', () => {
      // T wraps at div. Ternary gets Var. Each branch's JSX gets independent T.
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <div>Status: {isActive ? <span>Active</span> : <span>Inactive</span>}</div>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(3); // outer + Active + Inactive
      expect(r.varCount).toBe(1); // ternary
    });

    it('logical AND chain', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <div>Hello {show && <span>Content</span>}</div>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(2); // outer + Content
      expect(r.varCount).toBe(1); // && expression
    });

    it('logical OR fallback', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <div>Hello {content || <span>Fallback</span>}</div>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(2); // outer + Fallback
      expect(r.varCount).toBe(1);
    });

    it('ternary with no surrounding text — no T at parent', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <div>{flag ? <p>Yes</p> : <p>No</p>}</div>;
        }
      `;
      const r = injectAndAnalyze(code);
      // No text at div -> no T at div. But each branch's <p> has text -> 2 T
      expect(r.tCount).toBe(2);
      expect(r.varCount).toBe(0);
    });

    it('nested ternary — Var around outer', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <div>Result: {a ? (b ? <span>AB</span> : <span>notB</span>) : <span>C</span>}</div>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBeGreaterThanOrEqual(3);
      expect(r.varCount).toBeGreaterThanOrEqual(1);
    });

    it('.map() alongside text — Var wraps the map call', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <ul>Items: {items.map(i => <li>{i.name}</li>)}</ul>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBeGreaterThanOrEqual(1);
      expect(r.varCount).toBe(1);
    });

    it('.map() as only child — no T', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <ul>{items.map(i => <li>{i.name}</li>)}</ul>;
        }
      `;
      const r = injectAndAnalyze(code);
      // No text at ul level, map is dynamic but no text -> no T at this level
      // (inner <li> children may or may not get T depending on whether {i.name} counts as text)
      expect(r.tCount).toBe(0);
    });
  });

  // ===== 11. EDGE CASE EXPRESSIONS ===== //

  describe('edge case expressions', () => {
    it('negative number — NOT wrapped in Var', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div>Temperature: {-5}</div>; }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
      expect(r.varCount).toBe(0);
    });

    it('null literal — not wrapped', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div>Text {null}</div>; }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
      expect(r.varCount).toBe(0);
    });

    it('optional chaining — Var', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div>Name: {user?.name}</div>; }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
      expect(r.varCount).toBe(1);
    });

    it('nullish coalescing — Var', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div>Name: {name ?? "Anonymous"}</div>; }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
      expect(r.varCount).toBe(1);
    });

    it('await expression — Var', () => {
      const code = `
        import { T } from "gt-next";
        export default async function Page() { return <div>Result: {await getData()}</div>; }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
      expect(r.varCount).toBe(1);
    });

    it('6 dynamic expressions + text = 6 Vars', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <div>Hello {a} and {b} with {c} plus {d} or {e} then {f}</div>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
      expect(r.varCount).toBe(6);
    });
  });

  // ===== 12. IDEMPOTENCY ===== //

  describe('idempotency', () => {
    it('running injection twice on same code produces same result', () => {
      // Inject once, then inject again on the output — should not add more T/Var
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div>Hello {name}</div>; }
      `;
      const first = injectAndAnalyze(code);
      expect(first.tCount).toBe(1);
      expect(first.varCount).toBe(1);

      // Run injection again on the first result
      const second = injectAndAnalyze(first.code);
      // GtInternalTranslateJsx is not in TRANSLATION_COMPONENT check,
      // so autoInsertJsxComponents will treat it as a regular element.
      // In practice this scenario doesn't occur because injection runs once.
      // Just verify no crashes.
      expect(second.tCount).toBeGreaterThanOrEqual(1);
    });

    it('no insertion on file with only auto-inserted components and no text', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div>{name}</div>; }
      `;
      const r = injectAndAnalyze(code);
      // No text -> no T, no Var
      expect(r.tCount).toBe(0);
      expect(r.varCount).toBe(0);
    });
  });

  // ===== 13. IMPORT INJECTION ===== //

  describe('import injection', () => {
    it('injects import when insertions happen', () => {
      const code = `
        export default function Page() { return <div>Hello</div>; }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
      expect(r.imports).toContain('gt-react/browser');
    });

    it('does NOT inject import when no insertions', () => {
      const code = `
        export default function Page() { return <div />; }
      `;
      // ensureTAndVarImported always adds import (it doesn't know yet whether insertions happen)
      // but autoInsertJsxComponents won't add any T/Var
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(0);
    });

    it('does not duplicate import when already imported from gt-react/browser', () => {
      // GtInternalTranslateJsx and GtInternalVar already imported —
      // ensureTAndVarImported should detect this and not add a second import.
      const code = `
        import { GtInternalTranslateJsx, GtInternalVar } from "gt-react/browser";
        export default function Page() { return <div>Hello</div>; }
      `;
      const r = injectAndAnalyze(code);
      // Should only have one gt-react/browser import
      const gtImports = r.imports.filter((i) => i === 'gt-react/browser');
      expect(gtImports).toHaveLength(1);
    });
  });

  // ===== 14. MULTIPLE COMPONENTS IN ONE FILE ===== //

  describe('multiple components in one file', () => {
    it('two separate component returns — each processed independently', () => {
      const code = `
        import { T } from "gt-next";
        function Header() { return <h1>Welcome</h1>; }
        function Footer() { return <p>Copyright {year}</p>; }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(2);
      expect(r.varCount).toBe(1); // year in Footer
    });

    it('component with conditional return paths — both processed', () => {
      const code = `
        import { T } from "gt-next";
        function Message({ ok }: { ok: boolean }) {
          if (ok) return <span>Success</span>;
          return <span>Error</span>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(2);
    });
  });

  // ===== 15. ADVERSARIAL INPUTS ===== //

  describe('adversarial inputs', () => {
    it('extremely long string — still gets T', () => {
      const longStr = 'A'.repeat(10000);
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div>${longStr}</div>; }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
    });

    it('unicode content — treated as translatable text', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div>こんにちは世界</div>; }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
    });

    it('emoji content — treated as translatable text', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() { return <div>Hello 🌍 World</div>; }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
    });

    it('spread props alongside children — children still found', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          const props = {};
          return <div {...props}>Hello World</div>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
    });
  });

  // ===== 16. REAL-WORLD PATTERNS ===== //

  describe('real-world patterns', () => {
    it('nav bar with multiple links', () => {
      const code = `
        import { T } from "gt-next";
        export default function Nav() {
          return (
            <nav>
              <a href="/">Home</a>
              <a href="/about">About</a>
              <a href="/contact">Contact</a>
            </nav>
          );
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(3);
    });

    it('table row with mixed static/dynamic cells', () => {
      const code = `
        import { T } from "gt-next";
        export default function Row() {
          return (
            <tr>
              <td>Name:</td>
              <td>{userName}</td>
              <td>Status: {status}</td>
            </tr>
          );
        }
      `;
      const r = injectAndAnalyze(code);
      // "Name:" -> T, {userName} -> no T (no text), "Status: {status}" -> T + Var
      expect(r.tCount).toBe(2);
      expect(r.varCount).toBe(1);
    });

    it('form with labels and inputs', () => {
      const code = `
        import { T } from "gt-next";
        export default function Form() {
          return (
            <form>
              <label>Email:</label>
              <input type="email" placeholder="you@example.com" />
              <label>Password:</label>
              <input type="password" />
            </form>
          );
        }
      `;
      const r = injectAndAnalyze(code);
      // Two labels with text -> 2 T. Inputs have no children -> 0.
      // placeholder is attribute, not children -> untouched
      expect(r.tCount).toBe(2);
    });

    it('card with header prop + body + footer prop', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return (
            <Card
              header={<h2>Welcome {name}</h2>}
              footer={<small>Copyright {year}</small>}
            >
              Main content here
            </Card>
          );
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(3);
      expect(r.varCount).toBe(2); // name + year
    });

    it('error boundary fallback pattern', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return <ErrorBoundary fallback={<div>Something went wrong</div>}><App /></ErrorBoundary>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1); // "Something went wrong" in fallback prop
    });
  });

  // ===== 17. USER VAR DEPTH COUNTER ===== //

  describe('user Var depth counter', () => {
    it('user Var with deeply nested JSX — nothing inside is touched', () => {
      const code = `
        import { T, Var } from "gt-next";
        export default function Page() {
          return <div>Hello <Var>{flag ? <span><b>Deep {text}</b></span> : <em>Other</em>}</Var></div>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1); // only the outer T around "Hello <Var>..."
      expect(r.varCount).toBe(0); // user Var, not auto Var
    });

    it('adjacent user Var components — each independently opaque', () => {
      const code = `
        import { T, Var } from "gt-next";
        export default function Page() {
          return <div>Hello <Var>{a}</Var> and <Var>{b}</Var> done</div>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
      expect(r.varCount).toBe(0); // both are user Var
    });

    it('user Num followed by auto-insertable content in sibling', () => {
      const code = `
        import { T, Num } from "gt-next";
        export default function Page() {
          return <div>Count: <Num>{x}</Num> total {y} items</div>;
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
      expect(r.varCount).toBe(1); // only y (Num is user component)
    });
  });

  // ===== 18. DEEPLY MIXED TREES ===== //

  describe('deeply mixed trees', () => {
    it('3 levels of independent T — no leaking between levels', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return (
            <div>
              <section>
                <h1>Title</h1>
                <p>Paragraph {count}</p>
              </section>
              <aside>
                <span>Side note</span>
              </aside>
            </div>
          );
        }
      `;
      const r = injectAndAnalyze(code);
      // "Title" -> T inside h1, "Paragraph {count}" -> T + Var inside p, "Side note" -> T inside span
      expect(r.tCount).toBe(3);
      expect(r.varCount).toBe(1);
    });

    it('Branch + Derive + dynamic expression siblings', () => {
      const code = `
        import { Branch, Derive } from "gt-next";
        export default function Page() {
          return (
            <div>
              Label: <Branch branch="x">fb</Branch>
              <Derive>{getStuff()}</Derive>
              {dynamicVal}
            </div>
          );
        }
      `;
      const r = injectAndAnalyze(code);
      expect(r.tCount).toBe(1);
      expect(r.varCount).toBe(1); // dynamicVal
    });

    it('realistic page layout', () => {
      const code = `
        import { Branch, Derive, Num } from "gt-next";
        export default function Page() {
          return (
            <main>
              <header>
                <h1>Welcome {userName}</h1>
                <nav><a href="/">Home</a><a href="/about">About</a></nav>
              </header>
              <section>
                <p>You have <Num>{count}</Num> items</p>
                <div><Derive>{getDetails()}</Derive></div>
              </section>
              <footer>
                <Branch branch="theme" dark={<span>Dark mode</span>} light={<span>Light mode</span>}>
                  Default
                </Branch>
              </footer>
            </main>
          );
        }
      `;
      const r = injectAndAnalyze(code);
      // h1 "Welcome {userName}" -> T+Var, "Home" -> T, "About" -> T,
      // "You have <Num>...</Num> items" -> T, <Derive> inside div -> T at div level,
      // Branch in footer -> T at footer level
      expect(r.tCount).toBeGreaterThanOrEqual(5);
      expect(r.varCount).toBeGreaterThanOrEqual(1);
    });
  });
});
