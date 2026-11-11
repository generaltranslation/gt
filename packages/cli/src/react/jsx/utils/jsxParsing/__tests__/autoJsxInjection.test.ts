/**
 * Auto JSX injection in the CLI extraction pipeline.
 *
 * With enableAutoJsxInjection the CLI extracts in two passes:
 *   Pass 1: user-written <T> components (unchanged behavior)
 *   Pass 2: inject GtInternalTranslateJsx / GtInternalVar into the AST and
 *           extract from the injected components only
 *
 * The extracted sources (and therefore hashes) must agree with what a user
 * would get by writing <T> and <Var> by hand, and with the compiler plugin.
 * See JSX_INSERTION_RULES.md in the compiler package for the insertion rules.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as t from '@babel/types';
import traverseModule from '@babel/traverse';
import { getPathsAndAliases } from '../../getPathsAndAliases.js';
import {
  ensureTAndVarImported,
  autoInsertJsxComponents,
} from '../autoInsertion.js';
import { INTERNAL_TRANSLATION_COMPONENT } from '../../constants.js';
import { Libraries } from '../../../../../types/libraries.js';
import {
  collectAliases,
  extractUserT,
  extractWithAutoInjection,
  inject,
  mockFiles,
  page,
  parseCode,
  sources,
} from './harness.js';

vi.mock('node:fs');
vi.mock('../../resolveImportPath.js');

const traverse = traverseModule.default || traverseModule;

const DYNAMIC_CHILDREN =
  '<T> component has children that could change at runtime';

/** The variable an auto-injected (or user) Var produces at GT id `i`. */
const variable = (i: number) => ({ i, k: `_gt_value_${i}`, v: 'v' });

beforeEach(() => {
  vi.resetAllMocks();
});

