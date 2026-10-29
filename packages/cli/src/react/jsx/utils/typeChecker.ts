import type * as TS from 'typescript';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * `no-typescript`: the project has no `typescript` package.
 * `unsupported-typescript`: its TypeScript has no compiler API (7.0).
 * `typescript-error`: the TypeScript compiler failed while reading the file.
 * `not-found`: no expression spans the given offsets.
 */
export type TypeIssue =
  | 'no-typescript'
  | 'unsupported-typescript'
  | 'typescript-error'
  | 'not-found';

type StringVariantsResult =
  | { variants: string[] }
  | {
      /**
       * `open`: some value is any string, like `string` or `` `id-${string}` ``.
       * `non-string`: some value is not a string.
       */
      issue: TypeIssue | 'open' | 'non-string';
    };

/** A checker type, read through whichever TypeScript API the project has. */
interface CheckedType {
  /** Whether the type has any of these TypeScript type flags. */
  is(...flags: TypeFlagName[]): boolean;
  stringValue: string | undefined;
  /** The members of a union type, or undefined for any other type. */
  unionTypes(): CheckedType[] | undefined;
  /** The members of an intersection type, or undefined for any other type. */
  intersectionTypes(): CheckedType[] | undefined;
  /** The base constraint of a type parameter or other generic type. */
  constraint(): CheckedType | undefined;
  symbolName(): string | undefined;
}

type TypeFlagName =
  | 'String'
  | 'TemplateLiteral'
  | 'StringMapping'
  | 'Any'
  | 'Unknown'
  | 'StringLike'
  | 'NumberLike'
  | 'BigIntLike'
  | 'BooleanLike'
  | 'Null'
  | 'Undefined'
  | 'Void'
  | 'Never'
  | 'Instantiable';

/**
 * Every string the expression at `[start, end)` of `file` can be, read from
 * its TypeScript type: a string literal or a union of them. Offsets are those
 * of a Babel node parsed from the same file text.
 */
export function getStringVariants(
  file: string,
  start: number,
  end: number
): StringVariantsResult {
  const type = getTypeAt(file, start, end);
  if ('issue' in type) return type;
  const variants = new Set<string>();
  for (const member of type.unionTypes() ?? [type]) {
    if (member.stringValue !== undefined) {
      variants.add(member.stringValue);
    } else {
      const open = member.is(
        'String',
        'TemplateLiteral',
        'StringMapping',
        'Any',
        'Unknown'
      );
      return { issue: open ? 'open' : 'non-string' };
    }
  }
  // Union member order depends on check order, so sort for stable output.
  return { variants: [...variants].sort() };
}

/**
 * Whether the expression at `[start, end)` of `file` is typed as a value the
 * runtime renders as an anonymous variable: a primitive or a Date. Objects,
 * symbols like `n`, and helper results are not.
 */
export function isPlainValue(
  file: string,
  start: number,
  end: number
): boolean | { issue: TypeIssue } {
  const type = getTypeAt(file, start, end);
  if ('issue' in type) return type;
  const isPlain = (member: CheckedType): boolean => {
    // Checked first: a template literal type is its own base constraint.
    if (
      member.is(
        'StringLike',
        'NumberLike',
        'BigIntLike',
        'BooleanLike',
        'Null',
        'Undefined',
        'Void',
        'Never',
        // Untyped values, as in JavaScript, are almost always primitives.
        'Any',
        'Unknown'
      ) ||
      member.symbolName() === 'Date'
    ) {
      return true;
    }
    if (member.is('Instantiable')) {
      const constraint = member.constraint();
      return !constraint || isPlain(constraint);
    }
    const union = member.unionTypes();
    if (union) return union.every(isPlain);
    // A branded primitive like `string & { brand: 'id' }` is still a primitive.
    return member.intersectionTypes()?.some(isPlain) ?? false;
  };
  return isPlain(type);
}

