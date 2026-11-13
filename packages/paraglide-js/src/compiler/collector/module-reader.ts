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

/**
 * A `GeneratedModule`, serialized: kept outside the JavaScript heap until its
 * file is loaded again. A large component's is several times its file's size.
 */
export type GeneratedBytes = Uint8Array;

export type SummaryResult =
  | { summary: ParsedSummary; generated?: GeneratedBytes }
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
    generated: generated && v8.serialize(generated),
  };
}

/**
 * Parses an indexed file again, when an indexed graph loads it. A language's
 * tooling is not run again: `generated` is what it generated when indexing.
 */
export function loadIndexedFile(
  file: string,
  generated: GeneratedBytes | undefined
): ParsedModule | undefined {
  let code: string;

  try {
    code = fs.readFileSync(file, 'utf8');
  } catch {
    return undefined;
  }

  const parsed = parseSourceSync(
    file,
    code,
    parseModuleCode,
    generated && (v8.deserialize(generated) as GeneratedModule)
  );

  return 'module' in parsed ? parsed.module : undefined;
}

/** Modules a graph keeps loaded if it can: the files around the one analyzed, which it reads again and again. */
const MODULES_KEPT = 120;

/** Below it, unloading modules costs more than it saves. */
const MIN_BUDGET = 16_000_000;

/** Above it, collecting garbage in a larger heap costs more than loading modules again. */
const MAX_BUDGET = 32_000_000;

/** The share of a thread's heap its modules take at most: the rest is for the analysis and its garbage. */
export const THREAD_HEAP_SHARE = 1 / 3.5;

/**
 * Characters of code an indexed graph keeps the modules of loaded, for files
 * of `averageFileSize` characters, its modules taking at most `heapShare` of
 * the heap. A module's syntax tree and index take about 40 times its code's size.
 */
export function analysisBudget(
  averageFileSize: number,
  heapShare = THREAD_HEAP_SHARE
): number {
  const wanted = Math.min(
    Math.max(MODULES_KEPT * averageFileSize, MIN_BUDGET),
    MAX_BUDGET
  );

  const heapLimit = v8.getHeapStatistics().heap_size_limit;

  return Math.min(wanted, (heapLimit * heapShare) / 40);
}
