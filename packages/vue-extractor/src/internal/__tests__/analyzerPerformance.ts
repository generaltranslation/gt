import {
  createVueScriptAnalysis,
  createVueScriptAnalysisStats,
  parseVueScript,
  type VueScriptAnalysisStats,
} from '../script.js';
import type { TemplateBindings, VueExtractionContext } from '../types.js';

/** Runs only the script analyzer and returns deterministic hot-path counters. */
export function collectAnalyzerStats(source: string): VueScriptAnalysisStats {
  const stats = createVueScriptAnalysisStats();
  const context: VueExtractionContext = {
    errors: [],
    file: '/fixtures/AnalyzerPerformance.ts',
    includeSourceCodeContext: false,
    relativeFile: 'AnalyzerPerformance.ts',
    results: [],
    source,
    surroundingLineCount: 0,
    warnings: new Set(),
  };
  const valid = parseVueScript(
    source,
    'ts',
    context,
    createTemplateBindings(),
    true,
    createVueScriptAnalysis(stats)
  );
  if (!valid || context.errors.length > 0) {
    throw new Error(context.errors.join('\n') || 'Script analysis failed');
  }
  return stats;
}

/** Creates the binding registry required by the low-level script analyzer. */
function createTemplateBindings(): TemplateBindings {
  return {
    arrayLengths: new Map(),
    componentFactories: new Set(),
    components: new Map(),
    containerKinds: new Map(),
    directBindings: new Set(),
    gtComponentFactories: new Set(),
    gtContainerFactories: new Set(),
    identityFunctions: new Set(),
    possibleGTContainers: new Set(),
    possibleStaticStrings: new Map(),
    registeredComponents: new Map(),
    registeredVueBuiltins: new Map(),
    staticValues: new Map(),
    stringFunctions: new Map(),
    uncertainComponents: new Set(),
    uncertainGTComponents: new Set(),
    uncertainRegisteredComponents: new Set(),
    uncertainRegisteredGTComponents: new Set(),
    uncertainStringFunctions: new Set(),
    vueBuiltins: new Map(),
  };
}
