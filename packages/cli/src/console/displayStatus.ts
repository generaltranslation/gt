import chalk from 'chalk';
import { logger } from './logger.js';
import type {
  LocaleStatus,
  StatusUnitRef,
} from '../translation/status/computeStatus.js';

const MAX_ISSUE_LINES = 25;

/** Exact coverage percentage; an empty project counts as fully covered */
export function coveragePercent(row: LocaleStatus): number {
  if (row.total === 0) return 100;
  // Multiply before dividing so exact thresholds stay exact in floating
  // point (29/100 * 100 is 28.999…, 29 * 100 / 100 is 29)
  return (row.translated * 100) / row.total;
}

/** Formats a percentage without ever rounding up (99.96 -> "99.9%") */
function formatPercent(percent: number): string {
  const floored = Math.floor(percent * 10) / 10;
  return `${Number.isInteger(floored) ? floored.toFixed(0) : floored.toFixed(1)}%`;
}

type Cell = { text: string; color?: (text: string) => string };

function pad(cell: Cell, width: number, align: 'left' | 'right'): string {
  const padding = ' '.repeat(Math.max(0, width - cell.text.length));
  const text = align === 'left' ? cell.text + padding : padding + cell.text;
  return cell.color ? cell.color(text) : text;
}

/**
 * Renders the per-locale status table:
 * ┌────────┬──────────┬────────────┬─────────┬───────┬────────┐
 * │ Locale │ Coverage │ Translated │ Missing │ Stale │ Errors │
 * └────────┴──────────┴────────────┴─────────┴───────┴────────┘
 */
export function renderStatusTable(
  rows: LocaleStatus[],
  options: { minCoverage: number }
): string {
  const header: Cell[] = [
    { text: 'Locale' },
    { text: 'Coverage' },
    { text: 'Translated' },
    { text: 'Missing' },
    { text: 'Stale' },
    { text: 'Errors' },
  ];
  const aligns: ('left' | 'right')[] = [
    'left',
    'right',
    'right',
    'right',
    'right',
    'right',
  ];

  const body: Cell[][] = rows.map((row) => {
    const percent = coveragePercent(row);
    const covered = percent >= options.minCoverage;
    return [
      { text: row.locale, color: chalk.cyan },
      // A row with nothing measurable gets a dash, not a fake 100%
      row.total === 0
        ? { text: '—', color: chalk.dim }
        : {
            text: formatPercent(percent),
            color: covered ? chalk.green : chalk.yellow,
          },
      { text: `${row.translated}/${row.total}` },
      {
        text: String(row.missing.length),
        color: row.missing.length ? chalk.yellow : chalk.dim,
      },
      {
        text: String(row.stale.length),
        color: row.stale.length ? chalk.yellow : chalk.dim,
      },
      {
        text: String(row.errors.length),
        color: row.errors.length ? chalk.red : chalk.dim,
      },
    ];
  });

  const widths = header.map((cell, column) =>
    Math.max(
      cell.text.length,
      ...body.map((cells) => cells[column].text.length)
    )
  );

  const border = (left: string, joint: string, right: string) =>
    chalk.dim(
      left + widths.map((width) => '─'.repeat(width + 2)).join(joint) + right
    );
  const renderRow = (cells: Cell[]) =>
    chalk.dim('│') +
    cells
      .map((cell, column) => ` ${pad(cell, widths[column], aligns[column])} `)
      .join(chalk.dim('│')) +
    chalk.dim('│');

  return [
    border('┌', '┬', '┐'),
    renderRow(header.map((cell) => ({ ...cell, color: chalk.bold }))),
    border('├', '┼', '┤'),
    ...body.map(renderRow),
    border('└', '┴', '┘'),
  ].join('\n');
}

function unitLabel(unit: StatusUnitRef): string {
  return unit.key ? `${unit.fileName} › ${unit.key}` : unit.fileName;
}

function renderSection(
  title: string,
  lines: string[],
  overflowNoun: string
): string[] {
  if (lines.length === 0) return [];
  const capped = lines.slice(0, MAX_ISSUE_LINES);
  const overflow = lines.length - capped.length;
  return [
    title,
    ...capped,
    ...(overflow > 0
      ? [chalk.dim(`  … and ${overflow} more ${overflowNoun}`)]
      : []),
    '',
  ];
}

/**
 * Renders detail lines below the table. Validation errors are always
 * listed; missing and stale units only in verbose mode. Returns an empty
 * string when there is nothing to show.
 */
export function renderStatusIssues(
  rows: LocaleStatus[],
  options: { verbose: boolean }
): string {
  const errorLines = rows.flatMap((row) =>
    row.errors.map(
      (issue) =>
        `  ${chalk.red('✗')} [${row.locale}] ${unitLabel(issue)}: ${issue.message}`
    )
  );
  const missingLines = options.verbose
    ? rows.flatMap((row) =>
        row.missing.map(
          (unit) => `  ${chalk.yellow('−')} [${row.locale}] ${unitLabel(unit)}`
        )
      )
    : [];
  const staleLines = options.verbose
    ? rows.flatMap((row) =>
        row.stale.map(
          (unit) => `  ${chalk.yellow('↻')} [${row.locale}] ${unitLabel(unit)}`
        )
      )
    : [];

  const sections = [
    ...renderSection(chalk.red('Validation errors:'), errorLines, 'errors'),
    ...renderSection(chalk.yellow('Missing:'), missingLines, 'missing'),
    ...renderSection(chalk.yellow('Stale:'), staleLines, 'stale'),
  ];
  return sections.join('\n').trimEnd();
}

/**
 * Renders a note listing files whose per-locale coverage cannot be
 * measured locally (composite JSON), deduplicated across locales.
 * Empty string when everything was measurable.
 */
export function renderUnmeasuredNote(rows: LocaleStatus[]): string {
  const files = new Set<string>(
    rows.flatMap((row) => row.unmeasured.map((unit) => unit.fileName))
  );
  if (files.size === 0) return '';
  return chalk.dim(
    `Not measured (composite JSON keeps every locale in one file): ${[...files].join(', ')}`
  );
}

/** Logs the status table and any detail sections */
export function displayStatus(
  rows: LocaleStatus[],
  options: { minCoverage: number; verbose: boolean }
): void {
  logger.message('\n' + renderStatusTable(rows, options));
  const unmeasured = renderUnmeasuredNote(rows);
  if (unmeasured) {
    logger.info(unmeasured);
  }
  const issues = renderStatusIssues(rows, options);
  if (issues) {
    const hasErrors = rows.some((row) => row.errors.length > 0);
    if (hasErrors) {
      logger.error(issues);
    } else {
      logger.info(issues);
    }
  }
}
