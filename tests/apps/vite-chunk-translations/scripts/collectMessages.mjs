// A Vite plugin for scripts/pseudo-translate.mjs: records the hash and source
// of every `t`, `msg` and `useGT()` message the compiler wrote into a
// module, before the bundler drops unused code, so the catalogs also hold
// messages that no chunk renders.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

// __gt_chunk_message("<hash>", <tree>) and { $_hash: "<hash>", $_tree: <tree>, … }
const TREE_SITES = [
  /__gt_chunk_message\("([0-9a-f]{16})",\s*/g,
  /\$_hash: "([0-9a-f]{16})",\s*\$_tree: /g,
];

// Messages of plain text that no chunk's file holds: msg({ $_hash: "<hash>" })`text`
const TEXT_SITES = [
  [/\(\{\s*\$_hash: "([0-9a-f]{16})"\s*\}\)`([^`$\\]*)`/g, (text) => text],
];

/** The end of the JavaScript expression that starts at `start`. */
function findExpressionEnd(code, start) {
  let depth = 0;
  for (let index = start; index < code.length; index++) {
    const char = code[index];
    if (char === '"' || char === "'" || char === '`') {
      for (index++; code[index] !== char; index++) {
        if (code[index] === '\\') index++;
      }
    } else if ('([{'.includes(char)) {
      depth++;
    } else if (')]}'.includes(char)) {
      if (depth === 0) return index;
      depth--;
    } else if (char === ',' && depth === 0) {
      return index;
    }
  }
  throw new Error('Unfinished expression');
}

export function collectMessages(outFile) {
  const trees = {};
  return {
    name: 'collect-messages',
    enforce: 'post',
    transform(code, id) {
      if (id.includes('/node_modules/')) return;
      for (const pattern of TREE_SITES) {
        for (const match of code.matchAll(pattern)) {
          const start = match.index + match[0].length;
          const source = code.slice(start, findExpressionEnd(code, start));
          trees[match[1]] = new Function(`return (${source});`)();
        }
      }
      for (const [pattern, read] of TEXT_SITES) {
        for (const match of code.matchAll(pattern)) {
          trees[match[1]] = read(match[2]);
        }
      }
    },
    buildEnd() {
      mkdirSync(dirname(outFile), { recursive: true });
      writeFileSync(outFile, JSON.stringify(trees, null, 2));
    },
  };
}
