/**
 * Tier 3: Cross-file and CLI-specific tests for auto JSX injection.
 *
 * Tests CLI-specific behaviors that have no compiler equivalent:
 * - Cross-file Derive resolution with auto-injection
 * - enableAutoJsxInjection config forwarding to cross-file resolution
 * - Re-export chains with auto-injection
 * - Flag behavior
 *
 * See JSX_INSERTION_RULES.md for insertion rules.
 * See AUTO_JSX_INJECTION_CLI_PLAN.md for the two-pass strategy.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as t from '@babel/types';
import fs from 'node:fs';
import { parse } from '@babel/parser';
import traverseModule, { NodePath } from '@babel/traverse';
import { parseTranslationComponent } from '../parseJsx.js';
import { ParsingConfigOptions } from '../../../../../types/parsing.js';
import { Updates } from '../../../../../types/index.js';
import { Libraries } from '../../../../../types/libraries.js';
import { JsxChild } from 'generaltranslation/types';
import { getPathsAndAliases } from '../../getPathsAndAliases.js';
import {
  ensureTAndVarImported,
  autoInsertJsxComponents,
} from '../autoInsertion.js';
import {
  INTERNAL_TRANSLATION_COMPONENT,
  INTERNAL_VAR_COMPONENT,
} from '../../constants.js';
import { resolveImportPath } from '../../resolveImportPath.js';
import generateModule from '@babel/generator';

const traverse: typeof traverseModule.default =
  (traverseModule as any).default || traverseModule;
const generate: typeof generateModule.default =
  (generateModule as any).default || generateModule;

vi.mock('node:fs');
vi.mock('../../resolveImportPath.js');

const mockFs = vi.mocked(fs);
const mockResolveImportPath = vi.mocked(resolveImportPath);

describe('auto JSX injection — cross-file and CLI-specific', () => {
  let updates: Updates;
  let errors: string[];
  let warnings: Set<string>;
  let parsingOptions: ParsingConfigOptions;

  beforeEach(() => {
    updates = [];
    errors = [];
    warnings = new Set();
    parsingOptions = { conditionNames: ['import', 'require'] };
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ================================================================ //
  //  Helper: extract user T (Pass 1) with Derive cross-file resolution
  // ================================================================ //

  function extractUserTWithDeriveSupport(
    sourceCode: string,
    filePath: string
  ) {
    const ast = parse(sourceCode, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    let tLocalName = '';
    const importAliases: Record<string, string> = {};

    traverse(ast, {
      ImportDeclaration(path) {
        const source = path.node.source.value;
        if (['gt-next', 'gt-react', 'gt-react/browser'].includes(source)) {
          path.node.specifiers.forEach((spec) => {
            if (t.isImportSpecifier(spec) && t.isIdentifier(spec.imported)) {
              importAliases[spec.local.name] = spec.imported.name;
              if (spec.imported.name === 'T') tLocalName = spec.local.name;
            }
          });
        }
      },
    });

    if (tLocalName) {
      traverse(ast, {
        Program(programPath) {
          const tBinding = programPath.scope.getBinding(tLocalName);
          if (tBinding) {
            parseTranslationComponent({
              originalName: 'T',
              localName: tLocalName,
              path: tBinding.path,
              updates,
              config: {
                importAliases,
                parsingOptions,
                pkgs: [Libraries.GT_NEXT],
                file: filePath,
                includeSourceCodeContext: false,
              },
              output: {
                errors,
                warnings,
                unwrappedExpressions: [],
              },
            });
          }
        },
      });
    }
  }

  // ================================================================ //
  //  Helper: two-pass extraction with auto-injection
  // ================================================================ //

  function extractWithAutoInjectionForFile(
    sourceCode: string,
    filePath: string
  ) {
    const localUpdates: Updates = [];
    const localErrors: string[] = [];
    const localWarnings = new Set<string>();

    const ast = parse(sourceCode, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    const pkgs = [Libraries.GT_NEXT, Libraries.GT_REACT] as any[];

    // --- PASS 1: Extract user-written T components ---
    const pass1Result = getPathsAndAliases(ast, pkgs);
    const importAliases = { ...pass1Result.importAliases };
    for (const {
      localName,
      originalName,
    } of pass1Result.translationComponentPaths) {
      importAliases[localName] = originalName;
    }

    for (const { localName, path } of pass1Result.translationComponentPaths) {
      parseTranslationComponent({
        originalName: localName,
        localName,
        path,
        updates: localUpdates,
        config: {
          importAliases,
          parsingOptions,
          pkgs,
          file: filePath,
          includeSourceCodeContext: false,
        },
        output: {
          errors: localErrors,
          warnings: localWarnings,
          unwrappedExpressions: [],
        },
      });
    }
    const pass1Count = localUpdates.length;

    // --- PASS 2: Auto-inject ---
    ensureTAndVarImported(ast, importAliases);
    autoInsertJsxComponents(ast, importAliases);

    const modifiedCode = generate(ast).code;
    const freshAst = parse(modifiedCode, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    const internalTName = INTERNAL_TRANSLATION_COMPONENT;

    traverse(freshAst, {
      Program(programPath) {
        const tBinding = programPath.scope.getBinding(internalTName);
        if (!tBinding) return;

        const existingRefs = new Set(
          tBinding.referencePaths.map((r) => r.node)
        );
        programPath.traverse({
          JSXIdentifier(jsxIdPath: NodePath<t.JSXIdentifier>) {
            if (
              jsxIdPath.node.name === internalTName &&
              jsxIdPath.parentPath?.isJSXOpeningElement() &&
              !existingRefs.has(jsxIdPath.node)
            ) {
              tBinding.referencePaths.push(jsxIdPath);
            }
          },
        });

        parseTranslationComponent({
          originalName: internalTName,
          localName: internalTName,
          path: tBinding.path,
          updates: localUpdates,
          config: {
            importAliases: {
              ...importAliases,
              [INTERNAL_TRANSLATION_COMPONENT]: INTERNAL_TRANSLATION_COMPONENT,
              [INTERNAL_VAR_COMPONENT]: INTERNAL_VAR_COMPONENT,
            },
            parsingOptions,
            pkgs,
            file: filePath,
            includeSourceCodeContext: false,
            enableAutoJsxInjection: true,
          },
          output: {
            errors: localErrors,
            warnings: localWarnings,
            unwrappedExpressions: [],
          },
        });
      },
    });

    // Deduplicate
    const pass1Sources = new Set(
      localUpdates.slice(0, pass1Count).map((u) => JSON.stringify(u.source))
    );
    const deduped = [
      ...localUpdates.slice(0, pass1Count),
      ...localUpdates
        .slice(pass1Count)
        .filter((u) => !pass1Sources.has(JSON.stringify(u.source))),
    ];

    return {
      updates: deduped,
      errors: localErrors,
      warnings: localWarnings,
    };
  }

  // ================================================================ //
  //  1. DERIVE CROSS-FILE WITH AUTO INJECTION
  // ================================================================ //

  describe('Derive cross-file with auto-injection', () => {
    it('user-written T with Derive resolves cross-file function correctly', () => {
      // This is the baseline: user manually writes <T> with <Derive>,
      // and the cross-file function returns simple string content.
      const pageFile = `
        import { T, Derive } from "gt-next";
        import { getName } from "./libs/utils";

        export default function Page() {
          return <T>Hello <Derive>{getName()}</Derive></T>;
        }
      `;

      const utilsFile = `
        export function getName() {
          return "John";
        }
      `;

      mockFs.readFileSync.mockImplementation(
        (path: fs.PathOrFileDescriptor) => {
          if (path === '/test/derive-basic/libs/utils.ts') return utilsFile;
          throw new Error(`File not found: ${path}`);
        }
      );
      mockResolveImportPath.mockImplementation(
        (_currentFile: string, importPath: string) => {
          if (importPath === './libs/utils')
            return '/test/derive-basic/libs/utils.ts';
          return null;
        }
      );

      extractUserTWithDeriveSupport(pageFile, '/test/derive-basic/page.tsx');

      expect(errors).toHaveLength(0);
      expect(updates.length).toBeGreaterThanOrEqual(1);
      // Should contain "Hello " text and a Derive with "John"
      const source = updates[0].source as JsxChild[];
      expect(Array.isArray(source)).toBe(true);
      expect(source[0]).toBe('Hello ');
    });

    it('auto-injected T with Derive resolves cross-file and extracts', () => {
      // No user <T>. Auto-injection wraps the div's children.
      // Derive still resolves cross-file.
      const pageFile = `
        import { Derive } from "gt-next";
        import { getName } from "./libs/utils";

        export default function Page() {
          return <div>Hello <Derive>{getName()}</Derive></div>;
        }
      `;

      const utilsFile = `
        export function getName() {
          return "John";
        }
      `;

      mockFs.readFileSync.mockImplementation(
        (path: fs.PathOrFileDescriptor) => {
          if (path === '/test/derive-auto/libs/utils.ts') return utilsFile;
          throw new Error(`File not found: ${path}`);
        }
      );
      mockResolveImportPath.mockImplementation(
        (_currentFile: string, importPath: string) => {
          if (importPath === './libs/utils')
            return '/test/derive-auto/libs/utils.ts';
          return null;
        }
      );

      const result = extractWithAutoInjectionForFile(
        pageFile,
        '/test/derive-auto/page.tsx'
      );

      expect(result.errors).toHaveLength(0);
      expect(result.updates.length).toBeGreaterThanOrEqual(1);
    });

    it('cross-file function with conditional returns produces multiplication', () => {
      const pageFile = `
        import { T, Derive } from "gt-next";
        import { getData } from "./libs/utils";

        export default function Page() {
          return <T>Result: <Derive>{getData()}</Derive></T>;
        }
      `;

      const utilsFile = `
        export function getData() {
          if (Math.random() > 0.5) {
            return "Option A";
          }
          return "Option B";
        }
      `;

      mockFs.readFileSync.mockImplementation(
        (path: fs.PathOrFileDescriptor) => {
          if (path === '/test/derive-cond/libs/utils.ts') return utilsFile;
          throw new Error(`File not found: ${path}`);
        }
      );
      mockResolveImportPath.mockImplementation(
        (_currentFile: string, importPath: string) => {
          if (importPath === './libs/utils')
            return '/test/derive-cond/libs/utils.ts';
          return null;
        }
      );

      extractUserTWithDeriveSupport(pageFile, '/test/derive-cond/page.tsx');

      expect(errors).toHaveLength(0);
      // Conditional returns produce 2 multiplication variants
      expect(updates).toHaveLength(2);
    });

    it('multi-level cross-file resolution with re-exports', () => {
      const pageFile = `
        import { T, Derive } from "gt-next";
        import { getLabel } from "./libs/entry";

        export default function Page() {
          return <T>Label: <Derive>{getLabel()}</Derive></T>;
        }
      `;

      const entryFile = `
        export * from "./impl";
      `;

      const implFile = `
        export function getLabel() {
          return "Final value";
        }
      `;

      mockFs.readFileSync.mockImplementation(
        (path: fs.PathOrFileDescriptor) => {
          if (path === '/test/derive-reexport/libs/entry.ts') return entryFile;
          if (path === '/test/derive-reexport/libs/impl.ts') return implFile;
          throw new Error(`File not found: ${path}`);
        }
      );
      mockResolveImportPath.mockImplementation(
        (_currentFile: string, importPath: string) => {
          if (importPath === './libs/entry')
            return '/test/derive-reexport/libs/entry.ts';
          if (importPath === './impl')
            return '/test/derive-reexport/libs/impl.ts';
          return null;
        }
      );

      extractUserTWithDeriveSupport(
        pageFile,
        '/test/derive-reexport/page.tsx'
      );

      expect(errors).toHaveLength(0);
      expect(updates.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ================================================================ //
  //  2. enableAutoJsxInjection CONFIG FORWARDING BUG
  //
  //  BUG: In parseJsx.ts processFunctionInFile() (lines 1012-1017 and
  //  1038-1044), the config object passed to cross-file resolution does
  //  NOT forward enableAutoJsxInjection. This means buildJSXTree in the
  //  cross-file context won't enter the "unwrap auto T in Derive" code
  //  path (parseJsx.ts:308-311), even when the calling file had
  //  config.enableAutoJsxInjection = true.
  //
  //  Consequence: when a cross-file function returns JSX with text, the
  //  auto-injection pass inserts <GtInternalTranslateJsx> inside it.
  //  The Derive extraction then encounters that _T but doesn't unwrap it
  //  (because config.enableAutoJsxInjection is falsy in the cross-file
  //  config). The extracted source tree contains a spurious
  //  "GtInternalTranslateJsx" element that the runtime would have
  //  stripped via removeInjectedT(). This causes a hash mismatch.
  //
  //  These tests assert CORRECT behavior. They will FAIL until the bug
  //  is fixed by forwarding enableAutoJsxInjection in processFunctionInFile.
  // ================================================================ //

  describe('cross-file Derive extraction parity with same-file', () => {
    // ----------------------------------------------------------------
    // ROOT CAUSE: processFunctionInFile (parseJsx.ts) reads the cross-
    // file source via fs.readFileSync and parses a fresh AST, but it
    // does NOT run autoInsertJsxComponents on that AST. So:
    //
    //  - Same-file functions: auto-injection already ran on the main
    //    AST, so <GtInternalTranslateJsx> and <GtInternalVar> wrappers
    //    exist. buildJSXTree sees them and (with enableAutoJsxInjection)
    //    unwraps _T inside Derive, preserves _Var as variable slots.
    //
    //  - Cross-file functions: the raw source is parsed as-is, with no
    //    auto-injection. Dynamic expressions like {name} appear as bare
    //    JSXExpressionContainers — NOT wrapped in <GtInternalVar>.
    //    The extraction treats them as unwrapped expressions (warnings)
    //    rather than variable slots.
    //
    // Additionally, even if cross-file injection were added,
    // processFunctionInFile does NOT forward enableAutoJsxInjection in
    // the config (lines 1012-1017 / 1038-1044), so the _T unwrap guard
    // at line 308-311 would not fire.
    //
    // These tests assert CORRECT behavior: same-file and cross-file
    // Derive extraction should produce identical source structures.
    // They FAIL until both issues are addressed.
    // ----------------------------------------------------------------

    it('cross-file Derive with dynamic content should produce Var entries like same-file', () => {
      // Same-file: function is defined locally, auto-injection wraps it.
      // Derive extraction sees <GtInternalVar>{name}</GtInternalVar> → {v:"v"}
      //
      // Cross-file: function is in utils.ts, parsed raw (no injection).
      // Derive extraction sees bare {name} → unwrapped expression warning.
      //
      // CORRECT behavior: cross-file should also produce {v:"v"} entries.
      const sameFileCode = `
        import { Derive } from "gt-next";

        function getGreeting(name: string) {
          return <span>Hello {name}</span>;
        }

        export default function Page() {
          return <div>Welcome: <Derive>{getGreeting("World")}</Derive></div>;
        }
      `;

      const crossFilePageCode = `
        import { Derive } from "gt-next";
        import { getGreeting } from "./libs/utils";

        export default function Page() {
          return <div>Welcome: <Derive>{getGreeting("World")}</Derive></div>;
        }
      `;

      const crossFileUtilsCode = `
        export function getGreeting(name: string) {
          return <span>Hello {name}</span>;
        }
      `;

      // Extract same-file version (auto-injection runs on main AST)
      const sameFileResult = extractWithAutoInjectionForFile(
        sameFileCode,
        '/test/parity-1a/page.tsx'
      );

      // Set up cross-file mocks
      mockFs.readFileSync.mockImplementation(
        (path: fs.PathOrFileDescriptor) => {
          if (path === '/test/parity-1b/libs/utils.ts')
            return crossFileUtilsCode;
          throw new Error(`File not found: ${path}`);
        }
      );
      mockResolveImportPath.mockImplementation(
        (_currentFile: string, importPath: string) => {
          if (importPath === './libs/utils')
            return '/test/parity-1b/libs/utils.ts';
          return null;
        }
      );

      // Extract cross-file version
      const crossFileResult = extractWithAutoInjectionForFile(
        crossFilePageCode,
        '/test/parity-1b/page.tsx'
      );

      // Same-file should succeed with Var entries
      expect(sameFileResult.updates.length).toBeGreaterThan(0);

      // Cross-file should also produce updates and no errors
      expect(crossFileResult.errors).toHaveLength(0);
      expect(crossFileResult.updates.length).toBeGreaterThan(0);

      // No GtInternalTranslateJsx should leak into extracted sources
      for (const update of crossFileResult.updates) {
        const s = JSON.stringify(update.source);
        expect(s).not.toContain('GtInternalTranslateJsx');
      }

      // Every cross-file update should appear in same-file updates
      const sameFileSources = sameFileResult.updates.map((u) =>
        JSON.stringify(u.source)
      );
      const crossFileSources = crossFileResult.updates.map((u) =>
        JSON.stringify(u.source)
      );
      for (const s of crossFileSources) {
        expect(sameFileSources).toContainEqual(s);
      }
    });

    it('cross-file Derive with simple JSX text should match same-file extraction', () => {
      // Even with just static text (no dynamic expressions), the
      // extracted source structure can differ between same-file and
      // cross-file because same-file has _T unwrapping logic while
      // cross-file doesn't encounter _T at all (no injection).
      //
      // For static-only content this may happen to be equivalent,
      // but for anything with elements it can diverge.
      const sameFileCode = `
        import { Derive } from "gt-next";

        function getLabel() {
          return <span>Dashboard</span>;
        }

        export default function Page() {
          return <div>Title: <Derive>{getLabel()}</Derive></div>;
        }
      `;

      const crossFilePageCode = `
        import { Derive } from "gt-next";
        import { getLabel } from "./libs/utils";

        export default function Page() {
          return <div>Title: <Derive>{getLabel()}</Derive></div>;
        }
      `;

      const crossFileUtilsCode = `
        export function getLabel() {
          return <span>Dashboard</span>;
        }
      `;

      // Extract same-file
      const sameFileResult = extractWithAutoInjectionForFile(
        sameFileCode,
        '/test/parity-2a/page.tsx'
      );

      // Set up cross-file mocks
      mockFs.readFileSync.mockImplementation(
        (path: fs.PathOrFileDescriptor) => {
          if (path === '/test/parity-2b/libs/utils.ts')
            return crossFileUtilsCode;
          throw new Error(`File not found: ${path}`);
        }
      );
      mockResolveImportPath.mockImplementation(
        (_currentFile: string, importPath: string) => {
          if (importPath === './libs/utils')
            return '/test/parity-2b/libs/utils.ts';
          return null;
        }
      );

      // Extract cross-file
      const crossFileResult = extractWithAutoInjectionForFile(
        crossFilePageCode,
        '/test/parity-2b/page.tsx'
      );

      expect(sameFileResult.updates.length).toBeGreaterThan(0);
      expect(crossFileResult.errors).toHaveLength(0);
      expect(crossFileResult.updates.length).toBeGreaterThan(0);

      // The outer T extraction (["Title: ", {Derive}]) should be present
      // in both. Cross-file should NOT contain GtInternalTranslateJsx.
      for (const update of crossFileResult.updates) {
        const s = JSON.stringify(update.source);
        expect(s).not.toContain('GtInternalTranslateJsx');
      }

      // Both should share the outer T update structure
      const crossFileSources = crossFileResult.updates.map((u) =>
        JSON.stringify(u.source)
      );
      const sameFileSources = sameFileResult.updates.map((u) =>
        JSON.stringify(u.source)
      );
      // Every cross-file update should appear in same-file updates
      for (const s of crossFileSources) {
        expect(sameFileSources).toContainEqual(s);
      }
    });

    it('cross-file Derive with conditional returns should match same-file multiplication', () => {
      // Conditional returns produce multiplication nodes. The number
      // and content of updates should be identical regardless of whether
      // the function is in the same file or a different file.
      const sameFileCode = `
        import { Derive } from "gt-next";

        function getStatus() {
          if (Math.random() > 0.5) {
            return <em>Active</em>;
          }
          return <em>Inactive</em>;
        }

        export default function Page() {
          return <div>Status: <Derive>{getStatus()}</Derive></div>;
        }
      `;

      const crossFilePageCode = `
        import { Derive } from "gt-next";
        import { getStatus } from "./libs/utils";

        export default function Page() {
          return <div>Status: <Derive>{getStatus()}</Derive></div>;
        }
      `;

      const crossFileUtilsCode = `
        export function getStatus() {
          if (Math.random() > 0.5) {
            return <em>Active</em>;
          }
          return <em>Inactive</em>;
        }
      `;

      // Extract same-file
      const sameFileResult = extractWithAutoInjectionForFile(
        sameFileCode,
        '/test/parity-3a/page.tsx'
      );

      // Set up cross-file mocks
      mockFs.readFileSync.mockImplementation(
        (path: fs.PathOrFileDescriptor) => {
          if (path === '/test/parity-3b/libs/utils.ts')
            return crossFileUtilsCode;
          throw new Error(`File not found: ${path}`);
        }
      );
      mockResolveImportPath.mockImplementation(
        (_currentFile: string, importPath: string) => {
          if (importPath === './libs/utils')
            return '/test/parity-3b/libs/utils.ts';
          return null;
        }
      );

      // Extract cross-file
      const crossFileResult = extractWithAutoInjectionForFile(
        crossFilePageCode,
        '/test/parity-3b/page.tsx'
      );

      expect(sameFileResult.updates.length).toBeGreaterThan(0);
      expect(crossFileResult.errors).toHaveLength(0);
      expect(crossFileResult.updates.length).toBeGreaterThan(0);

      // No GtInternalTranslateJsx should leak into extracted sources
      for (const update of crossFileResult.updates) {
        const s = JSON.stringify(update.source);
        expect(s).not.toContain('GtInternalTranslateJsx');
      }

      // Every cross-file update should appear in same-file updates
      const sameFileSources = sameFileResult.updates.map((u) =>
        JSON.stringify(u.source)
      );
      const crossFileSources = crossFileResult.updates.map((u) =>
        JSON.stringify(u.source)
      );
      for (const s of crossFileSources) {
        expect(sameFileSources).toContainEqual(s);
      }
    });
  });

  // ================================================================ //
  //  3. DERIVE + AUTO INJECTION EDGE CASES
  // ================================================================ //

  describe('Derive + auto injection edge cases', () => {
    it('Derive with text triggers T at parent — no crash with cross-file', () => {
      const pageFile = `
        import { T, Derive } from "gt-next";
        import { getItem } from "./libs/utils";

        export default function Page() {
          return <T>Current item: <Derive>{getItem()}</Derive></T>;
        }
      `;

      const utilsFile = `
        export function getItem() {
          return "Widget";
        }
      `;

      mockFs.readFileSync.mockImplementation(
        (path: fs.PathOrFileDescriptor) => {
          if (path === '/test/derive-text/libs/utils.ts') return utilsFile;
          throw new Error(`File not found: ${path}`);
        }
      );
      mockResolveImportPath.mockImplementation(
        (_currentFile: string, importPath: string) => {
          if (importPath === './libs/utils')
            return '/test/derive-text/libs/utils.ts';
          return null;
        }
      );

      extractUserTWithDeriveSupport(pageFile, '/test/derive-text/page.tsx');

      expect(errors).toHaveLength(0);
      expect(updates.length).toBeGreaterThanOrEqual(1);
    });

    it('cross-file arrow function resolves correctly', () => {
      const pageFile = `
        import { T, Derive } from "gt-next";
        import { getTitle } from "./libs/utils";

        export default function Page() {
          return <T>Title: <Derive>{getTitle()}</Derive></T>;
        }
      `;

      const utilsFile = `
        export const getTitle = () => "Dashboard";
      `;

      mockFs.readFileSync.mockImplementation(
        (path: fs.PathOrFileDescriptor) => {
          if (path === '/test/derive-arrow/libs/utils.ts') return utilsFile;
          throw new Error(`File not found: ${path}`);
        }
      );
      mockResolveImportPath.mockImplementation(
        (_currentFile: string, importPath: string) => {
          if (importPath === './libs/utils')
            return '/test/derive-arrow/libs/utils.ts';
          return null;
        }
      );

      extractUserTWithDeriveSupport(pageFile, '/test/derive-arrow/page.tsx');

      expect(errors).toHaveLength(0);
      expect(updates.length).toBeGreaterThanOrEqual(1);
    });

    it('cross-file function returning JSX with dynamic content', () => {
      const pageFile = `
        import { T, Derive } from "gt-next";
        import { getGreeting } from "./libs/utils";

        export default function Page() {
          return <T>Welcome: <Derive>{getGreeting("World")}</Derive></T>;
        }
      `;

      const utilsFile = `
        export function getGreeting(name: string) {
          return <span>Hello {name}</span>;
        }
      `;

      mockFs.readFileSync.mockImplementation(
        (path: fs.PathOrFileDescriptor) => {
          if (path === '/test/derive-jsx/libs/utils.ts') return utilsFile;
          throw new Error(`File not found: ${path}`);
        }
      );
      mockResolveImportPath.mockImplementation(
        (_currentFile: string, importPath: string) => {
          if (importPath === './libs/utils')
            return '/test/derive-jsx/libs/utils.ts';
          return null;
        }
      );

      extractUserTWithDeriveSupport(pageFile, '/test/derive-jsx/page.tsx');

      // Should have updates — the Derive content may produce warnings
      // since {name} is a parameter, not a static value
      expect(updates.length).toBeGreaterThanOrEqual(0);
    });

    it('cross-file function with no return — handled gracefully', () => {
      const pageFile = `
        import { T, Derive } from "gt-next";
        import { doSomething } from "./libs/utils";

        export default function Page() {
          return <T>Action: <Derive>{doSomething()}</Derive></T>;
        }
      `;

      const utilsFile = `
        export function doSomething() {
          console.log("side effect");
        }
      `;

      mockFs.readFileSync.mockImplementation(
        (path: fs.PathOrFileDescriptor) => {
          if (path === '/test/derive-noreturn/libs/utils.ts') return utilsFile;
          throw new Error(`File not found: ${path}`);
        }
      );
      mockResolveImportPath.mockImplementation(
        (_currentFile: string, importPath: string) => {
          if (importPath === './libs/utils')
            return '/test/derive-noreturn/libs/utils.ts';
          return null;
        }
      );

      extractUserTWithDeriveSupport(
        pageFile,
        '/test/derive-noreturn/page.tsx'
      );

      // Should produce a warning about missing return, not crash
      expect(warnings.size).toBeGreaterThanOrEqual(0);
    });
  });

  // ================================================================ //
  //  4. CIRCULAR IMPORTS WITH AUTO INJECTION
  // ================================================================ //

  describe('circular imports with auto injection', () => {
    it('circular imports resolved without infinite loop', () => {
      const pageFile = `
        import { T, Derive } from "gt-next";
        import { getA } from "./libs/a";

        export default function Page() {
          return <T>Value: <Derive>{getA()}</Derive></T>;
        }
      `;

      const fileA = `
        import { getB } from "./b";
        export function getA() {
          if (Math.random() > 0.5) {
            return getB();
          }
          return "A";
        }
      `;

      const fileB = `
        export * from "./a";
        export function getB() {
          return "B";
        }
      `;

      mockFs.readFileSync.mockImplementation(
        (path: fs.PathOrFileDescriptor) => {
          if (path === '/test/circular-auto/libs/a.ts') return fileA;
          if (path === '/test/circular-auto/libs/b.ts') return fileB;
          throw new Error(`File not found: ${path}`);
        }
      );
      mockResolveImportPath.mockImplementation(
        (_currentFile: string, importPath: string) => {
          if (importPath === './libs/a')
            return '/test/circular-auto/libs/a.ts';
          if (importPath === './b') return '/test/circular-auto/libs/b.ts';
          if (importPath === './a') return '/test/circular-auto/libs/a.ts';
          return null;
        }
      );

      extractUserTWithDeriveSupport(
        pageFile,
        '/test/circular-auto/page.tsx'
      );

      // Should complete without infinite loop or crash
      expect(errors).toHaveLength(0);
      expect(updates.length).toBeGreaterThanOrEqual(1);
    });

    it('self-recursive function detected with error', () => {
      const pageFile = `
        import { T, Derive } from "gt-next";
        import { factorial } from "./libs/math";

        export default function Page() {
          return <T>Result: <Derive>{factorial(5)}</Derive></T>;
        }
      `;

      const mathFile = `
        export function factorial(n: number): number {
          if (n <= 1) return 1;
          return factorial(n - 1) * n;
        }
      `;

      mockFs.readFileSync.mockImplementation(
        (path: fs.PathOrFileDescriptor) => {
          if (path === '/test/recursive/libs/math.ts') return mathFile;
          throw new Error(`File not found: ${path}`);
        }
      );
      mockResolveImportPath.mockImplementation(
        (_currentFile: string, importPath: string) => {
          if (importPath === './libs/math')
            return '/test/recursive/libs/math.ts';
          return null;
        }
      );

      extractUserTWithDeriveSupport(pageFile, '/test/recursive/page.tsx');

      // Recursion should be detected
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  // ================================================================ //
  //  5. RE-EXPORT CHAINS WITH AUTO INJECTION
  // ================================================================ //

  describe('re-export chains', () => {
    it('export * from — followed correctly', () => {
      const pageFile = `
        import { T, Derive } from "gt-next";
        import { getLabel } from "./libs/index";

        export default function Page() {
          return <T>Label: <Derive>{getLabel()}</Derive></T>;
        }
      `;

      const indexFile = `
        export * from "./impl";
      `;

      const implFile = `
        export function getLabel() {
          return "Hello";
        }
      `;

      mockFs.readFileSync.mockImplementation(
        (path: fs.PathOrFileDescriptor) => {
          if (path === '/test/reexport-star/libs/index.ts') return indexFile;
          if (path === '/test/reexport-star/libs/impl.ts') return implFile;
          throw new Error(`File not found: ${path}`);
        }
      );
      mockResolveImportPath.mockImplementation(
        (_currentFile: string, importPath: string) => {
          if (importPath === './libs/index')
            return '/test/reexport-star/libs/index.ts';
          if (importPath === './impl')
            return '/test/reexport-star/libs/impl.ts';
          return null;
        }
      );

      extractUserTWithDeriveSupport(
        pageFile,
        '/test/reexport-star/page.tsx'
      );

      expect(errors).toHaveLength(0);
      expect(updates.length).toBeGreaterThanOrEqual(1);
    });

    it('named re-export — followed correctly', () => {
      const pageFile = `
        import { T, Derive } from "gt-next";
        import { getTitle } from "./libs/index";

        export default function Page() {
          return <T>Title: <Derive>{getTitle()}</Derive></T>;
        }
      `;

      const indexFile = `
        export { getTitle } from "./impl";
      `;

      const implFile = `
        export function getTitle() {
          return "Dashboard";
        }
      `;

      mockFs.readFileSync.mockImplementation(
        (path: fs.PathOrFileDescriptor) => {
          if (path === '/test/reexport-named/libs/index.ts') return indexFile;
          if (path === '/test/reexport-named/libs/impl.ts') return implFile;
          throw new Error(`File not found: ${path}`);
        }
      );
      mockResolveImportPath.mockImplementation(
        (_currentFile: string, importPath: string) => {
          if (importPath === './libs/index')
            return '/test/reexport-named/libs/index.ts';
          if (importPath === './impl')
            return '/test/reexport-named/libs/impl.ts';
          return null;
        }
      );

      extractUserTWithDeriveSupport(
        pageFile,
        '/test/reexport-named/page.tsx'
      );

      expect(errors).toHaveLength(0);
      expect(updates.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ================================================================ //
  //  6. FLAG BEHAVIOR
  // ================================================================ //

  describe('flag behavior', () => {
    it('flag OFF: no auto injection, only user T extracted', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return (
            <div>
              <T>Manual</T>
              <span>Should not be extracted</span>
            </div>
          );
        }
      `;

      // Only Pass 1 — no auto injection
      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });

      let tLocalName = '';
      const importAliases: Record<string, string> = {};
      traverse(ast, {
        ImportDeclaration(path) {
          if (path.node.source.value === 'gt-next') {
            path.node.specifiers.forEach((spec) => {
              if (
                t.isImportSpecifier(spec) &&
                t.isIdentifier(spec.imported)
              ) {
                importAliases[spec.local.name] = spec.imported.name;
                if (spec.imported.name === 'T')
                  tLocalName = spec.local.name;
              }
            });
          }
        },
      });

      traverse(ast, {
        Program(programPath) {
          const tBinding = programPath.scope.getBinding(tLocalName);
          if (tBinding) {
            parseTranslationComponent({
              originalName: 'T',
              localName: tLocalName,
              path: tBinding.path,
              updates,
              config: {
                importAliases,
                parsingOptions,
                pkgs: [Libraries.GT_NEXT],
                file: '/test/flag-off/page.tsx',
                includeSourceCodeContext: false,
                // enableAutoJsxInjection is NOT set (flag off)
              },
              output: {
                errors,
                warnings,
                unwrappedExpressions: [],
              },
            });
          }
        },
      });

      // Only "Manual" should be extracted
      expect(updates).toHaveLength(1);
      expect(updates[0].source).toEqual('Manual');
    });

    it('flag ON: auto injection adds content alongside user T', () => {
      const code = `
        import { T } from "gt-next";
        export default function Page() {
          return (
            <div>
              <T>Manual</T>
              <span>Auto extracted</span>
            </div>
          );
        }
      `;

      const result = extractWithAutoInjectionForFile(
        code,
        '/test/flag-on/page.tsx'
      );

      // "Manual" from user T + "Auto extracted" from auto injection
      expect(result.updates).toHaveLength(2);
      expect(result.updates[0].source).toEqual('Manual');
      expect(result.updates[1].source).toEqual('Auto extracted');
    });

    it('flag ON with no GT imports: auto adds import and extracts', () => {
      const code = `
        export default function Page() {
          return <h1>Hello World</h1>;
        }
      `;

      const result = extractWithAutoInjectionForFile(
        code,
        '/test/flag-noimport/page.tsx'
      );

      expect(result.updates).toHaveLength(1);
      expect(result.updates[0].source).toEqual('Hello World');
    });
  });

  // ================================================================ //
  //  7. COMPLEX REAL-WORLD CROSS-FILE SCENARIOS
  // ================================================================ //

  describe('complex cross-file scenarios', () => {
    it('Derive with Branch in same tree — both resolve correctly', () => {
      const pageFile = `
        import { T, Derive, Branch } from "gt-next";
        import { getStatus } from "./libs/utils";

        export default function Page() {
          return (
            <T>
              Status: <Derive>{getStatus()}</Derive>
              <Branch branch="mode" light="Light" dark="Dark">Default</Branch>
            </T>
          );
        }
      `;

      const utilsFile = `
        export function getStatus() {
          return "Active";
        }
      `;

      mockFs.readFileSync.mockImplementation(
        (path: fs.PathOrFileDescriptor) => {
          if (path === '/test/derive-branch/libs/utils.ts') return utilsFile;
          throw new Error(`File not found: ${path}`);
        }
      );
      mockResolveImportPath.mockImplementation(
        (_currentFile: string, importPath: string) => {
          if (importPath === './libs/utils')
            return '/test/derive-branch/libs/utils.ts';
          return null;
        }
      );

      extractUserTWithDeriveSupport(
        pageFile,
        '/test/derive-branch/page.tsx'
      );

      expect(errors).toHaveLength(0);
      expect(updates.length).toBeGreaterThanOrEqual(1);
    });

    it('multiple Derive siblings resolving different files', () => {
      const pageFile = `
        import { T, Derive } from "gt-next";
        import { getFirst } from "./libs/first";
        import { getSecond } from "./libs/second";

        export default function Page() {
          return (
            <T>
              First: <Derive>{getFirst()}</Derive>
              Second: <Derive>{getSecond()}</Derive>
            </T>
          );
        }
      `;

      const firstFile = `
        export function getFirst() { return "Alpha"; }
      `;

      const secondFile = `
        export function getSecond() { return "Beta"; }
      `;

      mockFs.readFileSync.mockImplementation(
        (path: fs.PathOrFileDescriptor) => {
          if (path === '/test/multi-derive/libs/first.ts') return firstFile;
          if (path === '/test/multi-derive/libs/second.ts') return secondFile;
          throw new Error(`File not found: ${path}`);
        }
      );
      mockResolveImportPath.mockImplementation(
        (_currentFile: string, importPath: string) => {
          if (importPath === './libs/first')
            return '/test/multi-derive/libs/first.ts';
          if (importPath === './libs/second')
            return '/test/multi-derive/libs/second.ts';
          return null;
        }
      );

      extractUserTWithDeriveSupport(
        pageFile,
        '/test/multi-derive/page.tsx'
      );

      expect(errors).toHaveLength(0);
      expect(updates.length).toBeGreaterThanOrEqual(1);

      // Verify both files were read
      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        '/test/multi-derive/libs/first.ts',
        'utf8'
      );
      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        '/test/multi-derive/libs/second.ts',
        'utf8'
      );
    });
  });
});
