// PROTOTYPE: formatAst's traversal over the compact shape. The Intl helpers
// are shared with formatAst, so a bundle diff measures only the traversal.
import { resolveLocale } from '../formatter/locale';
import {
  DATE_STYLES,
  NUMBER_STYLES,
  TIME_STYLES,
  applyScale,
  getDateTimeFormat,
  getNumberFormat,
  getPluralRules,
  hasPluralCategoryOption,
  invalidSelection,
  ownOption,
  requireVariable,
  toPluralRulesNumber,
  type FormatContext,
  type PluralValue,
  type TagFormatter,
} from '../formatter/formatAst';
import { libraryDefaultLocale } from '../settings/settings';
import type {
  ExtendedNumberFormatOptions,
  MessageVariables,
} from '../types-dir/ast';
import type {
  CompactBranches,
  CompactBranchNode,
  CompactTagNode,
  CompactTree,
} from './compactTree';

/** Formats a compact tree; same output and errors as `formatAst` on the equivalent AST. */
export function formatCompact(
  tree: CompactTree,
  locales: string | string[] = libraryDefaultLocale,
  variables: MessageVariables = {}
): unknown {
  resolveLocale(locales);
  const parts = formatNodes(tree, { message: '', locales, variables });
  if (parts.length === 1) return parts[0];
  return parts.length ? parts : '';
}

function formatNodes(
  nodes: CompactTree,
  context: FormatContext,
  currentPluralValue?: PluralValue
): unknown[] {
  const result: unknown[] = [];
  const append = (value: unknown): void => {
    const previous = result[result.length - 1];
    if (typeof previous === 'string' && typeof value === 'string') {
      result[result.length - 1] = previous + value;
    } else {
      result.push(value);
    }
  };
  const branch = (branches: CompactBranches, key: string) => {
    const value = ownOption(branches, key);
    return typeof value === 'string' ? [value] : value;
  };

  for (const node of nodes) {
    if (typeof node === 'string') {
      append(node);
      continue;
    }
    if (node === 0) {
      if (currentPluralValue !== undefined) {
        append(getNumberFormat(context).format(currentPluralValue));
      }
      continue;
    }
    const name = node[0];
    switch (node[1]) {
      case undefined: {
        const value = requireVariable(context.variables, name);
        append(
          typeof value === 'string' || typeof value === 'number'
            ? String(value)
            : value || ''
        );
        break;
      }
      case 'number': {
        const value = requireVariable(context.variables, name);
        const style = node[2];
        const options: ExtendedNumberFormatOptions =
          typeof style === 'string'
            ? (NUMBER_STYLES[style] ?? {})
            : (style ?? {});
        const { scale, ...intlOptions } = options;
        append(
          getNumberFormat(context, intlOptions).format(
            applyScale(value, scale) as number
          )
        );
        break;
      }
      case 'date':
      case 'time': {
        const value = requireVariable(context.variables, name);
        const style = node[2];
        const options =
          typeof style === 'string'
            ? (node[1] === 'date' ? DATE_STYLES : TIME_STYLES)[style]
            : (style ?? (node[1] === 'time' ? TIME_STYLES.medium : undefined));
        append(
          getDateTimeFormat(context, options).format(value as number | Date)
        );
        break;
      }
      case 'select': {
        const value = String(requireVariable(context.variables, name));
        const branches = (node as CompactBranchNode)[2];
        const nodes = branch(branches, value) ?? branch(branches, 'other');
        if (!nodes) throw invalidSelection(name, value, branches);
        formatNodes(nodes, context).forEach(append);
        break;
      }
      case 'plural':
      case 'selectordinal': {
        const [, , branches, offset = 0] = node as CompactBranchNode;
        const rawValue = requireVariable(context.variables, name);
        let nodes = branch(branches, `=${String(rawValue)}`);
        const value =
          typeof rawValue === 'bigint' ? rawValue : Number(rawValue);
        const adjustedValue =
          typeof value === 'bigint' ? value - BigInt(offset) : value - offset;
        if (!nodes && hasPluralCategoryOption(branches)) {
          const category = getPluralRules(
            context,
            node[1] === 'plural' ? 'cardinal' : 'ordinal'
          ).select(toPluralRulesNumber(adjustedValue));
          nodes = branch(branches, category);
        }
        nodes ??= branch(branches, 'other');
        if (!nodes) throw invalidSelection(name, rawValue, branches);
        formatNodes(nodes, context, adjustedValue).forEach(append);
        break;
      }
      case 'tag': {
        const formatter = requireVariable(context.variables, name);
        if (typeof formatter !== 'function') {
          throw new TypeError(
            `The ICU tag variable "${name}" must be a function.`
          );
        }
        const formatted = (formatter as TagFormatter)(
          formatNodes((node as CompactTagNode)[2], context, currentPluralValue)
        );
        if (Array.isArray(formatted)) formatted.forEach(append);
        else append(formatted);
        break;
      }
    }
  }
  return result;
}
