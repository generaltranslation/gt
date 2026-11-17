// Prints a results file as Markdown tables, or two files side by side.
//   node scripts/report.mjs results/a.json [results/b.json]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

const ms = (value) => value.toFixed(value < 10 ? 2 : 1);
const ns = (value) => Math.round(value).toLocaleString('en-US');

function table(header, rows) {
  return [
    `| ${header.join(' | ')} |`,
    `| ${header.map((_, i) => (i ? '--:' : '---')).join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

/** One column per variant and results file; `cell` formats a variant's entry. */
function section(files, group, cell) {
  const columns = files.flatMap((file) =>
    file.variants.map((variant) => ({ file, variant }))
  );
  return table(
    [
      '',
      ...columns.map(({ file, variant }) =>
        files.length > 1 ? `${variant} @ ${file.label}` : variant
      ),
    ],
    Object.keys(files[0][group]).map((name) => [
      name,
      ...columns.map(({ file, variant }) => {
        const entry = file[group][name]?.[variant];
        return entry ? cell(entry) : '';
      }),
    ])
  );
}

export function report(...files) {
  const [first] = files;
  const micro = (locale) =>
    files.map((file) => ({
      ...file,
      micro: Object.fromEntries(
        Object.keys(file.micro[locale][file.variants[0]]).map((kind) => [
          kind,
          Object.fromEntries(
            file.variants.map((variant) => [
              variant,
              file.micro[locale][variant][kind],
            ])
          ),
        ])
      ),
    }));
  const callCell = ({ first, warm }) => `${ns(first)} / ${ns(warm)}`;
  return [
    files
      .map(
        (file) =>
          `\`${file.label}\`: ${file.sha}, ${file.machine}, Chromium ${file.chromium}, median of ${file.samples}`
      )
      .join('\n'),
    '**Route import → commit, ms (re-render → commit, ms)**',
    section(
      files,
      'render',
      ({ mount, update }) => `${ms(mount)} (${ms(update)})`
    ),
    '**One kind per route: 100 messages, fr, 1x CPU, ms (re-render, ms)**',
    section(
      files,
      'kind',
      ({ mount, update }) => `${ms(mount)} (${ms(update)})`
    ),
    ...Object.keys(first.micro).flatMap((locale) => [
      `**Outside React, ${locale}: ns per call, first call of a site / warm**`,
      section(micro(locale), 'micro', callCell),
    ]),
  ].join('\n\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(
    report(
      ...process.argv
        .slice(2)
        .map((path) => JSON.parse(readFileSync(path, 'utf8')))
    )
  );
}
