import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import type { ESTree } from '../../src/compiler/analysis/ast.js';
import {
  resolveVariables,
  resolveVariablesWithScopeManager,
} from '../../src/compiler/analysis/program-index.js';
import { parseModuleCode } from '../../src/compiler/utils/parse.js';
import { differences } from '../helpers/resolutions.js';

/** Both resolve the same program, parsed once: they must agree on every identifier. */
function resolutionDifferences(file: string, code: string): string[] {
  const lang = file.endsWith('x') ? 'tsx' : 'ts';
  const { program } = parseModuleCode(file, code, lang);

  return differences(
    program as ESTree.Program,
    resolveVariablesWithScopeManager(program as ESTree.Program),
    resolveVariables(program as ESTree.Program)
  );
}

const CASES: Record<string, string> = {
  imports: `
    import def, { a, b as c, type T } from "./a";
    import * as ns from "./b";
    import type { U } from "./c";
    import json from "./d.json" with { type: "json" };
    import fs = require("fs");
    import Inner = ns.Outer.Inner;
    def(a, c, ns.x, json, fs, Inner);
    let t: T; let u: U;
  `,
  exports: `
    const a = 1, b = 2; type T = string; interface I {}
    export { a, b as c, type T };
    export type { I };
    export default a;
    export * from "./x";
    export { y } from "./y";
    export const d = a + b;
    export function f() { return d; }
  `,
  exportAssignment: `const value = 1; export = value;`,
  hoisting: `
    f(); g;
    function f() { var g = 1; if (g) { var h = 2; let i = 3; } return h; }
    var g = 2;
    { function blockFn() {} let x = 1; { const x = 2; x; } x; }
  `,
  parameters: `
    function f(a, b = a, c = d, { e = b, ...rest } = {}, [first, , ...others] = []) {
      var d = 1; return [a, b, c, d, e, rest, first, others, arguments];
    }
    const g = (x = y, y = 1) => x + y;
    const h = function named(n = named) { return named(n); };
  `,
  classes: `
    function decorate(...args: any[]) { return (x: any) => x; }
    @decorate() class A<T> extends Base<T> implements I {
      static count = A.count + 1;
      #secret = 1;
      [key] = 2;
      field = this.#secret;
      accessor acc = 3;
      static { const inside = A; inside; }
      constructor(private readonly p: P, @decorate() q = p) { super(); }
      method<M>(m: M = this.field as any) { return A; }
      get g() { return 1; }
      @decorate() set s(v) {}
    }
    const B = class Named { m() { return Named; } };
    abstract class C { abstract m(): void; abstract f: number; }
    let key = "k"; class Base<T> {} interface I {} type P = {};
  `,
  loops: `
    for (let i = 0; i < 3; i++) { i; }
    for (var j = 0; j < 3; j++) {}
    for (const k in obj) k;
    for (const [a, { b = a }] of list) b;
    for (existing of list) existing;
    for ({ x: existing, y = existing } of list);
    label: for (;;) { break label; continue label; }
    switch (j) { case 1: let s = 1; s; break; default: j; }
    try { throw 1; } catch ({ message = j }) { message; } finally { j; }
    let obj = {}, list = [], existing;
  `,
  assignments: `
    let a, b, c, o = {};
    a = 1; b += a; c++; --a;
    [a, b = c] = [b, a];
    ({ a, b: [c] = [], ...o } = o);
    (a as any) = 2; (<any>b) = 3; c! = 4; o.x = a; o[b] = c;
    a ||= b; b &&= c; c ??= a;
  `,
  jsx: `
    import { Label, ns } from "./ui";
    const _private = 1; const $dollar = 2;
    const el = <div onClick={() => Label}>
      <Label text={el} {...ns} />
      <ns.Item />
      <svg:rect />
      <_private></_private>
      <$dollar />
      <>{Label}</>
    </div>;
    class Self { render() { return <this.Thing />; } }
  `,
  types: `
    type Box<T> = { value: T; fn: (arg: T) => T; new (x: T): Box<T> };
    interface Tree<T> extends Box<T>, Other { left?: Tree<T>; [key: string]: unknown; method<U>(u: U): T }
    type Unwrap<T> = T extends Promise<infer U> ? U : T extends (x: infer V) => infer W ? V | W : never;
    type Keys<T> = { [K in keyof T as \`get\${string & K}\`]: () => T[K] };
    type Q = typeof value; type R = typeof ns.deep.value; type I = import("./x").Y<Q>;
    function isString(x: unknown): x is string { return typeof x === "string"; }
    function asserts(x: unknown): asserts x is number {}
    const value = { a: 1 } as const satisfies object;
    const tuple: [first: string, second?: Q] = ["a"];
    let ns: any; interface Other {}
  `,
  enumsAndNamespaces: `
    enum Color { Red, 'Green' = 2, Blue = Red + Green }
    const enum E { A = 1, B = A * 2 }
    namespace Outer.Inner { export const deep = Color.Red; }
    namespace Merged { export const x = 1; }
    function Merged() { return Merged.x; }
    declare global { interface Window { app: unknown } }
    declare module "virtual" { export const v: number; }
    Color.Blue; E.B; Outer.Inner.deep;
  `,
  overloadsAndGenerics: `
    function over(a: string): string;
    function over(a: number): number;
    function over(a: any) { return a; }
    const made = new Map<string, number>();
    const call = over<string>("x");
    const instance = over<string>;
    const tagged = tag<number>\`text \${call}\`;
    declare function tag<T>(strings: TemplateStringsArray, ...values: unknown[]): T;
  `,
  sameNames: `
    type Message = string;
    function Message() { return "m"; }
    interface Thing { a: number }
    class Thing {}
    const Value = 1; type Value = number;
    Message(); new Thing(); Value;
  `,
  unresolved: `globalThis.x = undefined; window.y; require("z"); process.env.A; arguments;`,
  metaAndPrivate: `
    import.meta.url; new.target;
    class P { #x = 1; has(o) { return #x in o; } }
  `,
};

describe('resolves names as the scope manager does', () => {
  for (const [name, code] of Object.entries(CASES)) {
    test(name, () => {
      expect(resolutionDifferences(`/app/${name}.tsx`, code)).toEqual([]);
    });
  }

  test("this package's own sources", () => {
    const root = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../src'
    );
    const files = fs
      .readdirSync(root, { recursive: true, encoding: 'utf8' })
      .filter((file) => file.endsWith('.ts'))
      .map((file) => path.join(root, file));
    expect(files.length).toBeGreaterThan(50);

    for (const file of files) {
      const code = fs.readFileSync(file, 'utf8');
      expect(resolutionDifferences(file, code), file).toEqual([]);
    }
  });
});
