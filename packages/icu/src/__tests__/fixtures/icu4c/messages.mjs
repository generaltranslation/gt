// Rewrites the `icu` and `rejects` of every case in messages-78.3.jsonl with
// what ./messages, built from messages.cpp, prints for it.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('./messages-78.3.jsonl', import.meta.url);
const cases = readFileSync(file, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line));

const escape = (text) =>
  text.replace(/\\/g, '\\\\').replace(/\t/g, '\\t').replace(/\n/g, '\\n');
const unescape = (text) =>
  text.replace(/\\(.)/g, (_, c) => (c === 't' ? '\t' : c === 'n' ? '\n' : c));
const value = (name, v) =>
  typeof v === 'number'
    ? `${name}:n:${v}`
    : typeof v === 'string'
      ? `${name}:s:${escape(v)}`
      : '$date' in v
        ? `${name}:d:${Date.parse(v.$date)}`
        : '$int' in v
          ? `${name}:i:${v.$int}`
          : `${name}:n:${v.$number}`;

const rows = cases.map(({ id, locale, message, values }) =>
  [
    id,
    locale.replace(/-/g, '_'),
    escape(message),
    Object.entries(values)
      .map(([name, v]) => value(name, v))
      .join('\x1f'),
  ].join('\t')
);
writeFileSync('rows.tsv', rows.join('\n') + '\n');

const results = new Map(
  execFileSync('./messages', ['rows.tsv'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [id, state, ...result] = line.split('\t');
      return [id, { state, text: unescape(result.join('\t')) }];
    })
);
writeFileSync(
  file,
  cases
    .map(({ icu: _icu, rejects: _rejects, differs, treeDiffers, ...rest }) => {
      const { state, text } = results.get(rest.id);
      return JSON.stringify({
        ...rest,
        icu: text,
        ...(state !== 'ok' && { rejects: true }),
        ...(differs && { differs }),
        ...(treeDiffers && { treeDiffers }),
      });
    })
    .join('\n') + '\n'
);
