import { describe, expect, test } from 'vitest';
import {
  ENTRY,
  OUTDIR,
  analyzeProject,
  summarize,
} from '../helpers/project.js';

const call = 'message:greeting:call';
const cjs = '/app/src/i18n.cjs';

async function through(
  cjsCode: string,
  entry = `import { m } from "./i18n.cjs"; m.greeting();`
) {
  const usages = await analyzeProject({ [ENTRY]: entry, [cjs]: cjsCode });
  return { summary: summarize(usages), targetFile: usages[0]?.targetFile };
}

describe('CommonJS exports of followed modules', () => {
  test.each([
    [
      'module.exports = { m }',
      `module.exports = { m: require("./paraglide/messages.js").m };`,
    ],
    [
      'exports.x = …',
      `const messages = require("./paraglide/messages.js");\nexports.m = messages.m;`,
    ],
    [
      'module.exports.x = …',
      `const { m } = require("./paraglide/messages.js");\nmodule.exports.m = m;`,
    ],
    [
      "TypeScript's output",
      [
        `"use strict";`,
        `Object.defineProperty(exports, "__esModule", { value: true });`,
        `exports.m = void 0;`,
        `var messages_js_1 = require("./paraglide/messages.js");`,
        `Object.defineProperty(exports, "m", { enumerable: true, get: function () { return messages_js_1.m; } });`,
      ].join('\n'),
    ],
    [
      '__exportStar',
      `__exportStar(require("./paraglide/messages.js"), exports);`,
    ],
    [
      'tslib.__exportStar',
      `tslib.__exportStar(require("./paraglide/messages.js"), exports);`,
    ],
    [
      'module.exports = require(…)',
      `module.exports = require("./paraglide/messages.js");`,
    ],
    [
      "Babel's export *",
      [
        `var _messages = require("./paraglide/messages.js");`,
        `Object.keys(_messages).forEach(function (key) {`,
        `  if (key === "default") return;`,
        `  exports[key] = _messages[key];`,
        `});`,
      ].join('\n'),
    ],
  ])('%s', async (_name, code) => {
    const { summary, targetFile } = await through(code);
    expect(summary).toEqual([call]);
    expect(targetFile).toBe(`${OUTDIR}/messages.js`);
  });

  test('a default import is the whole module.exports', async () => {
    const { summary } = await through(
      `module.exports = require("./paraglide/messages.js");`,
      `import i18n from "./i18n.cjs"; i18n.m.greeting();`
    );
    expect(summary).toEqual([call]);
  });

  test('require() of a CommonJS module', async () => {
    const { summary } = await through(
      `exports.t = require("./paraglide/messages.js").m;`,
      `const { t } = require("./i18n.cjs"); t.greeting();`
    );
    expect(summary).toEqual([call]);
  });

  test('a module with ESM exports is not read as CommonJS', async () => {
    const { summary } = await through(
      `export const other = 1;\nmodule.exports = require("./paraglide/messages.js");`
    );
    expect(summary).toEqual([]);
  });
});
