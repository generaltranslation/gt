import chalk from 'chalk';
import { logger } from './logger.js';
import {
  getWarnings,
  hasWarnings,
  type WarningCategory,
} from '../state/translateWarnings.js';

const CATEGORY_LABELS: Record<WarningCategory, string> = {
  skipped_file: 'Files skipped',
  failed_move: 'File moves failed',
  failed_translation: 'Translations failed',
  failed_download: 'Downloads failed',
};

const CATEGORY_ORDER: WarningCategory[] = [
  'skipped_file',
  'failed_move',
  'failed_translation',
  'failed_download',
];

export function displayTranslateSummary() {
  if (!hasWarnings()) return;

  const warnings = getWarnings();

  // Group by category
  const grouped = new Map<WarningCategory, { fileName: string; reason: string }[]>();
  for (const w of warnings) {
    let list = grouped.get(w.category);
    if (!list) {
      list = [];
      grouped.set(w.category, list);
    }
    list.push({ fileName: w.fileName, reason: w.reason });
  }

  const lines: string[] = [chalk.yellow('⚠  Warnings:'), ''];

  for (const category of CATEGORY_ORDER) {
    const items = grouped.get(category);
    if (!items) continue;
    lines.push(`    ${CATEGORY_LABELS[category]} (${items.length}):`);
    for (const item of items) {
      lines.push(`      - ${item.fileName}: ${item.reason}`);
    }
    lines.push('');
  }

  logger.warn(lines.join('\n'));
}
