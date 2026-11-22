import { describe, expect, test } from 'vitest';
import {
  analogLanguage,
  angularComponentLanguage,
  angularTemplateLanguage,
} from '../../src/compiler/languages/angular.js';
import { parseSync } from 'oxc-parser';
import { defaultLanguages } from '../../src/compiler/languages/index.js';
import {
  NO_PACKAGES,
  parseSource,
} from '../../src/compiler/languages/language.js';
import {
  analyzeProject,
  describeUsages,
  REPO_PACKAGES,
} from '../helpers/project.js';

const languages = [
  ...defaultLanguages,
  angularComponentLanguage,
  angularTemplateLanguage,
  analogLanguage,
];

type Usages = Awaited<ReturnType<typeof analyzeProject>>;

function analyze(
  entry: string,
  files: Record<string, string>
): Promise<Usages> {
  return analyzeProject(files, { entry, languages });
}

const lines = (...code: string[]) => code.join('\n');

describe('inline templates', () => {
  const file = '/app/src/app/header.component.ts';

  test('component fields: the import itself, a renamed field and a message reference', async () => {
    const usages = await analyze(file, {
      [file]: lines(
        `import { Component } from "@angular/core";`,
        `import { m } from "../paraglide/messages.js";`,
        ``,
        `@Component({`,
        `  selector: "app-header",`,
        `  template: \``,
        `    <h1 [title]="m.title()">{{ m.heading() }}</h1>`,
        `    <p>{{ msgs.renamed() }} {{ greeting() }}</p>`,
        `    <button (click)="count = count + 1; msgs.clicked()">+</button>`,
        `  \`,`,
        `})`,
        `export class HeaderComponent {`,
        `  protected readonly m = m;`,
        `  msgs = m;`,
        `  greeting = m.greeting;`,
        `  count = <number>0;`,
        `  static ignored = m;`,
        `}`
      ),
    });
    // In source order.
    expect(describeUsages(usages)).toEqual([
      'message:title:call 7 <h1 [title]>',
      'message:heading:call 7 <h1>',
      'message:renamed:call 8 <p>',
      'message:greeting:call 8 <p>',
      'message:clicked:call 9 <button (click)>',
      'message:greeting:reference 15',
    ]);
    expect(usages[1]).toMatchObject({
      expression: 'm.heading()',
      column: 32,
      scope: 'header',
    });
  });

  test('several components in a file: each template reads the fields of its own class', async () => {
    const usages = await analyze(file, {
      [file]: lines(
        `import { Component } from "@angular/core";`,
        `import { m } from "../paraglide/messages.js";`,
        `@Component({ selector: "app-first", template: "<p>{{ label() }}</p>" })`,
        `export class First { label = m.first; }`,
        `@Component({ selector: "app-second", template: "<b>{{ label() }} {{ own() }}</b>" })`,
        `export class Second { label = m.second; own = m.own; }`,
        `@Component({ selector: "app-third", template: "<i>{{ own() }}</i>" })`,
        `export class Third {}`
      ),
    });
    expect(
      describeUsages(usages).filter((usage) => usage.includes(':call'))
    ).toEqual([
      'message:first:call 3 <p>',
      'message:second:call 5 <b>',
      'message:own:call 5 <b>',
    ]);
  });

  test('a field that is not Paraglide is not tracked', async () => {
    const usages = await analyze(file, {
      [file]: lines(
        `import { Component } from "@angular/core";`,
        `@Component({ selector: "x", template: '<p>{{ m.greeting() }}</p>' })`,
        `export class X { m = { greeting: () => "hi" }; }`
      ),
    });
    expect(usages).toEqual([]);
  });

  test('generic arrows and <T> casts still parse', async () => {
    const usages = await analyze(file, {
      [file]: lines(
        `import { Component } from "@angular/core";`,
        `import { m } from "../paraglide/messages.js";`,
        `const id = <T,>(value: T) => value;`,
        `const text = <string>m.cast();`,
        `@Component({ selector: "x", template: "<p>{{ m.inline() }}</p>" })`,
        `export class X { m = m; }`
      ),
    });
    expect(describeUsages(usages)).toEqual([
      'message:cast:call 4',
      'message:inline:call 5 <p>',
    ]);
  });
});