function getTypeAt(
  file: string,
  start: number,
  end: number
): CheckedType | { issue: TypeIssue } {
  const fileName = path.resolve(file);
  const typescript = typescriptByDirectory.get(path.dirname(fileName));
  if (typescript === undefined) {
    throw new Error(
      `loadTypeScript() must run before reading types in ${file}`
    );
  }
  if (!typescript) return { issue: 'no-typescript' };
  if (typescript.kind === 'unsupported') {
    return { issue: 'unsupported-typescript' };
  }
  if (typescript.kind === 'classic') {
    return (
      getClassicType(typescript.ts, fileName, start, end) ?? {
        issue: 'not-found',
      }
    );
  }
  try {
    return (
      getNativeType(typescript, fileName, start, end) ?? {
        issue: 'not-found',
      }
    );
  } catch {
    // The 7.1 beta compiler process can crash on some projects; start a new
    // one for the next file instead of failing the whole run.
    nativeSessions.delete(typescript.sync);
    return { issue: 'typescript-error' };
  }
}

// ===== Loading TypeScript ===== //

type LoadedTypeScript =
  | { kind: 'classic'; ts: typeof TS }
  | ({ kind: 'native' } & NativeTypeScript)
  | { kind: 'unsupported' };

// Keyed by the directory of an analyzed file, so each project uses its own copy.
const typescriptByDirectory = new Map<string, LoadedTypeScript | null>();
const typescriptByPackage = new Map<string, LoadedTypeScript>();

/**
 * Loads the TypeScript of `file`'s project, which getStringVariants() and
 * isPlainValue() then read the file's types with. The project's own copy
 * matches its tsconfig, so it is resolved from the file; the peer next to the
 * CLI is the fallback. TypeScript 7.0 ships no compiler API; 7.1 added one
 * under `typescript/sync`.
 */
export async function loadTypeScript(file: string): Promise<void> {
  const fileName = path.resolve(file);
  const directory = path.dirname(fileName);
  if (typescriptByDirectory.has(directory)) return;
  let loaded: LoadedTypeScript | null = null;
  for (const from of [fileName, import.meta.url]) {
    // import.meta.resolve() cannot resolve from another file without a Node
    // flag, so createRequire only finds the path; import() loads the module,
    // which also loads the ESM-only typescript/sync on every Node version.
    const { resolve } = createRequire(from);
    let packageJson: string;
    try {
      packageJson = resolve('typescript/package.json');
    } catch {
      continue;
    }
    loaded = typescriptByPackage.get(packageJson) ?? null;
    if (!loaded) {
      const load = (specifier: string) =>
        import(pathToFileURL(resolve(specifier)).href);
      const main = await load('typescript');
      // TypeScript 6 and earlier are CommonJS, which import() puts on default.
      const ts = (main.default ?? main) as typeof TS;
      const [major, minor] = ts.versionMajorMinor.split('.').map(Number);
      loaded =
        typeof ts.createProgram === 'function'
          ? { kind: 'classic', ts }
          : major > 7 || (major === 7 && minor >= 1)
            ? {
                kind: 'native',
                sync: (await load('typescript/sync')) as NativeSync,
                ast: (await load('typescript/ast')) as NativeAst,
              }
            : { kind: 'unsupported' };
      typescriptByPackage.set(packageJson, loaded);
    }
    break;
  }
  typescriptByDirectory.set(directory, loaded);
}

// ===== TypeScript 6 and earlier ===== //

const parsedConfigs = new Map<string, TS.ParsedCommandLine | undefined>();
const programs = new Map<string, TS.Program>();
// Resolved file names per config, so each lookup is not a scan of every file.
const configFiles = new Map<string, Set<string>>();
const compilerHosts = new Map<string, TS.CompilerHost>();

function getClassicType(
  ts: typeof TS,
  fileName: string,
  start: number,
  end: number
): CheckedType | undefined {
  const program = getProgram(ts, fileName);
  const sourceFile = program.getSourceFile(fileName);
  const node = sourceFile && findNode(ts, sourceFile, start, end);
  if (!node) return;
  const checker = program.getTypeChecker();
  const wrap = (type: TS.Type): CheckedType => ({
    is: (...flags) => flags.some((flag) => type.flags & ts.TypeFlags[flag]),
    stringValue: type.isStringLiteral() ? type.value : undefined,
    unionTypes: () => (type.isUnion() ? type.types.map(wrap) : undefined),
    intersectionTypes: () =>
      type.isIntersection() ? type.types.map(wrap) : undefined,
    constraint: () => {
      const constraint = checker.getBaseConstraintOfType(type);
      return constraint && wrap(constraint);
    },
    symbolName: () => type.getSymbol()?.name,
  });
  return wrap(checker.getTypeAtLocation(node));
}

