import { expect, test } from 'vitest';
import { analyzeEntry } from '../helpers/project.js';

test('`this` in a class: fields, private fields and getters', async () => {
  expect(
    await analyzeEntry(
      [
        `import { m } from "./paraglide/messages.js";`,
        `export class Card {`,
        `  t = m;`,
        `  #msgs = m;`,
        `  get title() { return m.title; }`,
        `  self = this.self;`,
        `  render() {`,
        `    const onClick = () => this.t.greeting();`,
        `    return [this.#msgs.label(), this.title(), onClick];`,
        `  }`,
        `  nested() {`,
        `    return function () { return this.t.never(); };`,
        `  }`,
        `}`,
      ].join('\n')
    )
  ).toEqual([
    'message:title:reference',
    'message:greeting:call',
    'message:label:call',
    'message:title:call',
  ]);
});