describe('templateUrl', () => {
  test('a .html template uses the fields of its component', async () => {
    const template = '/app/src/app/user.component.html';
    const usages = await analyze(template, {
      '/app/src/app/user.component.ts': lines(
        `import { Component } from "@angular/core";`,
        `import { m } from "../paraglide/messages.js";`,
        `import { getLocale } from "../paraglide/runtime.js";`,
        `@Component({ selector: "app-user", templateUrl: "./user.component.html" })`,
        `export class UserComponent {`,
        `  readonly m = m;`,
        `  locale = getLocale;`,
        `}`
      ),
      [template]: lines(
        `<section>`,
        `  <h2>{{ m.user_title() }}</h2>`,
        `  <span title="Hi {{ m.hi() }}!">{{ locale() }}</span>`,
        `</section>`
      ),
    });
    expect(describeUsages(usages)).toEqual([
      'message:user_title:call 2 <h2>',
      'message:hi:call 3 <span title>',
      'runtime:getLocale:call 3 <span>',
    ]);
    expect(usages[0]).toMatchObject({
      column: 10,
      scope: 'user',
      // Through the component's field.
      resolution: ['src/app/user.component.ts', 'src/paraglide/messages.js'],
    });
  });

  test('Angular 20 file names: user.html and user.ts', async () => {
    const template = '/app/src/app/user.html';
    const usages = await analyze(template, {
      '/app/src/app/user.ts': lines(
        `import { Component } from "@angular/core";`,
        `import { m } from "../paraglide/messages.js";`,
        `@Component({ selector: "app-user", templateUrl: "./user.html" })`,
        `export class User { protected readonly m = m; }`
      ),
      [template]: `<p>{{ m.hello() }}</p>`,
    });
    expect(describeUsages(usages)).toEqual(['message:hello:call 1 <p>']);
  });
});

describe('template syntax', () => {
  const file = '/app/src/app/list.component.ts';
  const template = '/app/src/app/list.component.html';
  const component = lines(
    `import { Component } from "@angular/core";`,
    `import { m } from "../paraglide/messages.js";`,
    `@Component({ selector: "app-list", templateUrl: "./list.component.html" })`,
    `export class ListComponent { m = m; items = []; }`
  );
  const analyzeTemplate = (code: string) =>
    analyze(template, { [file]: component, [template]: code });

  test('pipes', async () => {
    const usages = await analyzeTemplate(
      lines(
        `<p>{{ m.price() | currency:m.currency():'symbol' }}</p>`,
        `<p [title]="a || m.or()">{{ (m.paren() | async) ?? m.fallback() }}</p>`,
        `@let label = m.label() | uppercase;`,
        `<p>{{ label }}</p>`
      )
    );
    expect(describeUsages(usages)).toEqual([
      'message:price:call 1 <p>',
      'message:currency:call 1 <p>',
      'message:or:call 2 <p [title]>',
      'message:paren:call 2 <p>',
      'message:fallback:call 2 <p>',
      'message:label:call 3',
    ]);
  });

  test('control flow blocks scope their names', async () => {
    const usages = await analyzeTemplate(
      lines(
        `@if (m.cond(); as m) {`,
        `  <p>{{ m.shadowed() }}</p>`,
        `} @else if (m.other()) {`,
        `  <p>{{ m.elseif() }}</p>`,
        `} @else {`,
        `  <p>{{ m.otherwise() }}</p>`,
        `}`,
        `@for (m of items; track m.id; let i = $index) {`,
        `  <li>{{ m.label }}</li>`,
        `} @empty {`,
        `  <li>{{ m.empty() }}</li>`,
        `}`,
        `@switch (m.mode()) {`,
        `  @case (m.caseValue()) { <span>{{ m.inCase() }}</span> }`,
        `  @default { <span>{{ m.inDefault() }}</span> }`,
        `}`,
        `@defer (on viewport; when m.ready()) { {{ m.deferred() }} } @placeholder { {{ m.placeholder() }} }`,
        `@let m = items;`,
        `{{ m.afterLet }}`,
        // Angular requires `&#64;` for a literal `@`.
        `<p>mail me at me&#64;if.com {{ m.text() }}</p>`
      )
    );
    expect(describeUsages(usages)).toEqual([
      'message:cond:call 1',
      'message:other:call 3',
      'message:elseif:call 4 <p>',
      'message:otherwise:call 6 <p>',
      'message:empty:call 11 <li>',
      'message:mode:call 13',
      'message:caseValue:call 14',
      'message:inCase:call 14 <span>',
      'message:inDefault:call 15 <span>',
      'message:ready:call 17',
      'message:deferred:call 17',
      'message:placeholder:call 17',
    ]);
  });

  test('structural directives and let- variables', async () => {
    const usages = await analyzeTemplate(
      lines(
        `<li *ngFor="let m of items; let i = index; trackBy: m.track" [title]="m.title">{{ m.label }}</li>`,
        `<li *ngFor="let item of items | slice:0:m.max(); index as m">{{ m + 1 }}</li>`,
        `<p *ngIf="m.loaded() as m; else loading">{{ m.name }}</p>`,
        `<ng-template #loading let-m><p>{{ m.label }}</p></ng-template>`,
        `<ng-template [ngTemplateOutlet]="tpl" let-row="m"><p>{{ m.outside() }}</p></ng-template>`,
        `<p>{{ m.after() }}</p>`
      )
    );
    expect(describeUsages(usages)).toEqual([
      'message:track:reference 1 <li *ngFor>',
      'message:max:call 2 <li *ngFor>',
      'message:loaded:call 3 <p *ngIf>',
      'message:outside:call 5 <p>',
      'message:after:call 6 <p>',
    ]);
  });

  test('ICU messages, comments and expressions that do not parse', async () => {
    const usages = await analyzeTemplate(
      lines(
        `<!-- {{ m.commented() }} -->`,
        `<span i18n>{count, plural, =0 {none} other {{{ m.icu() }}}}</span>`,
        `<p [title]="m.broken(">{{ m.ok() }}</p>`,
        `<input [(ngModel)]="value" bind-title="m.bound()" on-click="m.handler()" />`
      )
    );
    expect(describeUsages(usages)).toEqual([
      'message:icu:call 2 <span>',
      'message:ok:call 3 <p>',
      'message:bound:call 4 <input bind-title>',
      'message:handler:call 4 <input on-click>',
    ]);
  });
});

