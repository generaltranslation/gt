import fs from 'node:fs';
import v8 from 'node:v8';
import {
  summarizeModule,
  type ParsedSummary,
} from '../analysis/module-index.js';
import type { ParsedModule } from '../analysis/module-graph.js';
import {
  generateSource,
  parseSourceSync,
  type GeneratedSource,
  type LanguageContext,
  type ParseFailure,
  type SourceLanguage,
} from '../languages/language.js';
import { parseModuleCode } from '../utils/parse.js';
import { readTextFile } from '../utils/read-file.js';

/** The module a language's tooling generated for a file, and the language's name. */
export type GeneratedModule = { language: string; source: GeneratedSource };

export type SummaryResult =
  | { summary: ParsedSummary; generated?: GeneratedModule }
  | { failure: ParseFailure }
  /** The file cannot be read. */
  | undefined;

/** Reads a file to index it: what it loads, and the module its language generates. */
export async function summarizeFile(
  file: string,
  languages: readonly SourceLanguage[],
  packages: LanguageContext,
  globalNames: ReadonlySet<string>
): Promise<SummaryResult> {
  const code = await readTextFile(file);
  if (code === undefined) return undefined;

  const generated = await generateSource(file, code, languages, packages);
  if (generated && 'error' in generated) return { failure: generated };

  const parsed = parseSourceSync(file, code, parseModuleCode, generated);
  if (!('module' in parsed)) return { failure: parsed };

  return {
    summary: summarizeModule(parsed.module, globalNames),
    generated,
  };
}

/**
 * Parses an indexed file again, when an indexed graph loads it. A language's
 * tooling is not run again: `generated` is what it generated when indexing.
 */
export function loadIndexedFile(
  file: string,
  generated: GeneratedModule | undefined
): ParsedModule | undefined {
  let code: string;

  try {
    code = fs.readFileSync(file, 'utf8');
  } catch {
    return undefined;
  }

  const parsed = parseSourceSync(file, code, parseModuleCode, generated);

  return 'module' in parsed ? parsed.module : undefined;
}

/** Above it, collecting garbage in a larger heap costs more than loading modules again. */
const MAX_BUDGET = 16_000_000;

/**
 * Characters of code an indexed graph keeps the modules of loaded. A module's
 * syntax tree and index take about 40 times its code's size: at most 30% of
 * the heap, the rest is for the analysis and its garbage.
 */
export function analysisBudget(): number {
  return Math.min(v8.getHeapStatistics().heap_size_limit / 140, MAX_BUDGET);
}
