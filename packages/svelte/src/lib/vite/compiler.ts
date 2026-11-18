import type { Reference } from '@typescript-eslint/scope-manager';
import { hashStringMessage } from 'gt-i18n/internal/string';
import MagicString, { type SourceMap } from 'magic-string';
import {
  compiledPrefix,
  componentHandle,
  isTrackedExport,
  lookupAlias,
  type TrackedExport,
} from '../shared/protocol.js';
import {
  analyzeProgram,
  EditSet,
  parentMap,
  walk,
  type AnyNode,
} from './ast.js';
import {
  constantMessageOnly,
  constantOptionsOnly,
  DiagnosticCollector,
  directCallOnly,
  namespaceImport,
  reservedPrefix,
  tagOnly,
} from './diagnostics.js';
import { evaluateStringOptions, evaluateString } from './evaluate.js';
import type { ManifestEntry } from './manifest.js';

export type CompileResult = {
  code: string;
  map: SourceMap;
  entries: ManifestEntry[];
};

/** Where compiled code runs: inside a component instance or at module scope. */
export type CallSite = 'component' | 'module';

export type Binding = {
  local: string;
  imported: TrackedExport;
  specifier: AnyNode;
  program: AnyNode;
};

/** The import-binding and `gt()` compilation shared by components and modules. */
export class SourceCompiler {
  readonly diagnostics: DiagnosticCollector;
  readonly edits: EditSet;
  readonly entries: ManifestEntry[] = [];
  readonly bindings = new Map<string, Binding>();
  runtimeSource: string | undefined;
  readonly #callSites = new Set<CallSite>();

  constructor(
    readonly code: string,
    readonly filePath: string
  ) {
    this.diagnostics = new DiagnosticCollector(filePath, code);
    this.edits = new EditSet(code);
  }

  /** Import sources of a program, so the caller can resolve them before compiling. */
  static importSources(program: AnyNode): string[] {
    const sources: string[] = [];
    for (const statement of program.body as AnyNode[]) {
      if (
        statement.type === 'ImportDeclaration' &&
        statement.importKind !== 'type'
      ) {
        sources.push((statement.source as AnyNode).value as string);
      }
    }
    return sources;
  }

  collectBindings(program: AnyNode, runtimeSources: ReadonlySet<string>): void {
    for (const statement of program.body as AnyNode[]) {
      if (
        statement.type !== 'ImportDeclaration' ||
        statement.importKind === 'type'
      ) {
        continue;
      }
      const source = (statement.source as AnyNode).value as string;
      if (!runtimeSources.has(source)) continue;
      this.runtimeSource ??= source;
      for (const specifier of statement.specifiers as AnyNode[]) {
        if (specifier.type === 'ImportNamespaceSpecifier') {
          this.diagnostics.report(specifier.start, namespaceImport);
          continue;
        }
        if (
          specifier.type !== 'ImportSpecifier' ||
          specifier.importKind === 'type'
        ) {
          continue;
        }
        const imported = specifier.imported as AnyNode;
        const importedName =
          imported.type === 'Identifier' ? imported.name : imported.value;
        if (typeof importedName !== 'string' || !isTrackedExport(importedName))
          continue;
        const local = (specifier.local as AnyNode).name as string;
        this.bindings.set(local, {
          local,
          imported: importedName,
          specifier,
          program,
        });
      }
    }
  }

  checkReservedNames(root: AnyNode): void {
    walk(root, (node) => {
      if (
        node.type === 'Identifier' &&
        typeof node.name === 'string' &&
        node.name.startsWith(compiledPrefix)
      ) {
        this.diagnostics.report(node.start, reservedPrefix);
      }
    });
  }

  /** Compiles every reference to bindings declared in `program`, plus `extra` references. */
  compileProgramReferences(
    program: AnyNode,
    site: CallSite,
    extraBindings: Binding[] = []
  ): void {
    const manager = analyzeProgram(program);
    const parents = parentMap(program);
    for (const binding of this.bindings.values()) {
      if (binding.program !== program) continue;
      const [variable] = manager.getDeclaredVariables(
        binding.specifier as never
      );
      for (const reference of variable?.references ?? []) {
        if (reference.isValueReference) {
          this.compileReference(binding, reference, parents, site);
        }
      }
    }
    if (!extraBindings.length) return;
    const extra = new Map(extraBindings.map((b) => [b.local, b]));
    for (const reference of manager.globalScope!.through) {
      const binding = extra.get(reference.identifier.name);
      if (binding && reference.isValueReference) {
        this.compileReference(binding, reference, parents, site);
      }
    }
  }

  compileReference(
    binding: Binding,
    reference: Reference,
    parents: Map<AnyNode, AnyNode>,
    site: CallSite
  ): void {
    const identifier = reference.identifier as unknown as AnyNode;
    if (binding.imported !== 'gt') {
      this.diagnostics.report(identifier.start, tagOnly(binding.local));
      return;
    }
    const parent = parents.get(identifier);
    if (parent?.type !== 'CallExpression' || parent.callee !== identifier) {
      this.diagnostics.report(identifier.start, directCallOnly);
      return;
    }
    this.compileStringCall(parent, site);
  }

  compileStringCall(call: AnyNode, site: CallSite): void {
    const [messageNode, optionsNode, ...rest] = call.arguments as AnyNode[];
    const message = evaluateString(messageNode);
    if (message === undefined || rest.length) {
      this.diagnostics.report(call.start, constantMessageOnly);
      return;
    }
    const options = optionsNode ? evaluateStringOptions(optionsNode) : {};
    if (!options) {
      this.diagnostics.report(optionsNode!.start, constantOptionsOnly);
      return;
    }
    const hash = hashStringMessage(message, options);
    this.entries.push({
      dataFormat: 'STRING',
      source: message,
      metadata: {
        hash,
        ...(options.$context !== undefined && { context: options.$context }),
        ...(options.$maxChars !== undefined && {
          maxChars: options.$maxChars,
        }),
        ...(options.$requiresReview !== undefined && {
          requiresReview: options.$requiresReview,
        }),
        filePaths: [this.filePath],
      },
    });
    const target =
      site === 'module' ? `${lookupAlias}(` : `${componentHandle}.string(`;
    this.edits.replace(
      call.start,
      call.end,
      `${target}${JSON.stringify(hash)}, ${JSON.stringify(message)})`
    );
    this.#callSites.add(site);
  }

  usesCallSite(site: CallSite): boolean {
    return this.#callSites.has(site);
  }

  finish(
    insert: (output: MagicString) => void,
    filename: string
  ): CompileResult {
    this.diagnostics.throwIfAny();
    const output = new MagicString(this.code);
    this.edits.apply(output);
    insert(output);
    return {
      code: output.toString(),
      map: output.generateMap({
        hires: 'boundary',
        source: filename,
        includeContent: true,
      }),
      entries: this.entries,
    };
  }
}
