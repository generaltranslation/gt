import { lookupAlias } from '../shared/protocol.js';
import { prepareForScopeAnalysis, type AnyNode } from './ast.js';
import { SourceCompiler, type CompileResult } from './compiler.js';

/**
 * Compiles `gt()` calls in a JavaScript module, which run at module scope.
 *
 * `program` is the module's ESTree as the bundler parsed it.
 */
export function compileModule(
  code: string,
  program: AnyNode,
  filename: string,
  filePath: string,
  runtimeSources: ReadonlySet<string>
): CompileResult | null {
  const compiler = new SourceCompiler(code, filePath);
  compiler.collectBindings(program, runtimeSources);
  if (!compiler.bindings.size) {
    compiler.diagnostics.throwIfAny();
    return null;
  }
  prepareForScopeAnalysis(program);
  compiler.checkReservedNames(program);
  compiler.compileProgramReferences(program, 'module');
  const source = JSON.stringify(compiler.runtimeSource);
  return compiler.finish((output) => {
    if (compiler.usesCallSite('module')) {
      output.prepend(
        `import { lookupString as ${lookupAlias} } from ${source};\n`
      );
    }
  }, filename);
}