describe('Analog', () => {
  test('script bindings are visible to the template', async () => {
    const file = '/app/src/app/pages/index.page.ag';
    const usages = await analyze(file, {
      [file]: lines(
        `<script lang="ts">`,
        `  import { m } from "../../paraglide/messages.js";`,
        `  const title = m.title;`,
        `</script>`,
        ``,
        `<template>`,
        `  <h1>{{ title() }}</h1>`,
        `  @for (item of items; track item) { <p>{{ m.row({ item }) }}</p> }`,
        `</template>`,
        ``,
        `<style>h1 { color: red; }</style>`
      ),
    });
    // `const title = m.title` is an alias, not a usage.
    expect(describeUsages(usages)).toEqual([
      'message:title:call 7 <h1>',
      'message:row:call 8 <p>',
    ]);
    expect(usages[0]).toMatchObject({ column: 10, scope: 'index.page' });
  });
});

describe('plain HTML', () => {
  test('inline module scripts are analyzed; other markup is ignored', async () => {
    const file = '/app/index.html';
    const usages = await analyze(file, {
      [file]: lines(
        `<!doctype html>`,
        `<html>`,
        `<head>`,
        `  <script>window.m = { x() {} }; m.x();</script>`,
        `  <script type="module" src="/src/main.ts"></script>`,
        `  <style>body { margin: 0 } @media (x) { a { b: c } }</style>`,
        `</head>`,
        `<body onload="m.notAngular()">`,
        `  <p>Price: {5} } stray brace, a < b, contact@example.com</p>`,
        `  <script type="module">`,
        `    import { m } from "./src/paraglide/messages.js";`,
        `    document.title = m.title();`,
        `  </script>`,
        `</body>`,
        `</html>`
      ),
    });
    expect(describeUsages(usages)).toEqual(['message:title:call 12']);
  });

  test('each module script is a module of its own', async () => {
    const file = '/app/index.html';
    const usages = await analyze(file, {
      [file]: lines(
        `<!doctype html>`,
        `<script type="module">`,
        `  import { m } from "./src/paraglide/messages.js";`,
        `  const label = m.first;`,
        `  document.title = label();`,
        `</script>`,
        `<script type="module">`,
        `  import { m } from "./src/paraglide/messages.js";`,
        `  const label = m.second;`,
        `  document.body.title = label();`,
        `</script>`
      ),
    });
    expect(describeUsages(usages)).toEqual([
      'message:first:call 5',
      'message:second:call 10',
    ]);
  });
});

describe("Angular's own tools", () => {
  const parse = (file: string, code: string, context = REPO_PACKAGES) =>
    parseSource(
      file,
      code,
      (file, code, lang) => parseSync(file, code, { lang }) as never,
      languages,
      context
    );

  test('without @angular/compiler in the project, components are skipped', async () => {
    const component = `@Component({ template: "<p>{{ m.x() }}</p>" }) export class A {}`;
    for (const [file, code] of [
      ['/app/src/a.component.ts', component],
      ['/app/src/a.page.ag', '<template><p>{{ m.x() }}</p></template>'],
    ] as const) {
      expect(await parse(file, code, NO_PACKAGES)).toMatchObject({
        error: expect.stringContaining('@angular/compiler'),
        missing: ['@angular/compiler'],
      });
    }
    // Without Angular, an `.html` file is not a template: only module scripts are read.
    expect(
      await parse('/app/src/a.html', '<p>{{ m.x() }}</p>', NO_PACKAGES)
    ).toHaveProperty('module');
    expect(
      await parse(
        '/app/index.html',
        '<!doctype html><script type=module>m.x()</script>',
        NO_PACKAGES
      )
    ).toHaveProperty('module');
  });

  test('a template Angular rejects is skipped with its error', async () => {
    expect(await parse('/app/src/a.component.html', '@if (x) { <p>')).toEqual({
      error: expect.stringContaining('Unclosed block "if"'),
    });
  });
});