describe('injection pass', () => {
  // [description, JSX returned by the page, injected T count, injected Var count]
  it.each<[string, string, number, number]>([
    // Text makes an element translatable; only dynamic expressions get a Var
    ['text only', '<div>Hello</div>', 1, 0],
    ['text and a numeric literal', '<div>Count: {42}</div>', 1, 0],
    ['text and a nested element', '<div>Hello <b>World</b> today</div>', 1, 0],
    ['an identifier', '<div>Hello {name}</div>', 1, 1],
    ['a member expression', '<div>Price: {obj.price}</div>', 1, 1],
    [
      'a ternary of strings',
      '<div>Status: {isActive ? "on" : "off"}</div>',
      1,
      1,
    ],
    ['a function call', '<div>Result: {getValue()}</div>', 1, 1],
    ['an interpolated template', '<div>Hello {`${name}!`}</div>', 1, 1],
    ['a static template literal', '<div>Text {`Hello`}</div>', 1, 0],
    ['a string concatenation', '<div>Total: {"$" + amount}</div>', 1, 1],
    ['a negative number', '<div>Temperature: {-5}</div>', 1, 0],
    ['a null literal', '<div>Text {null}</div>', 1, 0],
    ['optional chaining', '<div>Name: {user?.name}</div>', 1, 1],
    ['nullish coalescing', '<div>Name: {name ?? "Anonymous"}</div>', 1, 1],
    ['several dynamic children', '<div>{a}sometext{b}{c} and {d}</div>', 1, 4],
    ['unicode and emoji text', '<div>こんにちは 🌍</div>', 1, 0],
    ['spread props next to text', '<div {...props}>Hello World</div>', 1, 0],

    // Nothing translatable
    ['a self-closing element', '<div />', 0, 0],
    ['an empty element', '<div></div>', 0, 0],
    ['whitespace only', '<div>   </div>', 0, 0],
    ['an expression only', '<div>{userName}</div>', 0, 0],
    [
      'expressions separated by whitespace',
      '<div>{firstName} {lastName}</div>',
      0,
      0,
    ],
    ['boolean literals only', '<div>{true} {false}</div>', 0, 0],
    ['a numeric literal only', '<div>{42}</div>', 0, 0],
    [
      'a map as the only child',
      '<ul>{items.map(i => <li>{i}</li>)}</ul>',
      0,
      0,
    ],

    // User-written GT components are left alone
    ['a user T', '<T>Hello</T>', 0, 0],
    ['a user T containing a user Var', '<T>Hello <Var>{name}</Var></T>', 0, 0],
    [
      'nested content inside a user T',
      '<T>Hello <span>{name} <b>World</b></span></T>',
      0,
      0,
    ],
    ['a user Var', '<div>Hello <Var>{name}</Var></div>', 1, 0],
    ['a user Num', '<div>Price: <Num>{price}</Num></div>', 1, 0],
    ['a user Currency', '<div>Paid <Currency>{amount}</Currency></div>', 1, 0],
    ['a user DateTime', '<div>Date: <DateTime>{date}</DateTime></div>', 1, 0],
    [
      'a user Var next to a dynamic expression',
      '<div>Hello <Var>{x}</Var> and {y}</div>',
      1,
      1,
    ],
    [
      'JSX nested inside a user Var',
      '<div>Hello <Var>{flag ? <span><b>Deep {text}</b></span> : <em>Other</em>}</Var></div>',
      1,
      0,
    ],

    // The T goes on the outermost element that has text
    [
      'text in a deeply nested leaf',
      '<main><section><article><div><p>Very deep</p></div></article></section></main>',
      1,
      0,
    ],
    [
      'text at the root with a deeply nested expression',
      '<main>Root text <section><article><p><span>{name}</span></p></article></section></main>',
      1,
      1,
    ],
    [
      'siblings at different depths',
      '<div><span>First</span><p><em>Second</em></p></div>',
      2,
      0,
    ],
    ['a fragment', '<>Hello World</>', 1, 0],
    ['a fragment with dynamic content', '<>Welcome {name}!</>', 1, 1],
    ['nested fragments', '<><>Hello World</></>', 1, 0],

    // Branch and Plural are opaque: one T at the parent, Var for dynamic content
    ['a Branch', '<div><Branch branch="test">Fallback</Branch></div>', 1, 0],
    [
      'a Plural (n is a control prop)',
      '<div><Plural n={count} one="item" other="items" /></div>',
      1,
      0,
    ],
    [
      'an element in Branch children',
      '<div><Branch branch="x"><p>Fallback text</p></Branch></div>',
      1,
      0,
    ],
    [
      'elements in Plural forms',
      '<div><Plural n={c} one={<span>One item</span>} other={<span>Many items</span>} /></div>',
      1,
      0,
    ],
    [
      'dynamic content in Branch children',
      '<div>Text <Branch branch={x}>Fallback {name}</Branch></div>',
      1,
      1,
    ],
    [
      'dynamic content in Plural children',
      '<div><Plural n={count}>You have {count} items</Plural></div>',
      1,
      1,
    ],
    [
      'dynamic content in a JSX Branch prop',
      '<div><Branch branch="mode" Ernest={<>Hello {userName}</>}>fb</Branch></div>',
      1,
      1,
    ],
    [
      'a dynamic Branch prop value',
      '<div><Branch branch="hello" hello={count} /></div>',
      1,
      1,
    ],
    [
      'static Branch props',
      '<div><Branch branch="x" a="A" b="B">fallback</Branch></div>',
      1,
      0,
    ],
    [
      'a data-* attribute on Branch',
      '<div><Branch branch="x" data-testid={id} hello={val}>fb</Branch></div>',
      1,
      1,
    ],
    [
      'Branch and Plural siblings next to text',
      '<div>Label: <Branch branch="x">fb</Branch><Plural n={c} one="1" other="n" /></div>',
      1,
      0,
    ],

    // Derive is opaque and its children are never wrapped
    ['a Derive', '<div>Hello <Derive>{getX()}</Derive></div>', 1, 0],
    [
      'Derive siblings',
      '<div>The <Derive>{getX()}</Derive> and <Derive>{getY()}</Derive></div>',
      1,
      0,
    ],
    [
      'a Derive next to a dynamic expression',
      '<div>Hello <Derive>{getX()}</Derive> and {z}</div>',
      1,
      1,
    ],
    [
      'a Derive next to a user Var',
      '<div>Price: <Var>{price}</Var> for <Derive>{getItem()}</Derive></div>',
      1,
      0,
    ],
    [
      'a fragment containing only a Derive',
      '<><Derive>{getContent()}</Derive></>',
      1,
      0,
    ],
    [
      'Branch, Derive and a dynamic expression',
      '<div>Label: <Branch branch="x">fb</Branch><Derive>{getStuff()}</Derive>{dynamicVal}</div>',
      1,
      1,
    ],

    // JSX in props is translated independently of the children
    [
      'a JSX prop and text children',
      '<Card header={<h1>Title</h1>}>Body text</Card>',
      2,
      0,
    ],
    [
      'a JSX prop without text children',
      '<Card header={<h1>Title</h1>}><div /></Card>',
      1,
      0,
    ],
    [
      'a JSX prop of an element inside a T',
      '<div>Hello <Button icon={<span>X</span>}>Click</Button></div>',
      2,
      0,
    ],
    [
      'several JSX props',
      '<Layout header={<h1>Header</h1>} footer={<p>Footer</p>}>Main content</Layout>',
      3,
      0,
    ],
    [
      'a JSX prop with dynamic content',
      '<Card header={<h1>Title {count}</h1>}>Body</Card>',
      2,
      1,
    ],

    // JSX inside a dynamic expression is translated independently
    [
      'a ternary of JSX next to text',
      '<div>Status: {isActive ? <span>Active</span> : <span>Inactive</span>}</div>',
      3,
      1,
    ],
    [
      'a ternary of JSX without text',
      '<div>{flag ? <p>Yes</p> : <p>No</p>}</div>',
      2,
      0,
    ],
    [
      'a nested ternary of JSX',
      '<div>Result: {a ? (b ? <span>AB</span> : <span>notB</span>) : <span>C</span>}</div>',
      4,
      1,
    ],
    ['a logical AND', '<div>Hello {show && <span>Content</span>}</div>', 2, 1],
    [
      'a logical OR',
      '<div>Hello {content || <span>Fallback</span>}</div>',
      2,
      1,
    ],
    [
      'a map next to text',
      '<ul>Items: {items.map(i => <li>{i.name}</li>)}</ul>',
      1,
      1,
    ],
  ])('%s', (_name, jsx, tCount, varCount) => {
    const result = inject(page(jsx));

    expect([result.tCount, result.varCount]).toEqual([tCount, varCount]);
  });

  it.each<[string, string, number, number]>([
    [
      'an await expression',
      'export default async function Page() { return <div>Result: {await getData()}</div>; }',
      1,
      1,
    ],
    [
      'each component of a file',
      `function Header() { return <h1>Welcome</h1>; }
       function Footer() { return <p>Copyright {year}</p>; }`,
      2,
      1,
    ],
    [
      'each return path of a component',
      `function Message({ ok }: { ok: boolean }) {
         if (ok) return <span>Success</span>;
         return <span>Error</span>;
       }`,
      2,
      0,
    ],
    [
      'a realistic page',
      `import { Branch, Derive, Num } from "gt-next";
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
       }`,
      6,
      1,
    ],
  ])('%s', (_name, code, tCount, varCount) => {
    const result = inject(code);

    expect([result.tCount, result.varCount]).toEqual([tCount, varCount]);
  });

  it('wraps the children of the innermost element with text', () => {
    expect(
      inject(page('<div><span>Click {count}</span></div>')).code
    ).toContain(
      '<div><span><GtInternalTranslateJsx>Click {<GtInternalVar>{count}</GtInternalVar>}</GtInternalTranslateJsx></span></div>'
    );
  });

  it('accepts source that already contains injected components', () => {
    const first = inject(page('<div>Hello {name}</div>'));
    const second = inject(first.code);

    expect([first.tCount, first.varCount]).toEqual([1, 1]);
    expect(second.tCount).toBeGreaterThanOrEqual(1);
  });

  describe('imports', () => {
    it('imports the internal components from gt-react', () => {
      expect(inject(page('<div>Hello</div>')).imports).toEqual(['gt-react']);
    });

    it('imports from gt-react/browser for the legacy import source', () => {
      expect(inject(page('<div>Hello</div>'), true).imports).toEqual([
        'gt-react/browser',
      ]);
    });

    it('does not import the internal components twice', () => {
      const { imports } = inject(`
        import { GtInternalTranslateJsx, GtInternalVar } from "gt-react/browser";
        export default function Page() { return <div>Hello</div>; }
      `);

      expect(imports).toEqual(['gt-react/browser']);
    });
  });
});

