# Python Extractor - Detailed Implementation Plan

This file captures the full implementation plan for the `@generaltranslation/python-extractor` package internals.
To be used when implementing the actual extraction logic after the skeleton is in place.

---

## Parser (`src/parser.ts`)
- Use `tree-sitter` + `tree-sitter-python` npm packages
- Lazy-init a singleton `Parser` instance
- Export `parsePython(sourceCode: string): Parser.Tree`
- **Note:** If native tree-sitter causes CI build issues, fall back to `web-tree-sitter` (WASM-based). Verify AST node type names empirically against the grammar.

## Import Extraction (`src/extractImports.ts`)
- Walk AST for `import_from_statement` nodes
- Check if module name matches `PYTHON_GT_PACKAGES` (`gt_flask`, `gt_fastapi`)
- Track aliased imports (`from gt_flask import t as translate`)
- Return `ImportAlias[]` with `{ localName, packageName }`

### tree-sitter AST structure for imports
`from gt_flask import t as translate` parses as:
```
import_from_statement
  module_name: dotted_name "gt_flask"
  name: aliased_import
    name: identifier "t"
    alias: identifier "translate"
```

## Call Extraction (`src/extractCalls.ts`)
- Walk AST for `call` nodes where function name is in the tracked local names
- First positional arg must be a string literal (reject f-strings/expressions as errors)
- Extract `_id`, `_context`, `_maxChars` from keyword arguments
- Return `{ calls: RawTranslationCall[], errors: string[] }`

### tree-sitter AST structure for t() calls
`t("Hello world", _id="greeting", _context="casual")` parses as:
```
call
  function: identifier "t"
  arguments: argument_list
    string "Hello world"
    keyword_argument
      name: identifier "_id"
      value: string "greeting"
    keyword_argument
      name: identifier "_context"
      value: string "casual"
```

### RawTranslationCall type
```typescript
type RawTranslationCall = {
  source: string;
  id?: string;
  context?: string;
  maxChars?: number;
  line: number;    // 1-based, for error reporting
  column: number;
};
```

### String value extraction
- tree-sitter-python string nodes include quotes
- Content is in `string_content` child nodes
- Fallback: strip quotes manually with `.slice(1, -1)`
- F-strings should be rejected as errors (non-static content)

## Main Entry (`src/index.ts`)
```typescript
export function extractFromPythonSource(
  sourceCode: string,
  filePath: string
): { results: ExtractionResult[]; errors: string[] }
```
Pipeline: parse → extract imports → if no GT imports return early → extract calls → map to ExtractionResult[]

## Test Strategy

### Test files needed
- `fixtures/simple.py` - basic `t()` calls
- `fixtures/aliased_import.py` - `from gt_flask import t as translate`
- `fixtures/kwargs_metadata.py` - `t("msg", _id="x", _context="y", _maxChars=50)`
- `fixtures/no_gt_imports.py` - file without GT imports
- `fixtures/mixed_imports.py` - GT + non-GT imports
- `fixtures/multiple_calls.py` - many `t()` calls in one file
- `fixtures/fastapi.py` - `from gt_fastapi import t`

### Test cases
1. Simple `t()` calls → correct source string extracted
2. Metadata kwargs → id, context, maxChars populated
3. Aliased imports → still tracks calls correctly
4. No GT imports → empty results, no errors
5. Non-static strings (f-strings, variables) → errors reported
6. Multiple calls in one file → all extracted
7. gt_fastapi imports → works same as gt_flask

## Phase 2 (Future)
- `declare_static` / `declare_var` support (named `declare_static` / `declare_var` in Python)
- `msg()` function support
- More complex import patterns (e.g., `import gt_flask` then `gt_flask.t()`)