/**
 * The program of the nearest tsconfig that includes `fileName`, following
 * project references so a solution-style root (`files: []`) finds its app
 * config. One program per config is reused for the whole run.
 */
function getProgram(ts: typeof TS, fileName: string): TS.Program {
  const nearest = ts.findConfigFile(path.dirname(fileName), ts.sys.fileExists);
  const project = nearest
    ? findProject(ts, nearest, fileName, new Set())
    : undefined;
  if (project) {
    let program = programs.get(project.configPath);
    if (!program) {
      program = createProgram(
        ts,
        project.config.fileNames,
        project.config.options
      );
      programs.set(project.configPath, program);
    }
    return program;
  }
  // Files no config includes share one growing program per nearest config.
  const key = `fallback:${nearest ?? ''}`;
  const previous = programs.get(key);
  if (previous?.getSourceFile(fileName)) return previous;
  const options = (nearest ? readConfig(ts, nearest)?.options : undefined) ?? {
    strict: true,
    jsx: ts.JsxEmit.Preserve,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ESNext,
  };
  const program = createProgram(
    ts,
    [...(previous?.getRootFileNames() ?? []), fileName],
    options,
    getCachingHost(ts, key, options)
  );
  programs.set(key, program);
  return program;
}

/**
 * A compiler host that parses each file once. Each new root changes the root
 * list, and TypeScript then reuses nothing from an old program, so without
 * it every rebuild of a fallback program parses the lib files again.
 */
function getCachingHost(
  ts: typeof TS,
  key: string,
  options: TS.CompilerOptions
): TS.CompilerHost {
  const cached = compilerHosts.get(key);
  if (cached) return cached;
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile;
  const sourceFiles = new Map<string, TS.SourceFile | undefined>();
  host.getSourceFile = (name, ...args) => {
    if (!sourceFiles.has(name)) {
      sourceFiles.set(name, getSourceFile.call(host, name, ...args));
    }
    return sourceFiles.get(name);
  };
  compilerHosts.set(key, host);
  return host;
}

function createProgram(
  ts: typeof TS,
  rootNames: readonly string[],
  options: TS.CompilerOptions,
  host?: TS.CompilerHost
): TS.Program {
  // Project references are left out so imports resolve to source, not to
  // the referenced project's build output, which may not exist. allowJs
  // keeps a JavaScript file in a TypeScript-only project from being dropped.
  return ts.createProgram({
    rootNames,
    options: { ...options, allowJs: true, noEmit: true },
    host,
  });
}

function findProject(
  ts: typeof TS,
  configPath: string,
  fileName: string,
  seen: Set<string>
): { configPath: string; config: TS.ParsedCommandLine } | undefined {
  if (seen.has(configPath)) return;
  seen.add(configPath);
  const config = readConfig(ts, configPath);
  if (!config) return;
  let files = configFiles.get(configPath);
  if (!files) {
    files = new Set(config.fileNames.map((name) => path.resolve(name)));
    configFiles.set(configPath, files);
  }
  if (files.has(fileName)) return { configPath, config };
  for (const reference of config.projectReferences ?? []) {
    const found = findProject(
      ts,
      ts.resolveProjectReferencePath(reference),
      fileName,
      seen
    );
    if (found) return found;
  }
}

function readConfig(
  ts: typeof TS,
  configPath: string
): TS.ParsedCommandLine | undefined {
  if (!parsedConfigs.has(configPath)) {
    parsedConfigs.set(
      configPath,
      ts.getParsedCommandLineOfConfigFile(configPath, undefined, {
        ...ts.sys,
        // An unreadable config reads as no config.
        onUnRecoverableConfigFileDiagnostic: () => {},
      })
    );
  }
  return parsedConfigs.get(configPath);
}