describe('injection and extraction', () => {
  const plural = { b: { one: 'item', other: 'items' }, t: 'p' };

  // [description, code, sources of the extracted updates]
  it.each<[string, string, unknown[]]>([
    // Pass 1 and pass 2 together
    ['a user T', page('<T>Hello World</T>'), ['Hello World']],
    [
      'a user T next to injected content',
      page('<div><T>User translated</T><span>Auto translate me</span></div>'),
      ['User translated', 'Auto translate me'],
    ],
    [
      'the same content from both passes once',
      page('<div><T>Hello</T><span>Hello</span></div>'),
      ['Hello'],
    ],
    [
      'a user T around a fragment once',
      page('<T><>Hello There</></T>'),
      [{ t: 'C1', i: 1, c: 'Hello There' }],
    ],
    ['a file without GT imports', page('<h1>Welcome</h1>'), ['Welcome']],
    [
      'a file that imports T without using it',
      'import { T } from "gt-next";\nexport default function Page() { return <h1>Welcome</h1>; }',
      ['Welcome'],
    ],

    // Where the injected T goes
    [
      'deeply nested text',
      page(
        '<main><section><article><p>Very deep text</p></article></section></main>'
      ),
      ['Very deep text'],
    ],
    [
      'deeply nested text with a dynamic expression',
      page(
        '<main><section><article><p>Hello {name}</p></article></section></main>'
      ),
      [['Hello ', variable(1)]],
    ],
    [
      'text with a nested element as one update',
      page('<div>Hello <b>World</b> today</div>'),
      [['Hello ', { t: 'b', i: 1, c: 'World' }, ' today']],
    ],
    [
      'sibling elements separately',
      page('<div><span>First</span><p><em>Second</em></p></div>'),
      ['First', 'Second'],
    ],
    [
      'each component of a file',
      `function Header() { return <h1>Welcome</h1>; }
       function Footer() { return <p>Copyright {year}</p>; }`,
      ['Welcome', ['Copyright ', variable(1)]],
    ],
    ['unicode text', page('<div>こんにちは世界</div>'), ['こんにちは世界']],
    ['nothing from an expression only', page('<div>{userName}</div>'), []],
    [
      'nothing from expressions separated by whitespace',
      page('<div>{firstName} {lastName}</div>'),
      [],
    ],
    ['nothing from a self-closing element', page('<input />'), []],
    ['nothing from an empty element', page('<div></div>'), []],
    ['a fragment', page('<>Hello World</>'), ['Hello World']],
    [
      'a fragment with dynamic content',
      page('<>Welcome {name}!</>'),
      [['Welcome ', variable(1), '!']],
    ],
    [
      'a fragment with a nested element',
      page('<>Hello <b>World</b></>'),
      [['Hello ', { t: 'b', i: 1, c: 'World' }]],
    ],

    // Injected Var
    [
      'a member expression as a variable',
      page('<div>Price: {obj.price}</div>'),
      [['Price: ', variable(1)]],
    ],
    [
      'several dynamic expressions as variables',
      page('<div>Hello {first}, welcome to {city}!</div>'),
      [['Hello ', variable(1), ', welcome to ', variable(2), '!']],
    ],
    [
      'dynamic expressions in nested elements as variables',
      page('<div>Hello <span>{first}</span> and <em>{last}</em></div>'),
      [
        [
          'Hello ',
          { t: 'span', i: 1, c: variable(2) },
          ' and ',
          { t: 'em', i: 3, c: variable(4) },
        ],
      ],
    ],

    // User variable components
    [
      'a user Var',
      page('<div>Hello <Var>{name}</Var></div>'),
      [['Hello ', variable(1)]],
    ],
    [
      'a user Num',
      page('<div>Price: <Num>{price}</Num></div>'),
      [['Price: ', { i: 1, k: '_gt_n_1', v: 'n' }]],
    ],
    [
      'a user RelativeTime',
      page('<div>Updated: <RelativeTime>{date}</RelativeTime></div>'),
      [['Updated: ', { i: 1, k: '_gt_time_1', v: 'rt' }]],
    ],
    [
      'a user Currency and DateTime',
      page(
        '<div>Paid <Currency>{amount}</Currency> on <DateTime>{date}</DateTime></div>'
      ),
      [
        [
          'Paid ',
          { i: 1, k: '_gt_cost_1', v: 'c' },
          ' on ',
          { i: 2, k: '_gt_date_2', v: 'd' },
        ],
      ],
    ],
    [
      'nothing from a JSX ternary inside a user Var',
      page('<div>Hello <Var>{flag ? <p>A</p> : <p>B</p>}</Var></div>'),
      [['Hello ', variable(1)]],
    ],
    [
      'nothing from a map inside a user Var',
      page('<div>Items: <Var>{items.map(i => <li>{i}</li>)}</Var></div>'),
      [['Items: ', variable(1)]],
    ],
    [
      'the sibling of a user Var that contains JSX',
      page('<div><Var>{<p>Opaque</p>}</Var><span>Auto {x}</span></div>'),
      [['Auto ', variable(1)]],
    ],

    // JSX in props and in dynamic expressions
    [
      'a JSX prop',
      page('<Card header={<h1>Title</h1>}>Body text</Card>'),
      ['Title', 'Body text'],
    ],
    [
      'several JSX props',
      page(
        '<Layout header={<h1>Header</h1>} footer={<p>Footer</p>}>Main</Layout>'
      ),
      ['Header', 'Footer', 'Main'],
    ],
    [
      'a JSX prop with dynamic content',
      page('<Card header={<h1>Title {count}</h1>}>Body</Card>'),
      [['Title ', variable(1)], 'Body'],
    ],
    [
      'the branches of a JSX ternary next to text',
      page(
        '<div>Status: {isActive ? <span>Active</span> : <span>Inactive</span>}</div>'
      ),
      [['Status: ', variable(1)], 'Active', 'Inactive'],
    ],
    [
      'the branches of a JSX ternary without text',
      page('<div>{flag ? <p>Yes</p> : <p>No</p>}</div>'),
      ['Yes', 'No'],
    ],
    [
      'JSX behind a logical AND',
      page('<div>Hello {show && <span>Content</span>}</div>'),
      [['Hello ', variable(1)], 'Content'],
    ],

    // Branch and Plural
    [
      'a Branch with JSX props',
      page(
        '<div><Branch branch="test" a={<span>A</span>} b={<span>B</span>}>Fallback</Branch></div>'
      ),
      [
        {
          t: 'Branch',
          i: 1,
          d: {
            b: {
              a: { t: 'span', i: 2, c: 'A' },
              b: { t: 'span', i: 2, c: 'B' },
            },
            t: 'b',
          },
          c: 'Fallback',
        },
      ],
    ],
    [
      'a Plural with string forms',
      page('<div><Plural n={count} one="item" other="items" /></div>'),
      [{ t: 'Plural', i: 1, d: plural }],
    ],
    [
      'dynamic content in Branch children',
      page(
        '<>Hello, my good friend <Branch branch={userName}>Fallback with Var {userName}</Branch></>'
      ),
      [
        [
          'Hello, my good friend ',
          { t: 'Branch', i: 1, c: ['Fallback with Var ', variable(2)] },
        ],
      ],
    ],
    [
      'dynamic content in Plural children',
      page('<div><Plural n={count}>You have {count} items</Plural></div>'),
      [{ t: 'Plural', i: 1, c: ['You have ', variable(2), ' items'] }],
    ],
    [
      'dynamic content in a JSX Branch prop',
      page(
        '<div><Branch branch="mode" Ernest={<>Hello {userName}</>}>Fallback</Branch></div>'
      ),
      [
        {
          t: 'Branch',
          i: 1,
          d: {
            b: { Ernest: { t: 'C2', i: 2, c: ['Hello ', variable(3)] } },
            t: 'b',
          },
          c: 'Fallback',
        },
      ],
    ],
    [
      'the branches of a JSX ternary in a Branch prop',
      page(
        '<div><Branch branch="mode" summary={flag ? <p>Option A</p> : <p>Option B</p>}>Fallback</Branch></div>'
      ),
      [
        {
          t: 'Branch',
          i: 1,
          d: { b: { summary: variable(2) }, t: 'b' },
          c: 'Fallback',
        },
        'Option A',
        'Option B',
      ],
    ],
    [
      'the branches of a JSX ternary in a Plural form',
      page(
        '<div><Plural n={n} one={flag ? <b>single</b> : <b>solo</b>} other="many" /></div>'
      ),
      [
        {
          t: 'Plural',
          i: 1,
          d: { b: { one: variable(2), other: 'many' }, t: 'p' },
        },
        'single',
        'solo',
      ],
    ],
    // Branch/Plural children share the id counter with the following siblings
    [
      'an element after Branch children with the next id',
      page(
        '<div><Branch branch={status} draft={<span>Draft</span>}><span>Unknown</span></Branch><span>Last saved {lastSaved}</span></div>'
      ),
      [
        [
          {
            t: 'Branch',
            i: 1,
            d: { b: { draft: { t: 'span', i: 2, c: 'Draft' } }, t: 'b' },
            c: { t: 'span', i: 2, c: 'Unknown' },
          },
          { t: 'span', i: 3, c: ['Last saved ', variable(4)] },
        ],
      ],
    ],
    [
      'an element after Plural children with the next id',
      page(
        '<div><Plural n={count} one={<span>one</span>}><span>other</span></Plural><span>Total: {total}</span></div>'
      ),
      [
        [
          {
            t: 'Plural',
            i: 1,
            d: { b: { one: { t: 'span', i: 2, c: 'one' } }, t: 'p' },
            c: { t: 'span', i: 2, c: 'other' },
          },
          { t: 'span', i: 3, c: ['Total: ', variable(4)] },
        ],
      ],
    ],
    [
      'a root-level Plural',
      page('<Plural n={n} one={<><strong>one</strong></>}><>other</></Plural>'),
      [
        {
          t: 'Plural',
          i: 1,
          d: {
            b: { one: { t: 'C2', i: 2, c: { t: 'strong', i: 3, c: 'one' } } },
            t: 'p',
          },
          c: { t: 'C2', i: 2, c: 'other' },
        },
      ],
    ],

    // Derive: the T injected into a derived function's JSX is not part of
    // the Derive content (the runtime removes it), an injected Var is.
    [
      'a root-level Derive',
      page('<Derive><>other some other examples</></Derive>'),
      [
        {
          t: 'Derive',
          i: 1,
          c: { t: 'C2', i: 2, c: 'other some other examples' },
        },
        'other some other examples',
      ],
    ],
    [
      'a Derive of a function returning an element',
      page('<div><Derive>{getName()}</Derive></div>', {
        outer: 'function getName() { return <div>John</div>; }',
      }),
      ['John', { t: 'Derive', i: 1, c: { t: 'div', i: 2, c: 'John' } }],
    ],
    [
      'a Derive of a function returning a fragment',
      page('<>Here is the user name: <Derive>{getUserName()}</Derive></>', {
        outer:
          'function getUserName() { return <>User name is <b>Brian</b></>; }',
      }),
      [
        ['User name is ', { t: 'b', i: 1, c: 'Brian' }],
        [
          'Here is the user name: ',
          {
            t: 'Derive',
            i: 1,
            c: {
              t: 'C2',
              i: 2,
              c: ['User name is ', { t: 'b', i: 3, c: 'Brian' }],
            },
          },
        ],
      ],
    ],
    [
      'a Derive of a function returning dynamic JSX',
      page('<div><Derive>{getGreeting("World")}</Derive></div>', {
        outer:
          'function getGreeting(name: string) { return <span>Hello {name}</span>; }',
      }),
      [
        ['Hello ', variable(1)],
        {
          t: 'Derive',
          i: 1,
          c: { t: 'span', i: 2, c: ['Hello ', variable(3)] },
        },
      ],
    ],
    [
      'a Derive of a function with several returns',
      page('<div>Status: <Derive>{getStatus(ok)}</Derive></div>', {
        outer:
          "function getStatus(ok) { if (ok) return 'Success'; return 'Error'; }",
      }),
      [
        ['Status: ', { t: 'Derive', i: 1, c: 'Success' }],
        ['Status: ', { t: 'Derive', i: 1, c: 'Error' }],
      ],
    ],
    [
      'the cross product of two Derives',
      page(
        '<div>The <Derive>{getSubject()}</Derive> has the <Derive>{getObject()}</Derive></div>',
        {
          outer: `function getSubject() { return gender === 'male' ? 'boy' : 'girl'; }
                  function getObject() { return toy === 'ball' ? 'ball' : 'crayon'; }`,
        }
      ),
      ['boy', 'girl'].flatMap((subject) =>
        ['ball', 'crayon'].map((object) => [
          'The ',
          { t: 'Derive', i: 1, c: subject },
          ' has the ',
          { t: 'Derive', i: 2, c: object },
        ])
      ),
    ],
    [
      'a Derive next to a dynamic expression',
      page('<div>Hello <Derive>{getX()}</Derive> and {z}</div>'),
      [['Hello ', { t: 'Derive', i: 1 }, ' and ', variable(2)]],
    ],
    [
      'a Branch inside a Derive, also on its own',
      page(
        '<div>Hello <Derive><Branch branch="x">fallback</Branch></Derive></div>'
      ),
      [
        [
          'Hello ',
          { t: 'Derive', i: 1, c: { t: 'Branch', i: 2, c: 'fallback' } },
        ],
        { t: 'Branch', i: 1, c: 'fallback' },
      ],
    ],
    [
      'a Plural inside a Derive, also on its own',
      page(
        '<div>Hello <Derive><Plural n={n} one="item" other="items" /></Derive></div>'
      ),
      [
        ['Hello ', { t: 'Derive', i: 1, c: { t: 'Plural', i: 2, d: plural } }],
        { t: 'Plural', i: 1, d: plural },
      ],
    ],
  ])('extracts %s', (_name, code, expected) => {
    const result = extractWithAutoInjection(code);

    expect(result.errors).toEqual([]);
    expect(sources(result)).toEqual(expected);
  });

  // The point of auto injection: the same hash as hand-written components
  it.each([
    ['text', '<T>Hello World</T>', '<div>Hello World</div>'],
    ['a Var', '<T>Hello <Var>{name}</Var>!</T>', '<div>Hello {name}!</div>'],
    [
      'several Vars',
      '<T>Hello <Var>{first}</Var>, welcome to <Var>{city}</Var>!</T>',
      '<div>Hello {first}, welcome to {city}!</div>',
    ],
    [
      'a nested element',
      '<T>Hello <b>World</b></T>',
      '<div>Hello <b>World</b></div>',
    ],
    [
      'a Num',
      '<T>Price: <Num>{price}</Num></T>',
      '<div>Price: <Num>{price}</Num></div>',
    ],
    [
      'a Derive',
      '<T>Label: <Derive>{getUserName()}</Derive></T>',
      '<main>Label: <Derive>{getUserName()}</Derive></main>',
    ],
  ])('matches a hand-written <T> with %s', (_name, manualJsx, autoJsx) => {
    const outer = 'function getUserName() { return "Brian"; }';
    const manual = extractUserT(page(manualJsx, { outer }));
    const auto = extractWithAutoInjection(page(autoJsx, { outer }));

    expect(manual.updates).toHaveLength(1);
    expect(sources(auto)).toEqual(sources(manual));
  });

  it('extracts only the user T when auto injection is off', () => {
    const result = extractUserT(
      page('<div><T>Manual</T><span>Should not be extracted</span></div>')
    );

    expect(sources(result)).toEqual(['Manual']);
  });

  it('does not inject Var into a user T with dynamic children', () => {
    const result = extractWithAutoInjection(page('<T>Hello {name}</T>'));

    expect(result.errors).toEqual([expect.stringContaining(DYNAMIC_CHILDREN)]);
    expect(result.updates).toEqual([]);
  });

  it('reports the same errors for a user T as without auto injection', () => {
    const code = page('<T>Hello <span>{name}</span></T>');
    const withInjection = extractWithAutoInjection(code);

    expect(withInjection.errors).toEqual([
      expect.stringContaining(DYNAMIC_CHILDREN),
    ]);
    expect(withInjection.errors).toEqual(extractUserT(code).errors);
  });

  // Baselines without auto injection, for the cases above
  it.each<[string, string, unknown[]]>([
    [
      'does not translate JSX inside a user Var',
      page(
        '<T>Status: <Var>{isActive ? <span>Active</span> : <span>Inactive</span>}</Var></T>'
      ),
      [['Status: ', variable(1)]],
    ],
    [
      'keeps a fragment child as an element',
      page('<T><>Hello <b>World</b></></T>'),
      [{ t: 'C1', i: 1, c: ['Hello ', { t: 'b', i: 2, c: 'World' }] }],
    ],
    [
      'inlines the fragment returned by a derived function',
      page('<T>Label: <Derive>{getUserName()}</Derive></T>', {
        outer:
          'function getUserName() { return <>User name is <b>Brian</b></>; }',
      }),
      [
        [
          'Label: ',
          {
            t: 'Derive',
            i: 1,
            c: {
              t: 'C2',
              i: 2,
              c: ['User name is ', { t: 'b', i: 3, c: 'Brian' }],
            },
          },
        ],
      ],
    ],
  ])('a user T %s', (_name, code, expected) => {
    const result = extractUserT(code);

    expect(result.errors).toEqual([]);
    expect(sources(result)).toEqual(expected);
  });

  it('treats T and Var from another library as regular elements', () => {
    const result = extractWithAutoInjection(`
      import { T, Var } from 'some-other-library';
      export default function Page() {
        const userName = "Ernest";
        return <T>Hello, <div>World</div> <Var>{userName}</Var>!</T>;
      }
    `);

    expect(sources(result)).toEqual([
      [
        'Hello, ',
        { t: 'div', i: 1, c: 'World' },
        ' ',
        { t: 'Var', i: 2, c: variable(3) },
        '!',
      ],
    ]);
  });

  it('finds the T injected into a Branch prop ternary without re-parsing', () => {
    const ast = parseCode(
      page(
        '<div><Branch branch="mode" summary={flag ? <p>Option A</p> : <p>Option B</p>}>Fallback</Branch></div>'
      )
    );
    const { importAliases } = collectAliases(ast);
    ensureTAndVarImported(ast, importAliases);
    autoInsertJsxComponents(ast, importAliases);
    traverse(ast, {
      Program(programPath) {
        programPath.scope.crawl();
      },
    });

    const injected = getPathsAndAliases(ast, [
      Libraries.GT_NEXT,
      Libraries.GT_REACT,
    ]).translationComponentPaths.filter(
      ({ originalName }) => originalName === INTERNAL_TRANSLATION_COMPONENT
    );
    const references = injected.flatMap(({ path, localName }) =>
      path.scope.bindings[localName].referencePaths.filter((reference) =>
        t.isJSXOpeningElement(reference.parent)
      )
    );

    expect(references).toHaveLength(3);
  });

  describe('Derive across files', () => {
    const derive = (c: unknown) => ['Label: ', { t: 'Derive', i: 1, c }];

    // [description, call, function, Derive contents, updates from the function's own JSX]
    it.each<[string, string, string, unknown[], unknown[]]>([
      [
        'a string',
        'getName()',
        'function getName() { return "John"; }',
        ['John'],
        [],
      ],
      [
        'static JSX',
        'getLabel()',
        'function getLabel() { return <span>Dashboard</span>; }',
        [{ t: 'span', i: 2, c: 'Dashboard' }],
        ['Dashboard'],
      ],
      [
        'dynamic JSX',
        'getGreeting("World")',
        'function getGreeting(name: string) { return <span>Hello {name}</span>; }',
        [{ t: 'span', i: 2, c: ['Hello ', variable(3)] }],
        [['Hello ', variable(1)]],
      ],
      [
        'JSX from several returns',
        'getStatus()',
        `function getStatus() {
           if (Math.random() > 0.5) { return <em>Active</em>; }
           return <em>Inactive</em>;
         }`,
        [
          { t: 'em', i: 2, c: 'Active' },
          { t: 'em', i: 2, c: 'Inactive' },
        ],
        ['Active', 'Inactive'],
      ],
    ])(
      'resolves a function returning %s like in the same file',
      (_name, call, fn, contents, ownUpdates) => {
        const jsx = `<div>Label: <Derive>{${call}}</Derive></div>`;
        const fnName = call.slice(0, call.indexOf('('));
        const root = mockFiles({ 'libs/utils.tsx': `export ${fn}` });

        const crossFile = extractWithAutoInjection(
          page(jsx, { outer: `import { ${fnName} } from "./libs/utils";` }),
          `${root}/page.tsx`
        );
        const sameFile = extractWithAutoInjection(page(jsx, { outer: fn }));

        expect(crossFile.errors).toEqual([]);
        expect(sources(crossFile)).toEqual(contents.map(derive));
        // In the same file the function's own JSX is translatable as well
        expect(sources(sameFile)).toEqual([
          ...ownUpdates,
          ...contents.map(derive),
        ]);
      }
    );
  });
});
