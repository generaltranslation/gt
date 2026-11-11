import { expect, test } from 'vitest';
import { analyzeProject, summarize } from '../helpers/project.js';

const file = '/app/src/element.ts';

async function analyze(lines: string[]) {
  const usages = await analyzeProject(
    { [file]: lines.join('\n') },
    { entry: file }
  );
  return usages.map((usage) => {
    const element = usage.element
      ? ` <${usage.element.element}${usage.element.attribute ? ` ${usage.element.attribute}` : ''}>`
      : '';
    return `${summarize([usage])[0]} ${usage.line}${element}`;
  });
}

test('text, attributes, properties, events, booleans and element bindings', async () => {
  expect(
    await analyze([
      `import { html } from "lit";`,
      `import { m } from "./paraglide/messages.js";`,
      `export const view = () => html\``,
      `  <section>`,
      `    <h1 title=\${m.title()} aria-label="a \${m.label()} b">\${m.heading()}</h1>`,
      `    <input .value=\${m.value()} ?disabled=\${m.off()} @click=\${() => m.clicked()} />`,
      `    <div \${ref(m.ref())}>after \${m.text()}</div>`,
      `    \${m.section_text()}`,
      `  </section>`,
      `  \${m.top_level()}`,
      `\`;`,
    ])
  ).toEqual([
    'message:title:call 5 <h1 title>',
    'message:label:call 5 <h1 aria-label>',
    'message:heading:call 5 <h1>',
    'message:value:call 6 <input .value>',
    'message:off:call 6 <input ?disabled>',
    'message:clicked:call 6 <input @click>',
    'message:ref:call 7 <div ${…}>',
    'message:text:call 7 <div>',
    'message:section_text:call 8 <section>',
    'message:top_level:call 10',
  ]);
});

test('nested templates, svg and member tags', async () => {
  expect(
    await analyze([
      `import * as lit from "lit";`,
      `import { svg } from "lit";`,
      `import { m } from "./paraglide/messages.js";`,
      `const items = [1];`,
      `export const list = lit.html\`<ul>\${items.map(() => lit.html\`<li title=\${m.item()}>\${m.row()}</li>\`)}</ul>\`;`,
      `export const icon = svg\`<svg><text>\${m.icon()}</text></svg>\`;`,
      `export const loose = lit.html\`<p>\${lit.html\`\${m.nested_top()}\`}</p>\`;`,
    ])
  ).toEqual([
    'message:item:call 5 <li title>',
    'message:row:call 5 <li>',
    'message:icon:call 6 <text>',
    // A nested template's top level is in the outer element.
    'message:nested_top:call 7 <p>',
  ]);
});

test('other tags and plain templates get no element', async () => {
  expect(
    await analyze([
      `import { m } from "./paraglide/messages.js";`,
      `const html = (s: TemplateStringsArray) => s;`,
      `export const a = css\`<p>\${m.css()}</p>\`;`,
      `export const b = \`<p>\${m.plain()}</p>\`;`,
      `export const c = html;`,
      `export const d = [html, m.outside()];`,
    ])
  ).toEqual([
    'message:css:call 3',
    'message:plain:call 4',
    'message:outside:call 6',
  ]);
});

test('script and style contents, and dynamic tags', async () => {
  expect(
    await analyze([
      `import { html } from "lit";`,
      `import { m } from "./paraglide/messages.js";`,
      `export const a = html\`<style>.x { content: "\${m.style()}" }</style><b>\${m.bold()}</b>\`;`,
    ])
  ).toEqual(['message:style:call 3 <style>', 'message:bold:call 3 <b>']);
});