/** The innermost node spanning exactly `[start, end)`. */
function findNode(
  ts: typeof TS,
  sourceFile: TS.SourceFile,
  start: number,
  end: number
): TS.Node | undefined {
  // shortcut: TypeScript drops a leading BOM that Babel counts, shifting
  // offsets by one; strip it before parsing if such files show up.
  let found: TS.Node | undefined;
  const visit = (node: TS.Node): void => {
    const nodeStart = node.getStart(sourceFile);
    if (nodeStart > start || node.end < end) return;
    if (nodeStart === start && node.end === end) found = node;
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
  return found;
}

// ===== TypeScript 7.1 and later ===== //

// The parts of `typescript/sync` and `typescript/ast` used here, typed locally
// because the CLI builds against TypeScript 5.
interface NativeType {
  flags: number;
  value?: unknown;
  isUnionType(): boolean;
  isIntersectionType(): boolean;
  isStringLiteralType(): boolean;
  getTypes(): readonly NativeType[];
  getSymbol(): { name: string } | undefined;
}
interface NativeNode {
  end: number;
  parent?: NativeNode;
}
interface NativeProject {
  program: { getSourceFile(fileName: string): NativeNode | undefined };
  checker: {
    getTypeAtLocation(node: NativeNode): NativeType;
    getBaseConstraintOfType(type: NativeType): NativeType | undefined;
  };
}
interface NativeSnapshot {
  update(changes: { openFiles: string[] }): NativeSnapshot;
  getDefaultProjectForFile(fileName: string): NativeProject | undefined;
  dispose(): void;
}
interface NativeSync {
  API: new () => {
    createSnapshot(changes: { openFiles: string[] }): NativeSnapshot;
  };
  TypeFlags: Record<TypeFlagName, number>;
}
interface NativeAst {
  getTokenAtPosition(file: NativeNode, position: number): NativeNode;
  getTokenPosOfNode(node: NativeNode, file: NativeNode): number;
}
type NativeTypeScript = { sync: NativeSync; ast: NativeAst };

// One compiler process per TypeScript copy, holding every file opened so far.
const nativeSessions = new Map<
  NativeSync,
  {
    api: InstanceType<NativeSync['API']>;
    snapshot?: NativeSnapshot;
    open: Set<string>;
  }
>();

function getNativeType(
  { sync, ast }: NativeTypeScript,
  fileName: string,
  start: number,
  end: number
): CheckedType | undefined {
  let session = nativeSessions.get(sync);
  if (!session) {
    session = { api: new sync.API(), open: new Set() };
    nativeSessions.set(sync, session);
  }
  if (!session.open.has(fileName)) {
    session.open.add(fileName);
    // Opening a file finds its project the way the editor does, references included.
    const previous = session.snapshot;
    session.snapshot = previous
      ? previous.update({ openFiles: [fileName] })
      : session.api.createSnapshot({ openFiles: [fileName] });
    previous?.dispose();
  }
  const project = session.snapshot!.getDefaultProjectForFile(fileName);
  const sourceFile = project?.program.getSourceFile(fileName);
  if (!project || !sourceFile) return;
  let node: NativeNode | undefined = ast.getTokenAtPosition(sourceFile, start);
  while (
    node &&
    !(ast.getTokenPosOfNode(node, sourceFile) === start && node.end === end)
  ) {
    node = node.parent;
  }
  if (!node) return;
  const wrap = (type: NativeType): CheckedType => ({
    is: (...flags) => flags.some((flag) => type.flags & sync.TypeFlags[flag]),
    stringValue: type.isStringLiteralType()
      ? (type.value as string)
      : undefined,
    unionTypes: () =>
      type.isUnionType() ? type.getTypes().map(wrap) : undefined,
    intersectionTypes: () =>
      type.isIntersectionType() ? type.getTypes().map(wrap) : undefined,
    constraint: () => {
      const constraint = project.checker.getBaseConstraintOfType(type);
      return constraint && wrap(constraint);
    },
    symbolName: () => type.getSymbol()?.name,
  });
  return wrap(project.checker.getTypeAtLocation(node));
}
