import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// Editors suggest object keys from select's parameter type, so this pins what
// the TypeScript language service offers while branches are typed.
const unstable = path.resolve(import.meta.dirname, '../../unstable.ts');
const header = `import { select } from ${JSON.stringify(unstable)};
declare const role: 'admin' | 'user';
declare const who: string;
declare const scope: 'admin' | 'other';
enum Status { Done = 'done', Open = 'open' }
declare const status: Status;
export const message = `;

const file = path.join(import.meta.dirname, '__select-completions__.ts');
const options: ts.CompilerOptions = {
  strict: true,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  target: ts.ScriptTarget.ES2022,
  noEmit: true,
  skipLibCheck: true,
};
let code = '';
let version = 0;
// One service for every case, so TypeScript parses the libraries only once.
const service = ts.createLanguageService({
  getScriptFileNames: () => [file],
  getScriptVersion: (name) => (name === file ? String(version) : '1'),
  getScriptSnapshot: (name) => {
    const text = name === file ? code : ts.sys.readFile(name);
    return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
  },
  getCurrentDirectory: () => import.meta.dirname,
  getCompilationSettings: () => options,
  getDefaultLibFileName: ts.getDefaultLibFilePath,
  fileExists: (name) => name === file || ts.sys.fileExists(name),
  readFile: (name) => (name === file ? code : ts.sys.readFile(name)),
  readDirectory: ts.sys.readDirectory,
  directoryExists: ts.sys.directoryExists,
  getDirectories: ts.sys.getDirectories,
});

function suggestedEntries(call: string): ts.CompletionEntry[] {
  code = header + call.replaceAll('|', '');
  version += 1;
  const completions = service.getCompletionsAtPosition(
    file,
    header.length + call.indexOf('|'),
    {}
  );
  return (completions?.entries ?? []).filter(
    (entry) => entry.kind === ts.ScriptElementKind.memberVariableElement
  );
}

function suggestedKeys(call: string): string[] {
  return suggestedEntries(call)
    .map((entry) => entry.name)
    .sort();
}

describe('select branch key completions', () => {
  it.each([
    [
      'a finite union, where other may cover any value',
      'select(role, { | })',
      ['admin', 'other', 'user'],
    ],
    [
      'a union after one value, where other may cover the rest',
      "select(role, { admin: 'A', | })",
      ['other', 'user'],
    ],
    [
      'a union after every value, where other would never be used',
      "select(role, { admin: 'A', user: 'U', | })",
      [],
    ],
    [
      'a union after other',
      "select(role, { other: 'O', | })",
      ['admin', 'user'],
    ],
    ['a named union', 'select({ role }, { | })', ['admin', 'other', 'user']],
    [
      'a named union after one value',
      "select({ role }, { admin: 'A', | })",
      ['other', 'user'],
    ],
    [
      'a union whose values include other',
      'select(scope, { | })',
      ['admin', 'other'],
    ],
    ['any string', 'select(who, { | })', ['other']],
    ['a string enum', 'select(status, { | })', ['done', 'open', 'other']],
    [
      'a string enum, by value',
      "select(status, { done: 'D', | })",
      ['open', 'other'],
    ],
  ])(
    'suggests the keys still valid for %s',
    (_name, call, keys) => {
      expect(suggestedKeys(call)).toEqual(keys);
    },
    20_000
  );

  it.each([
    ['optional while values are missing', 'select(role, { | })', true],
    ['required when other is a value', 'select(scope, { | })', false],
  ])(
    'marks other as %s',
    (_name, call, optional) => {
      const other = suggestedEntries(call).find(
        (entry) => entry.name === 'other'
      );
      expect(other?.kindModifiers?.includes('optional')).toBe(optional);
    },
    20_000
  );
});
