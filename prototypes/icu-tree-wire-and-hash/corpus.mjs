// Loads a corpus (one ICU message per line) into every shape bench.mjs compares.
import { readFileSync } from 'node:fs';

export function loadCorpus(lib, path) {
  const messages = [
    ...new Set(readFileSync(path, 'utf8').split('\n').filter(Boolean)),
  ];
  const entries = [];
  for (const icu of messages) {
    let ast;
    try {
      ast = lib.parse(icu);
    } catch {
      continue;
    }
    const kind = ast.some((e) => e.options)
      ? 'branches'
      : ast.some((e) => e.type !== 0)
        ? 'args'
        : 'plain';
    entries.push({
      icu,
      ast,
      compact: lib.toCompact(ast),
      kind,
      variables: variablesFor(ast),
    });
  }
  return { entries, skipped: messages.length - entries.length };
}

// A value of the right type for each placeholder, so every message renders.
function variablesFor(ast, vars = {}) {
  for (const e of ast) {
    if (e.type === 1) vars[e.value] ??= 'Ada';
    if (e.type === 2 || e.type === 6) vars[e.value] = 3;
    if (e.type === 3 || e.type === 4)
      vars[e.value] = new Date(Date.UTC(2025, 0, 15, 12));
    if (e.type === 5) vars[e.value] ??= 'other';
    if (e.type === 8) vars[e.value] = (parts) => parts.join('');
    for (const o of Object.values(e.options ?? {})) variablesFor(o.value, vars);
    if (e.children) variablesFor(e.children, vars);
  }
  return vars;
}
