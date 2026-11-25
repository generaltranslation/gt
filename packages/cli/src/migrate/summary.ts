import type { MessageTree } from '@generaltranslation/icu';
import { treeNodes } from './convert/tree.js';
import type { MatchTier, MigrationReport } from './types.js';

export type LocaleSummary = {
  locale: string;
  carried: number;
  migrated: Partial<Record<MatchTier, number>>;
  filled: number;
  rejected: number;
  missing: number;
  /** Characters of source text still to translate. */
  missingChars: number;
};

function treeText(tree: MessageTree): number {
  return treeNodes(tree).reduce<number>((total, node) => {
    if (typeof node === 'string') return total + node.length;
    if (node === 0) return total;
    switch (node[1]) {
      case 'select':
      case 'plural':
      case 'selectordinal':
        return (
          total +
          Object.values(node[2]).reduce<number>(
            (sum, branch) => sum + treeText(branch),
            0
          )
        );
      case 'tag':
        return total + treeText(node[2]);
      default:
        return total;
    }
  }, 0);
}

function jsxText(value: unknown): number {
  if (typeof value === 'string') return value.length;
  if (Array.isArray(value)) {
    return value.reduce<number>((sum, child) => sum + jsxText(child), 0);
  }
  if (!value || typeof value !== 'object') return 0;
  const element = value as { c?: unknown; d?: { b?: Record<string, unknown> } };
  return (
    jsxText(element.c) +
    Object.values(element.d?.b ?? {}).reduce<number>(
      (sum, branch) => sum + jsxText(branch),
      0
    )
  );
}

export function sourceTextLength(source: unknown, dataFormat: string): number {
  return dataFormat === 'MESSAGE_TREE'
    ? treeText(source as MessageTree)
    : jsxText(source);
}

export function summarizeReport(report: MigrationReport): LocaleSummary[] {
  return report.locales.map((locale) => {
    const summary: LocaleSummary = {
      locale,
      carried: 0,
      migrated: {},
      filled: 0,
      rejected: 0,
      missing: 0,
      missingChars: 0,
    };
    for (const message of report.messages) {
      const outcome = message.locales[locale];
      switch (outcome?.status) {
        case 'carried':
          summary.carried++;
          break;
        case 'migrated': {
          const tier = message.tier ?? 'same-key';
          summary.migrated[tier] = (summary.migrated[tier] ?? 0) + 1;
          if (outcome.filled) summary.filled++;
          break;
        }
        case 'rejected':
        case 'missing':
        case undefined:
          if (outcome?.status === 'rejected') summary.rejected++;
          else summary.missing++;
          summary.missingChars += sourceTextLength(
            message.source,
            message.dataFormat
          );
      }
    }
    return summary;
  });
}

export function completeLocales(report: MigrationReport): string[] {
  return report.locales.filter((locale) =>
    report.messages.every((message) => {
      const status = message.locales[locale]?.status;
      return status === 'carried' || status === 'migrated';
    })
  );
}
