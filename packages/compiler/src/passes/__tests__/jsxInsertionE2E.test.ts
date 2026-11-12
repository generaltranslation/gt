/**
 * End-to-end: JSX insertion -> collection -> injection.
 *
 * Auto-inserted _T/_Var structures must survive the collection pass. A bare
 * identifier left inside an inserted _T would be reported as "dynamic
 * content in T", which breaks the build (or soft-locks the file when
 * disableBuildChecks is set).
 */
import { describe, it, expect } from 'vitest';
import { runPasses } from './testHelpers';

function fullPipeline(code: string) {
  return runPasses(code, ['jsxInsertion', 'collection', 'injection'], {
    enableAutoJsxInjection: true,
  });
}

const REACT = `import { jsx, jsxs } from 'react/jsx-runtime';\nimport { Fragment } from 'react';\n`;
// Vite production builds import only jsxs when a file has no single-child
// element, but every inserted _Var is a jsx() call.
const REACT_JSXS_ONLY = `import { jsxs } from 'react/jsx-runtime';\n`;
const GT = `import { Branch, Plural, Derive } from 'gt-react';\n`;

describe('JSX insertion -> collection E2E', () => {
  it.each([
    [
      '<div>Hello {name}</div>',
      `${REACT}jsxs("div", { children: ["Hello ", name] });`,
    ],
    [
      '<div>Hello {firstName}, welcome to {city}!</div>',
      `${REACT}jsxs("div", { children: ["Hello ", firstName, ", welcome to ", city, "!"] });`,
    ],
    [
      '<div><Branch branch={x}>Fallback {name}</Branch></div>',
      `${REACT}${GT}jsx("div", { children: jsxs(Branch, { branch: x, children: ["Fallback ", name] }) });`,
    ],
    [
      '<div><Plural n={count}>You have {count} items</Plural></div>',
      `${REACT}${GT}jsx("div", { children: jsxs(Plural, { n: count, children: ["You have ", count, " items"] }) });`,
    ],
    [
      '<div>Status: {isActive ? <span>Active</span> : <span>Inactive</span>}</div>',
      `${REACT}jsxs("div", { children: ["Status: ", isActive ? jsx("span", { children: "Active" }) : jsx("span", { children: "Inactive" })] });`,
    ],
    [
      '<div>Hello <Derive>{getX()}</Derive> and {z}</div>',
      `${REACT}${GT}jsxs("div", { children: ["Hello ", jsx(Derive, { children: getX() }), " and ", z] });`,
    ],
    [
      '<Card header={<h1>Title {count}</h1>}>Body</Card>',
      `${REACT}jsx(Card, { header: jsxs("h1", { children: ["Title ", count] }), children: "Body" });`,
    ],
    [
      '<div>Hello {name}</div> in a jsxs-only file',
      `${REACT_JSXS_ONLY}jsxs("div", { children: ["Hello ", name] });`,
    ],
    [
      '<div>Label: <Branch branch={x}>Fallback {name}</Branch></div> in a jsxs-only file',
      `${REACT_JSXS_ONLY}${GT}jsxs("div", { children: ["Label: ", jsxs(Branch, { branch: x, children: ["Fallback ", name] })] });`,
    ],
  ])('%s is collected without errors', (_jsx, code) => {
    const { errors, state } = fullPipeline(code);
    expect(errors).toEqual([]);
    expect(state.stringCollector.hasContent()).toBe(true);
  });

  it('represents Derive as an element in jsxChildren, not a variable', () => {
    // <div>Hello <Derive>{getX()}</Derive></div>
    const { errors, manifest } = fullPipeline(
      `${REACT}${GT}jsxs("div", { children: ["Hello ", jsx(Derive, { children: getX() })] });`
    );
    expect(errors).toEqual([]);
    expect(manifest).toEqual({ '': ['Hello ', { t: 'Derive', i: 1 }] });
  });

  // Branch/Plural prop values and children are separate branches: both start
  // counting from the branching element's id rather than sharing a counter.
  it.each([
    [
      '<Plural n={n} one={<><strong>one</strong></>}><>other</></Plural>',
      `jsx(Plural, {
        n: n,
        one: jsx(Fragment, { children: jsx("strong", { children: "one" }) }),
        children: jsx(Fragment, { children: "other" })
      });`,
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
    [
      '<Branch branch="x" a={<span>Option A</span>}><>Default</></Branch>',
      `jsx(Branch, {
        branch: "x",
        a: jsx("span", { children: "Option A" }),
        children: jsx(Fragment, { children: "Default" })
      });`,
      {
        t: 'Branch',
        i: 1,
        d: { b: { a: { t: 'span', i: 2, c: 'Option A' } }, t: 'b' },
        c: { t: 'C2', i: 2, c: 'Default' },
      },
    ],
  ])('numbers the branches of %s independently', (_jsx, code, children) => {
    const { errors, manifest } = fullPipeline(`${REACT}${GT}${code}`);
    expect(errors).toEqual([]);
    expect(Object.values(manifest)).toEqual([children]);
  });
});
