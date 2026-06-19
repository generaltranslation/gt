import { afterAll, describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { disposeParser } from '../parser.js';
import {
  extractFromPythonSource,
  PYTHON_GT_PACKAGES,
  PYTHON_GT_DEPENDENCIES,
  PYTHON_T_FUNCTION,
  PYTHON_DERIVE,
  PYTHON_DECLARE_VAR,
  PYTHON_METADATA_KWARGS,
} from '../index.js';
import type { ExtractionResult, ExtractionMetadata } from '../types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) =>
  fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

afterAll(async () => {
  await disposeParser();
});

describe('python-extractor', () => {
  describe('extractFromPythonSource', () => {
    it('extracts simple t() calls', async () => {
      const { results, errors } = await extractFromPythonSource(
        fixture('simple.py'),
        'simple.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(2);
      expect(results[0].source).toBe('Hello world');
      expect(results[0].dataFormat).toBe('ICU');
      expect(results[1].source).toBe('Goodbye');
    });

    it('handles aliased imports', async () => {
      const { results, errors } = await extractFromPythonSource(
        fixture('aliased_import.py'),
        'aliased_import.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('Hello world');
    });

    it('extracts metadata kwargs (_id, _context, _maxChars)', async () => {
      const { results, errors } = await extractFromPythonSource(
        fixture('kwargs_metadata.py'),
        'kwargs_metadata.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('Hello');
      expect(results[0].metadata.id).toBe('greeting');
      expect(results[0].metadata.context).toBe('casual');
      expect(results[0].metadata.maxChars).toBe(50);
    });

    it('returns empty results for files without GT imports', async () => {
      const { results, errors } = await extractFromPythonSource(
        fixture('no_gt_imports.py'),
        'no_gt_imports.py'
      );
      expect(errors).toEqual([]);
      expect(results).toEqual([]);
    });

    it('only extracts GT calls in files with mixed imports', async () => {
      const { results, errors } = await extractFromPythonSource(
        fixture('mixed_imports.py'),
        'mixed_imports.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('Hello from Flask');
    });

    it('extracts multiple calls from one file', async () => {
      const { results, errors } = await extractFromPythonSource(
        fixture('multiple_calls.py'),
        'multiple_calls.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(4);
      expect(results.map((r) => r.source)).toEqual([
        'First',
        'Second',
        'Third',
        'Fourth',
      ]);
      expect(results[3].metadata.id).toBe('fourth');
      expect(results[3].metadata.context).toBe('test');
    });

    it('works with gt_fastapi imports', async () => {
      const { results, errors } = await extractFromPythonSource(
        fixture('fastapi.py'),
        'fastapi.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('Hello from FastAPI');
    });

    it('reports errors for f-strings and non-static content', async () => {
      const { results, errors } = await extractFromPythonSource(
        fixture('errors.py'),
        'errors.py'
      );
      // Should still extract the valid string
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('Valid string');

      // Should report errors for f-string and variable
      expect(errors).toHaveLength(2);
      expect(errors[0]).toContain('f-string');
      expect(errors[1]).toContain('variable');
    });

    it('handles multiple function imports (t, msg)', async () => {
      const { results, errors } = await extractFromPythonSource(
        fixture('multi_import.py'),
        'multi_import.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(2);
      expect(results[0].source).toBe('From t function');
      expect(results[1].source).toBe('From msg function');
    });

    it('includes filePaths in metadata', async () => {
      const { results } = await extractFromPythonSource(
        fixture('simple.py'),
        'app/routes.py'
      );
      expect(results[0].metadata.filePaths).toEqual(['app/routes.py']);
    });

    it('handles empty source code', async () => {
      const { results, errors } = await extractFromPythonSource('', 'empty.py');
      expect(results).toEqual([]);
      expect(errors).toEqual([]);
    });

    it('handles single-quoted strings', async () => {
      const { results, errors } = await extractFromPythonSource(
        `from gt_flask import t\nt('single quoted')`,
        'test.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('single quoted');
    });

    it('handles triple-quoted strings', async () => {
      const { results, errors } = await extractFromPythonSource(
        `from gt_flask import t\nt("""triple quoted""")`,
        'test.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('triple quoted');
    });

    it('handles empty strings', async () => {
      const { results, errors } = await extractFromPythonSource(
        `from gt_flask import t\nt("")`,
        'test.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('');
    });

    it('ignores non-translation GT imports like initialize_gt', async () => {
      const code = `from gt_fastapi import t, initialize_gt, get_locale as get_locale_gt
from fastapi import FastAPI

app = FastAPI()

initialize_gt(
    app,
    load_translations=load_translations,
    get_locale=get_locale,
)

get_locale_gt()
t("Hello, world!")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'main.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('Hello, world!');
    });

    it('extracts _max_chars with snake_case kwarg', async () => {
      const code = `from gt_flask import t\nt("Hello", _max_chars=10)`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(1);
      expect(results[0].metadata.maxChars).toBe(10);
    });
  });

  // ===== derive() tests ===== //

  describe('derive', () => {
    it('expands simple ternary into 2 variants', async () => {
      const { results } = await extractFromPythonSource(
        fixture('derive_ternary.py'),
        'test.py'
      );
      const ternaryResults = results.filter(
        (r) => r.source === 'It is day!' || r.source === 'It is night!'
      );
      expect(ternaryResults).toHaveLength(2);
      expect(ternaryResults[0].metadata.staticId).toBeDefined();
      expect(ternaryResults[0].metadata.staticId).toBe(
        ternaryResults[1].metadata.staticId
      );
    });

    it('expands nested ternary into 3 variants', async () => {
      const { results } = await extractFromPythonSource(
        fixture('derive_ternary.py'),
        'test.py'
      );
      const nestedResults = results.filter(
        (r) => r.source === 'a' || r.source === 'b' || r.source === 'c'
      );
      expect(nestedResults).toHaveLength(3);
      const staticId = nestedResults[0].metadata.staticId;
      expect(staticId).toBeDefined();
      expect(nestedResults.every((r) => r.metadata.staticId === staticId)).toBe(
        true
      );
    });

    it('handles plain string in derive', async () => {
      const { results } = await extractFromPythonSource(
        fixture('derive_ternary.py'),
        'test.py'
      );
      const plainResult = results.find((r) => r.source === 'Hello world!');
      expect(plainResult).toBeDefined();
      expect(plainResult!.metadata.staticId).toBeDefined();
    });

    it('resolves local function returns in derive', async () => {
      const { results, errors } = await extractFromPythonSource(
        fixture('derive_func.py'),
        'test.py'
      );
      expect(errors).toEqual([]);
      const morningResult = results.find((r) => r.source === 'It is morning!');
      const eveningResult = results.find((r) => r.source === 'It is evening!');
      expect(morningResult).toBeDefined();
      expect(eveningResult).toBeDefined();
      expect(morningResult!.metadata.staticId).toBe(
        eveningResult!.metadata.staticId
      );
    });

    it('handles concatenation with derive', async () => {
      const { results } = await extractFromPythonSource(
        fixture('derive_concat.py'),
        'test.py'
      );
      const concatResults = results.filter(
        (r) => r.source === 'Hello day!' || r.source === 'Hello night!'
      );
      expect(concatResults).toHaveLength(2);
      expect(concatResults[0].metadata.staticId).toBe(
        concatResults[1].metadata.staticId
      );
    });

    it('handles string concatenation inside derive', async () => {
      const { results, errors } = await extractFromPythonSource(
        fixture('derive_string_concat.py'),
        'test.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('Hello, ab!');
      expect(results[0].metadata.staticId).toBeDefined();
    });

    it('resolves single-return function in derive', async () => {
      const { results, errors } = await extractFromPythonSource(
        fixture('derive_func_simple.py'),
        'test.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('Hello, !!');
      expect(results[0].metadata.staticId).toBeDefined();
    });

    it('preserves metadata kwargs with derive', async () => {
      const code = `from gt_flask import t, derive
t(f"It is {derive('day' if x else 'night')}", _id="time_msg", _context="greeting")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(2);
      for (const r of results) {
        expect(r.metadata.id).toBe('time_msg');
        expect(r.metadata.context).toBe('greeting');
        expect(r.metadata.staticId).toBeDefined();
      }
    });

    it('handles parenthesized expression wrapping derive concat', async () => {
      const code = `from gt_flask import t, derive
t(("hello " + derive("world")))`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('hello world');
      expect(results[0].metadata.staticId).toBeDefined();
    });

    it('handles derive with declare_var nested directly', async () => {
      const code = `from gt_flask import t, derive, declare_var
t(f"Hello, {derive(declare_var(name) + '!')}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('Hello, {_gt_1, select, other {}}!');
    });

    it('handles aliased derive import', async () => {
      const code = `from gt_fastapi import t, derive as d
t(f"The {d('he' if x else 'she')}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(2);
      const sources = results.map((r) => r.source).sort();
      expect(sources).toEqual(['The he', 'The she']);
    });

    it('works with re-exports using derive', async () => {
      const code = `from gt_fastapi import t, derive
from reexport_funcs import get_gender
t(f"The {derive(get_gender(variant))}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        path.join(__dirname, 'fixtures', 'reexport_main.py')
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(2);
      const sources = results.map((r) => r.source).sort();
      expect(sources).toEqual(['The he', 'The she']);
    });
  });

  // ===== derive in context tests ===== //

  describe('derive in context', () => {
    it('should produce 2 results when _context uses derive with ternary', async () => {
      const { results, errors } = await extractFromPythonSource(
        fixture('derive_context_ternary.py'),
        'derive_context_ternary.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(2);

      // Both results should have the same source
      expect(results[0].source).toBe('Hello');
      expect(results[1].source).toBe('Hello');

      // Contexts should be the two ternary branches
      const contexts = results.map((r) => r.metadata.context).sort();
      expect(contexts).toEqual(['casual', 'formal']);

      // Both should share the same staticId
      expect(results[0].metadata.staticId).toBeDefined();
      expect(results[0].metadata.staticId).toBe(results[1].metadata.staticId);
    });

    it('should produce cross-product when both content and context use derive', async () => {
      const { results, errors } = await extractFromPythonSource(
        fixture('derive_context_cross_product.py'),
        path.join(__dirname, 'fixtures', 'derive_context_cross_product.py')
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(4);

      const pairs = results
        .map((r) => `${r.source}|${r.metadata.context}`)
        .sort();
      expect(pairs).toEqual([
        'It is day!|casual',
        'It is day!|formal',
        'It is night!|casual',
        'It is night!|formal',
      ]);

      // All 4 should share the same staticId
      const staticId = results[0].metadata.staticId;
      expect(staticId).toBeDefined();
      expect(results.every((r) => r.metadata.staticId === staticId)).toBe(true);
    });

    it('should produce 2 results with inline ternary context', async () => {
      const code = `from gt_flask import t, derive\nt("Hello", _context=derive("formal" if x else "casual"))`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(2);

      const contexts = results.map((r) => r.metadata.context).sort();
      expect(contexts).toEqual(['casual', 'formal']);

      expect(results[0].source).toBe('Hello');
      expect(results[1].source).toBe('Hello');
    });

    it('should handle derive in context via string concatenation', async () => {
      const code = `from gt_flask import t, derive\nt("Hello", _context="prefix-" + derive("formal" if x else "casual"))`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(2);

      const contexts = results.map((r) => r.metadata.context).sort();
      expect(contexts).toEqual(['prefix-casual', 'prefix-formal']);
    });

    it('should handle derive in context via f-string', async () => {
      const code = `from gt_flask import t, derive\nt("Hello", _context=f"prefix-{derive('formal' if x else 'casual')}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(2);

      const contexts = results.map((r) => r.metadata.context).sort();
      expect(contexts).toEqual(['prefix-casual', 'prefix-formal']);
    });

    it('should preserve unrelated kwarg errors when derive context resolves', async () => {
      const code = `from gt_flask import t, derive\nt("Hello", _context=derive("formal" if x else "casual"), _max_chars=some_var)`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      // Context should resolve to 2 variants
      expect(results).toHaveLength(2);
      // But _max_chars error should NOT be silently discarded
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes('_max_chars'))).toBe(true);
    });

    it('should still work with static _context (regression)', async () => {
      const code = `from gt_flask import t\nt("Hello", _context="greeting")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('Hello');
      expect(results[0].metadata.context).toBe('greeting');
    });
  });

  // ===== derive tests ===== //

  describe('derive', () => {
    it('expands simple ternary into 2 variants', async () => {
      const { results } = await extractFromPythonSource(
        fixture('derive_ternary.py'),
        'test.py'
      );
      // First call: t(f"It is {derive('day' if is_day() else 'night')}!")
      const ternaryResults = results.filter(
        (r) => r.source === 'It is day!' || r.source === 'It is night!'
      );
      expect(ternaryResults).toHaveLength(2);
      expect(ternaryResults[0].metadata.staticId).toBeDefined();
      expect(ternaryResults[0].metadata.staticId).toBe(
        ternaryResults[1].metadata.staticId
      );
    });

    it('expands nested ternary into 3 variants', async () => {
      const { results } = await extractFromPythonSource(
        fixture('derive_ternary.py'),
        'test.py'
      );
      const nestedResults = results.filter(
        (r) => r.source === 'a' || r.source === 'b' || r.source === 'c'
      );
      expect(nestedResults).toHaveLength(3);
      const staticId = nestedResults[0].metadata.staticId;
      expect(staticId).toBeDefined();
      expect(nestedResults.every((r) => r.metadata.staticId === staticId)).toBe(
        true
      );
    });

    it('handles plain string in derive', async () => {
      const { results } = await extractFromPythonSource(
        fixture('derive_ternary.py'),
        'test.py'
      );
      const plainResult = results.find((r) => r.source === 'Hello world!');
      expect(plainResult).toBeDefined();
      expect(plainResult!.metadata.staticId).toBeDefined();
    });

    it('resolves local function returns in derive', async () => {
      const { results, errors } = await extractFromPythonSource(
        fixture('derive_func.py'),
        'test.py'
      );
      expect(errors).toEqual([]);
      const morningResult = results.find((r) => r.source === 'It is morning!');
      const eveningResult = results.find((r) => r.source === 'It is evening!');
      expect(morningResult).toBeDefined();
      expect(eveningResult).toBeDefined();
      expect(morningResult!.metadata.staticId).toBe(
        eveningResult!.metadata.staticId
      );
    });

    it('resolves cross-file function in derive', async () => {
      const code = `from gt_flask import t, derive
from derive_helper import get_time
t(f"It is {derive(get_time())}!")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        path.join(__dirname, 'fixtures', 'derive_crossfile.py')
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(2);
      const sources = results.map((r) => r.source).sort();
      expect(sources).toEqual(['It is evening!', 'It is morning!']);
      expect(results[0].metadata.staticId).toBe(results[1].metadata.staticId);
    });

    it('handles concatenation with derive', async () => {
      const { results } = await extractFromPythonSource(
        fixture('derive_concat.py'),
        'test.py'
      );
      // t("Hello " + derive("day" if x else "night") + "!")
      const concatResults = results.filter(
        (r) => r.source === 'Hello day!' || r.source === 'Hello night!'
      );
      expect(concatResults).toHaveLength(2);
      expect(concatResults[0].metadata.staticId).toBe(
        concatResults[1].metadata.staticId
      );
    });

    it('produces cartesian product for multiple derives', async () => {
      const { results, errors } = await extractFromPythonSource(
        fixture('declare_cartesian.py'),
        'test.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(4);
      const sources = results.map((r) => r.source).sort();
      expect(sources).toEqual([
        'bad day',
        'bad night',
        'good day',
        'good night',
      ]);
      // All share the same staticId
      const staticId = results[0].metadata.staticId;
      expect(staticId).toBeDefined();
      expect(results.every((r) => r.metadata.staticId === staticId)).toBe(true);
    });

    it('preserves metadata kwargs with derive', async () => {
      const code = `from gt_flask import t, derive
t(f"It is {derive('day' if x else 'night')}", _id="time_msg", _context="greeting")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(2);
      for (const r of results) {
        expect(r.metadata.id).toBe('time_msg');
        expect(r.metadata.context).toBe('greeting');
        expect(r.metadata.staticId).toBeDefined();
      }
    });

    it('simple t() still works without staticId', async () => {
      const code = `from gt_flask import t\nt("Hello world")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('Hello world');
      expect(results[0].metadata.staticId).toBeUndefined();
    });

    it('handles string concatenation inside derive', async () => {
      const { results, errors } = await extractFromPythonSource(
        fixture('derive_string_concat.py'),
        'test.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('Hello, ab!');
      expect(results[0].metadata.staticId).toBeDefined();
    });

    it('resolves single-return function in derive', async () => {
      const { results, errors } = await extractFromPythonSource(
        fixture('derive_func_simple.py'),
        'test.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('Hello, !!');
      expect(results[0].metadata.staticId).toBeDefined();
    });

    it('resolves function returning declare_var + concat in derive', async () => {
      const { results, errors } = await extractFromPythonSource(
        fixture('declare_var_in_func_only.py'),
        'test.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(1);
      // Function returns: declare_var(name) + '!'
      // → {_gt_, select, other {}} + "!" → sequence
      // After indexVars: {_gt_1, select, other {}}
      expect(results[0].source).toBe('Hello, {_gt_1, select, other {}}!!');
      expect(results[0].metadata.staticId).toBeDefined();
    });

    it('resolves function with declare_var in ternary with derive', async () => {
      const { results, errors } = await extractFromPythonSource(
        fixture('declare_var_in_func.py'),
        'test.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(2);
      const sources = results.map((r) => r.source).sort();
      // Branch 1: get_name() → declare_var(name) + '!' → "{_gt_, select, other {}}!"
      // Branch 2: 'fallback'
      // After indexVars on branch 1: "{_gt_1, select, other {}}!"
      expect(sources).toEqual([
        'Hello, fallback!',
        'Hello, {_gt_1, select, other {}}!!',
      ]);
      expect(results[0].metadata.staticId).toBe(results[1].metadata.staticId);
    });

    it('handles parenthesized expression wrapping static concat', async () => {
      // t(("hello " + derive("world"))) — first arg is parenthesized_expression
      const code = `from gt_flask import t, derive
t(("hello " + derive("world")))`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('hello world');
      expect(results[0].metadata.staticId).toBeDefined();
    });

    it('handles parenthesized expression wrapping static ternary', async () => {
      const code = `from gt_flask import t, derive
t((derive("day" if x else "night")))`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(2);
      const sources = results.map((r) => r.source).sort();
      expect(sources).toEqual(['day', 'night']);
    });

    it('handles deeply nested parentheses around static expression', async () => {
      const code = `from gt_flask import t, derive
t((((("hello " + derive("day" if x else "night"))))))`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(2);
      const sources = results.map((r) => r.source).sort();
      expect(sources).toEqual(['hello day', 'hello night']);
    });

    it('handles derive with inline concat of ternary + string', async () => {
      const code = `from gt_flask import t, derive
t(f"Result: {derive(('yes' if x else 'no') + '!')}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(2);
      const sources = results.map((r) => r.source).sort();
      expect(sources).toEqual(['Result: no!', 'Result: yes!']);
    });

    it('handles derive with declare_var nested directly', async () => {
      const code = `from gt_flask import t, derive, declare_var
t(f"Hello, {derive(declare_var(name) + '!')}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(1);
      // declare_var(name) + '!' → "{_gt_, select, other {}}" + "!" → "{_gt_, select, other {}}!"
      // Full f-string: "Hello, {_gt_, select, other {}}!"
      // After indexVars: "Hello, {_gt_1, select, other {}}!"
      expect(results[0].source).toBe('Hello, {_gt_1, select, other {}}!');
    });

    it('handles aliased imports with functions returning conditionals and declare_var', async () => {
      // This exercises:
      // - aliased derive/declare_var imports
      // - function resolution with conditional return expressions
      // - declare_var inside a function return branch
      // - cartesian product across two derive calls (2 × 2 = 4 variants)
      const { results, errors } = await extractFromPythonSource(
        fixture('declare_complex_aliased.py'),
        'test.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(4);

      const sources = results.map((r) => r.source).sort();
      expect(sources).toEqual([
        'The he is beautiful',
        'The he is {_gt_1, select, other {}}',
        'The she is beautiful',
        'The she is {_gt_1, select, other {}}',
      ]);

      // All 4 variants share the same staticId
      const staticId = results[0].metadata.staticId;
      expect(staticId).toBeDefined();
      expect(results.every((r) => r.metadata.staticId === staticId)).toBe(true);
    });
  });

  // ===== bare dot relative import tests ===== //

  describe('bare dot relative import', () => {
    it('resolves function re-exported via "from . import func" from __init__.py', async () => {
      // Scenario: a package re-exports a function via bare dot import.
      // pkg/__init__.py defines get_time()
      // pkg/reexport.py has "from . import get_time" (bare dot → __init__.py)
      // Main imports from reexport → findReExport sees moduleName='.' → null (BUG)
      const pkgDir = path.join(__dirname, 'fixtures', 'dotpkg');
      fs.mkdirSync(pkgDir, { recursive: true });
      const initFile = path.join(pkgDir, '__init__.py');
      const reexportFile = path.join(pkgDir, 'reexport.py');
      fs.writeFileSync(
        initFile,
        `def get_time():\n    if is_morning():\n        return "morning"\n    else:\n        return "evening"\n`
      );
      fs.writeFileSync(reexportFile, 'from . import get_time\n');
      try {
        const code = `from gt_flask import t, derive
from dotpkg.reexport import get_time
t(f"It is {derive(get_time())}!")`;
        const { results, errors } = await extractFromPythonSource(
          code,
          path.join(__dirname, 'fixtures', 'test_dot_import.py')
        );
        expect(errors).toEqual([]);
        expect(results).toHaveLength(2);
        const sources = results.map((r) => r.source).sort();
        expect(sources).toEqual(['It is evening!', 'It is morning!']);
      } finally {
        fs.rmSync(pkgDir, { recursive: true });
      }
    });
  });

  // ===== re-export tests ===== //

  describe('re-exports', () => {
    it('follows single-level re-export to resolve functions', async () => {
      // main imports get_gender from reexport_funcs.py,
      // which re-exports from static_test_defs.py where it's defined
      const code = `from gt_fastapi import t, derive as alias_derive
from reexport_funcs import get_gender
t(f"The {alias_derive(get_gender(variant))}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        path.join(__dirname, 'fixtures', 'reexport_main.py')
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(2);
      const sources = results.map((r) => r.source).sort();
      expect(sources).toEqual(['The he', 'The she']);
    });

    it('follows re-export with declare_var in the definition file', async () => {
      // get_adjective is defined in static_test_defs.py with alias_declare_var,
      // re-exported through reexport_funcs.py
      const code = `from gt_fastapi import t, derive as alias_derive
from reexport_funcs import get_adjective
t(f"She is {alias_derive(get_adjective(variant))}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        path.join(__dirname, 'fixtures', 'reexport_main.py')
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(2);
      const sources = results.map((r) => r.source).sort();
      expect(sources).toEqual([
        'She is beautiful',
        'She is {_gt_1, select, other {}}',
      ]);
    });

    it('follows two-level re-export chain', async () => {
      // main → reexport_chain_top → reexport_chain_mid → static_test_defs
      const code = `from gt_fastapi import t, derive as alias_derive
from reexport_chain_top import get_gender
t(f"The {alias_derive(get_gender(variant))}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        path.join(__dirname, 'fixtures', 'reexport_chain_main.py')
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(2);
      const sources = results.map((r) => r.source).sort();
      expect(sources).toEqual(['The he', 'The she']);
    });

    it('handles full complex re-export scenario with cartesian product', async () => {
      // The exact user scenario: main imports from reexport_funcs,
      // definitions in static_test_defs with aliased declare_var
      const code = `from gt_fastapi import t, derive as alias_derive
from reexport_funcs import get_gender, get_adjective

def get_string(variant):
    return t(f'The {alias_derive(get_gender(variant))} is {alias_derive(get_adjective(variant))}')`;
      const { results, errors } = await extractFromPythonSource(
        code,
        path.join(__dirname, 'fixtures', 'reexport_main.py')
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(4);
      const sources = results.map((r) => r.source).sort();
      expect(sources).toEqual([
        'The he is beautiful',
        'The he is {_gt_1, select, other {}}',
        'The she is beautiful',
        'The she is {_gt_1, select, other {}}',
      ]);
      const staticId = results[0].metadata.staticId;
      expect(staticId).toBeDefined();
      expect(results.every((r) => r.metadata.staticId === staticId)).toBe(true);
    });

    it('handles re-export with aliased name', async () => {
      // Import with alias in re-export: from static_test_defs import get_gender as gg
      const code = `from gt_fastapi import t, derive
from reexport_alias import gg
t(f"{derive(gg(v))}")`;
      // Create aliased re-export inline
      const aliasReexportPath = path.join(
        __dirname,
        'fixtures',
        'reexport_alias.py'
      );
      fs.writeFileSync(
        aliasReexportPath,
        'from static_test_defs import get_gender as gg\n'
      );
      try {
        const { results, errors } = await extractFromPythonSource(
          code,
          path.join(__dirname, 'fixtures', 'reexport_alias_main.py')
        );
        expect(errors).toEqual([]);
        expect(results).toHaveLength(2);
        const sources = results.map((r) => r.source).sort();
        expect(sources).toEqual(['he', 'she']);
      } finally {
        fs.unlinkSync(aliasReexportPath);
      }
    });
  });

  // ===== declare_var tests ===== //

  describe('declare_var', () => {
    it('produces ICU placeholder for basic declare_var', async () => {
      const code = `from gt_flask import t, declare_var
t(f"Hello {declare_var(name)}!")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(1);
      // declareVar('') → {_gt_, select, other {}}
      // indexVars → {_gt_1, select, other {}}
      expect(results[0].source).toBe('Hello {_gt_1, select, other {}}!');
      expect(results[0].metadata.staticId).toBeDefined();
    });

    it('produces ICU placeholder with _name kwarg', async () => {
      const code = `from gt_flask import t, declare_var
t(f"Hello {declare_var(name, _name='user')}!")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe(
        'Hello {_gt_1, select, other {} _gt_var_name {user}}!'
      );
    });
  });

  // ===== mixed derive + declare_var tests ===== //

  describe('mixed derive + declare_var', () => {
    it('combines static variants with var placeholders', async () => {
      const { results, errors } = await extractFromPythonSource(
        fixture('declare_mixed.py'),
        'test.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(2);
      const sources = results.map((r) => r.source).sort();
      // "day for {_gt_, select, other {}}" and "night for {_gt_, select, other {}}"
      // After indexVars: {_gt_1, select, other {}}
      expect(sources).toEqual([
        'day for {_gt_1, select, other {}}',
        'night for {_gt_1, select, other {}}',
      ]);
      expect(results[0].metadata.staticId).toBe(results[1].metadata.staticId);
    });
  });

  // ===== resolveStaticBinaryOperator edge cases ===== //

  describe('static binary operator with unusual operand types', () => {
    it('handles subscript operand in derive concat', async () => {
      // obj["key"] + "!" inside derive — subscript handler tries to
      // resolve obj as a dictionary but can't find it
      const code = `from gt_flask import t, derive
t(f"{derive(obj['key'] + '!')}")`;
      const { errors } = await extractFromPythonSource(code, 'test.py');
      expect(errors.length).toBeGreaterThan(0);
      // Should complain about the subscript/dictionary, NOT the operator
      expect(errors.join(' ')).not.toContain('unsupported binary operator');
      expect(errors.join(' ')).toContain('dictionary');
    });

    it('handles attribute operand in derive concat', async () => {
      // obj.attr + "!" inside derive — attribute handler tries to
      // resolve obj as a dictionary but can't find it
      const code = `from gt_flask import t, derive
t(f"{derive(obj.attr + '!')}")`;
      const { errors } = await extractFromPythonSource(code, 'test.py');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.join(' ')).not.toContain('unsupported binary operator');
      expect(errors.join(' ')).toContain('dictionary');
    });

    it('correctly rejects non-plus operator in static context', async () => {
      // * operator should mention the operator in the error
      const code = `from gt_flask import t, derive
t(f"{derive('a' * 3)}")`;
      const { errors } = await extractFromPythonSource(code, 'test.py');
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  // ===== identifier resolution ===== //

  describe('identifier resolution', () => {
    it('resolves constant string identifier', async () => {
      const code = `from gt_flask import t, derive
GREETING = "hello"
t(f"{derive(GREETING)}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('hello');
    });

    it('resolves chained constant assignment', async () => {
      const code = `from gt_flask import t, derive
A = "hi"
B = A
t(f"{derive(B)}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('hi');
    });

    it('resolves constant in template', async () => {
      const code = `from gt_flask import t, derive
PREFIX = "Hello"
t(f"{derive(PREFIX)} world")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('Hello world');
    });

    it('errors on unresolvable identifier', async () => {
      const code = `from gt_flask import t, derive
t(f"{derive(NONEXISTENT)}")`;
      const { errors } = await extractFromPythonSource(code, 'test.py');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.join(' ')).toContain('identifier');
    });
  });

  // ===== dictionary access ===== //

  describe('dictionary access', () => {
    it('extracts all dict values with subscript', async () => {
      const code = `from gt_flask import t, derive
LABELS = {0: "Bad", 1: "OK", 2: "Good"}
t(f"{derive(LABELS[score])}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(3);
      const sources = results.map((r: unknown) => r.source).sort();
      expect(sources).toEqual(['Bad', 'Good', 'OK']);
    });

    it('handles dict with conditional values', async () => {
      const code = `from gt_flask import t, derive
LABELS = {0: "x" if cond else "y", 1: "z"}
t(f"{derive(LABELS[k])}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(3);
      const sources = results.map((r: unknown) => r.source).sort();
      expect(sources).toEqual(['x', 'y', 'z']);
    });

    it('handles dict in f-string template', async () => {
      const code = `from gt_flask import t, derive
LABELS = {0: "Bad", 1: "Good"}
t(f"Score: {derive(LABELS[s])}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(2);
      const sources = results.map((r: unknown) => r.source).sort();
      expect(sources).toEqual(['Score: Bad', 'Score: Good']);
    });

    it('errors on empty dict', async () => {
      const code = `from gt_flask import t, derive
LABELS = {}
t(f"{derive(LABELS[k])}")`;
      const { errors } = await extractFromPythonSource(code, 'test.py');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('resolves chained subscript access', async () => {
      const code = `from gt_flask import t, derive
LABELS = {0: {"a": "x"}}
t(f"{derive(LABELS[k]["a"])}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('x');
    });
  });

  // ===== infinite recursion guard ===== //

  describe('infinite recursion guard', () => {
    it('handles circular variable references without hanging', async () => {
      const code = `from gt_flask import t, derive
x = y
y = x
t(f"{derive(x)}")`;
      const { errors } = await extractFromPythonSource(code, 'test.py');
      expect(errors.length).toBeGreaterThan(0);
    }, 5000);

    it('handles self-referencing variable without hanging', async () => {
      const code = `from gt_flask import t, derive
x = x
t(f"{derive(x)}")`;
      const { errors } = await extractFromPythonSource(code, 'test.py');
      expect(errors.length).toBeGreaterThan(0);
    }, 5000);
  });

  // ===== reassignment behavior ===== //

  describe('reassignment behavior', () => {
    it('resolves first assignment for reassigned variable', async () => {
      const code = `from gt_flask import t, derive
x = "old"
x = "new"
t(f"{derive(x)}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      // Documents current behavior: findConstantAssignment returns first match
      // This is a known limitation — ideally should resolve to "new"
      if (errors.length === 0) {
        expect(results).toHaveLength(1);
        // First-match returns "old" — documenting this behavior
        expect(results[0].source).toBe('old');
      }
    });

    it('resolves first dict for reassigned dict', async () => {
      const code = `from gt_flask import t, derive
D = {0: "a"}
D = {0: "b"}
t(f"{derive(D[k])}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      if (errors.length === 0) {
        expect(results).toHaveLength(1);
        expect(results[0].source).toBe('a');
      }
    });
  });

  // ===== subscript edge cases ===== //

  describe('subscript edge cases', () => {
    it('resolves list subscript with static integer key', async () => {
      const code = `from gt_flask import t, derive
L = ["a", "b"]
t(f"{derive(L[0])}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('a');
    });

    it('errors on tuple subscript', async () => {
      const code = `from gt_flask import t, derive
T = ("a", "b")
t(f"{derive(T[0])}")`;
      const { errors } = await extractFromPythonSource(code, 'test.py');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.join(' ')).toContain('dictionary or list');
    });

    it('extracts values from dict with mixed key types', async () => {
      const code = `from gt_flask import t, derive
D = {0: "zero", "a": "alpha"}
t(f"{derive(D[k])}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(2);
      const sources = results.map((r: unknown) => r.source).sort();
      expect(sources).toEqual(['alpha', 'zero']);
    });
  });

  // ===== non-resolvable dict value errors ===== //

  describe('non-resolvable dict value errors', () => {
    it('errors on list value in dict (dynamic key)', async () => {
      const code = `from gt_flask import t, derive
D = {0: "Bad", 1: "OK", 2: "Good", 3: ["yyoyoo"]}
t(f"{derive(D[score])}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      // The 3 string values should still resolve
      expect(results).toHaveLength(3);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.join(' ')).toContain('unsupported derive() argument type');
    });

    it('errors on list value in dict (static key)', async () => {
      const code = `from gt_flask import t, derive
D = {"items": ["a", "b"]}
t(f"{derive(D['items'])}")`;
      const { errors } = await extractFromPythonSource(code, 'test.py');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.join(' ')).toContain('unsupported derive() argument type');
    });

    it('errors on nested dict value without further access', async () => {
      const code = `from gt_flask import t, derive
D = {"a": "ok", "b": {"nested": "value"}}
t(f"{derive(D[k])}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(results).toHaveLength(1);
      const sources = results.map((r: unknown) => r.source);
      expect(sources).toContain('ok');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.join(' ')).toContain('unsupported derive() argument type');
    });

    it('errors on tuple value in dict', async () => {
      const code = `from gt_flask import t, derive
D = {0: "ok", 1: ("a", "b")}
t(f"{derive(D[k])}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(results).toHaveLength(1);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.join(' ')).toContain('unsupported derive() argument type');
    });
  });

  // ===== identifier edge cases ===== //

  describe('identifier edge cases', () => {
    it('errors on Python builtin True in derive', async () => {
      const code = `from gt_flask import t, derive
t(f"{derive(True)}")`;
      const { errors } = await extractFromPythonSource(code, 'test.py');
      // True is tree-sitter type 'true', not 'identifier'
      expect(errors.length).toBeGreaterThan(0);
    });

    it('errors on integer literal in derive', async () => {
      const code = `from gt_flask import t, derive
t(f"{derive(42)}")`;
      const { errors } = await extractFromPythonSource(code, 'test.py');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('errors on None in derive', async () => {
      const code = `from gt_flask import t, derive
t(f"{derive(None)}")`;
      const { errors } = await extractFromPythonSource(code, 'test.py');
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  // ===== stringNode tests ===== //

  describe('stringNode', () => {
    // These are tested indirectly through the integration tests above,
    // but let's also test nodeToStrings directly
    it('nodeToStrings is importable and works', async () => {
      const { nodeToStrings } = await import('../stringNode.js');

      expect(nodeToStrings({ type: 'text', text: 'hello' })).toEqual(['hello']);

      expect(
        nodeToStrings({
          type: 'sequence',
          nodes: [
            { type: 'text', text: 'Hello ' },
            { type: 'text', text: 'world' },
          ],
        })
      ).toEqual(['Hello world']);

      expect(
        nodeToStrings({
          type: 'choice',
          nodes: [
            { type: 'text', text: 'day' },
            { type: 'text', text: 'night' },
          ],
        })
      ).toEqual(['day', 'night']);

      // Cartesian product
      expect(
        nodeToStrings({
          type: 'sequence',
          nodes: [
            {
              type: 'choice',
              nodes: [
                { type: 'text', text: 'a' },
                { type: 'text', text: 'b' },
              ],
            },
            { type: 'text', text: ' and ' },
            {
              type: 'choice',
              nodes: [
                { type: 'text', text: 'x' },
                { type: 'text', text: 'y' },
              ],
            },
          ],
        })
      ).toEqual(['a and x', 'a and y', 'b and x', 'b and y']);

      // Null
      expect(nodeToStrings(null)).toEqual([]);

      // Deduplication
      expect(
        nodeToStrings({
          type: 'choice',
          nodes: [
            { type: 'text', text: 'same' },
            { type: 'text', text: 'same' },
          ],
        })
      ).toEqual(['same']);
    });
  });

  describe('types', () => {
    it('ExtractionResult type is usable', () => {
      const result: ExtractionResult = {
        dataFormat: 'ICU',
        source: 'Hello',
        metadata: { id: 'greeting' },
      };
      expect(result.dataFormat).toBe('ICU');
      expect(result.source).toBe('Hello');
      expect(result.metadata.id).toBe('greeting');
    });

    it('ExtractionMetadata supports all optional fields', () => {
      const metadata: ExtractionMetadata = {
        id: 'test',
        context: 'casual',
        maxChars: 100,
        filePaths: ['file.py'],
        staticId: 'static-1',
      };
      expect(metadata.id).toBe('test');
      expect(metadata.context).toBe('casual');
      expect(metadata.maxChars).toBe(100);
      expect(metadata.filePaths).toEqual(['file.py']);
      expect(metadata.staticId).toBe('static-1');
    });
  });

  describe('constants', () => {
    it('exports PYTHON_GT_PACKAGES', () => {
      expect(PYTHON_GT_PACKAGES).toEqual(['gt_flask', 'gt_fastapi']);
    });

    it('exports PYTHON_GT_DEPENDENCIES', () => {
      expect(PYTHON_GT_DEPENDENCIES).toEqual(['gt-flask', 'gt-fastapi']);
    });

    it('exports PYTHON_T_FUNCTION', () => {
      expect(PYTHON_T_FUNCTION).toBe('t');
    });

    it('exports PYTHON_DERIVE', () => {
      expect(PYTHON_DERIVE).toBe('derive');
    });

    it('exports PYTHON_DECLARE_VAR', () => {
      expect(PYTHON_DECLARE_VAR).toBe('declare_var');
    });

    it('exports PYTHON_METADATA_KWARGS', () => {
      expect(PYTHON_METADATA_KWARGS).toEqual({
        _id: 'id',
        _context: 'context',
        _max_chars: 'maxChars',
      });
    });
  });

  // ===== nested dictionary access ===== //

  describe('nested dictionary access', () => {
    it('PN1: static.static subscript', async () => {
      const code = `from gt_flask import t, derive
D = {"a": {"x": "hello"}}
t(f"{derive(D['a']['x'])}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('hello');
    });

    it('PN2: computed all values from nested', async () => {
      const code = `from gt_flask import t, derive
D = {"a": {"x": "p", "y": "q"}}
t(f"{derive(D['a'][k])}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(2);
      const sources = results.map((r: unknown) => r.source).sort();
      expect(sources).toEqual(['p', 'q']);
    });

    it('PN3: outer computed, inner static', async () => {
      const code = `from gt_flask import t, derive
D = {"a": {"x": "p"}, "b": {"x": "q"}}
t(f"{derive(D[k]['x'])}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(2);
      const sources = results.map((r: unknown) => r.source).sort();
      expect(sources).toEqual(['p', 'q']);
    });

    it('PN4: 3-deep static', async () => {
      const code = `from gt_flask import t, derive
D = {"a": {"b": {"c": "deep"}}}
t(f"{derive(D['a']['b']['c'])}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('deep');
    });
  });

  // ===== dict spread resolution ===== //

  describe('dict spread resolution', () => {
    it('PS1: dict unpacking', async () => {
      const code = `from gt_flask import t, derive
base = {"a": "x"}
D = {**base, "b": "y"}
t(f"{derive(D[k])}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(2);
      const sources = results.map((r: unknown) => r.source).sort();
      expect(sources).toEqual(['x', 'y']);
    });

    it('PS2: unpack static access', async () => {
      const code = `from gt_flask import t, derive
base = {"greeting": "Hi"}
D = {**base}
t(f"{derive(D['greeting'])}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('Hi');
    });
  });

  // ===== nested dict false-positive guards ===== //

  describe('nested dict false-positive guards', () => {
    it('PF1: static key excludes siblings', async () => {
      const code = `from gt_flask import t, derive
D = {"a": {"x": "yes"}, "b": {"x": "no"}}
t(f"{derive(D['a']['x'])}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('yes');
    });

    it('PF2: computed.static only gets matching prop', async () => {
      const code = `from gt_flask import t, derive
D = {"a": {"label": "A", "desc": "AA"}, "b": {"label": "B", "desc": "BB"}}
t(f"{derive(D[k]['label'])}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(2);
      const sources = results.map((r: unknown) => r.source).sort();
      expect(sources).toEqual(['A', 'B']);
    });
  });

  // ===== list access ===== //

  describe('list access', () => {
    it('extracts all list values with dynamic subscript', async () => {
      const code = `from gt_flask import t, derive
L = ["Bad", "OK", "Good"]
t(f"{derive(L[score])}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(3);
      const sources = results.map((r: ExtractionResult) => r.source).sort();
      expect(sources).toEqual(['Bad', 'Good', 'OK']);
    });

    it('narrows to one value with static integer subscript', async () => {
      const code = `from gt_flask import t, derive
L = ["zero", "one", "two"]
t(f"{derive(L[0])}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('zero');
    });

    it('handles list with conditional values', async () => {
      const code = `from gt_flask import t, derive
L = ["a" if cond else "b", "c"]
t(f"{derive(L[k])}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(3);
      const sources = results.map((r: ExtractionResult) => r.source).sort();
      expect(sources).toEqual(['a', 'b', 'c']);
    });

    it('handles list in f-string template', async () => {
      const code = `from gt_flask import t, derive
L = ["Bad", "Good"]
t(f"Score: {derive(L[s])}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(2);
      const sources = results.map((r: ExtractionResult) => r.source).sort();
      expect(sources).toEqual(['Score: Bad', 'Score: Good']);
    });

    it('errors on empty list', async () => {
      const code = `from gt_flask import t, derive
L = []
t(f"{derive(L[k])}")`;
      const { errors } = await extractFromPythonSource(code, 'test.py');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.join(' ')).toContain('no resolvable values');
    });

    it('errors on unresolvable list element', async () => {
      const code = `from gt_flask import t, derive
L = ["ok", ["nested"]]
t(f"{derive(L[k])}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('ok');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.join(' ')).toContain('unsupported derive() argument type');
    });
  });

  // ===== list spread resolution ===== //

  describe('list spread resolution', () => {
    it('resolves list spread (*base)', async () => {
      const code = `from gt_flask import t, derive
base = ["a", "b"]
L = [*base, "c"]
t(f"{derive(L[k])}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(3);
      const sources = results.map((r: ExtractionResult) => r.source).sort();
      expect(sources).toEqual(['a', 'b', 'c']);
    });

    it('resolves multiple list spreads', async () => {
      const code = `from gt_flask import t, derive
a = ["x"]
b = ["y"]
L = [*a, *b, "z"]
t(f"{derive(L[k])}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(3);
      const sources = results.map((r: ExtractionResult) => r.source).sort();
      expect(sources).toEqual(['x', 'y', 'z']);
    });
  });

  // ===== nested list/dict access ===== //

  describe('nested list/dict access', () => {
    it('resolves nested list access L[0][1]', async () => {
      const code = `from gt_flask import t, derive
L = [["a", "b"], ["c", "d"]]
t(f"{derive(L[0][1])}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('b');
    });

    it('resolves dict nested in list', async () => {
      const code = `from gt_flask import t, derive
L = [{"x": "hi"}, {"x": "bye"}]
t(f"{derive(L[k]['x'])}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(2);
      const sources = results.map((r: ExtractionResult) => r.source).sort();
      expect(sources).toEqual(['bye', 'hi']);
    });

    it('resolves list nested in dict', async () => {
      const code = `from gt_flask import t, derive
D = {"items": ["a", "b"]}
t(f"{derive(D['items'][k])}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(2);
      const sources = results.map((r: ExtractionResult) => r.source).sort();
      expect(sources).toEqual(['a', 'b']);
    });
  });

  // ===== dict spread override (break bug fix) ===== //

  describe('dict spread override', () => {
    it('collects both entries for spread + own key', async () => {
      const code = `from gt_flask import t, derive
base = {"x": "first"}
D = {**base, "x": "second"}
t(f"{derive(D['x'])}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toHaveLength(0);
      // Both 'first' (from spread) and 'second' (own) should be collected
      expect(results).toHaveLength(2);
      const sources = results.map((r: ExtractionResult) => r.source).sort();
      expect(sources).toEqual(['first', 'second']);
    });
  });

  // ===== edge cases: unintuitive outcomes ===== //

  describe('edge cases: unintuitive outcomes', () => {
    it('negative index falls through to dynamic mode (returns all values)', async () => {
      // L[-1] in Python would resolve to "c", but tree-sitter parses -1 as
      // a unary_operator (not an integer literal), so we treat it as a
      // dynamic key and return ALL values instead of narrowing.
      const code = `from gt_flask import t, derive
L = ["a", "b", "c"]
t(f"{derive(L[-1])}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toHaveLength(0);
      // Returns all 3 values, not just "c"
      expect(results).toHaveLength(3);
      const sources = results.map((r: ExtractionResult) => r.source).sort();
      expect(sources).toEqual(['a', 'b', 'c']);
    });

    it('out-of-bounds index produces empty result and error', async () => {
      // L[5] on a 2-element list: resolveSubscript finds no matching entry,
      // pushes an error, returns null. But the f-string wrapper still
      // produces an empty-string result from the remaining (empty) template.
      const code = `from gt_flask import t, derive
L = ["a", "b"]
t(f"{derive(L[5])}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.join(' ')).toContain('no resolvable values');
      // An empty-string result is still emitted from the f-string shell
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('');
    });

    it('integer and string keys cross-match (unlike Python)', async () => {
      // In Python, D[0] and D["0"] access different keys.
      // Our extractor normalizes both to the string "0", so they match.
      const code = `from gt_flask import t, derive
D = {0: "zero"}
t(f"{derive(D['0'])}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toHaveLength(0);
      // Matches despite key type mismatch
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('zero');
    });

    it('string key matches integer subscript (unlike Python)', async () => {
      const code = `from gt_flask import t, derive
D = {"0": "zero", "1": "one"}
t(f"{derive(D[0])}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('zero');
    });

    it('spread of non-list (dict) silently drops with no error', async () => {
      // *base where base is a dict — collectListEntries only handles
      // list_splat sources that resolve to lists. A dict is silently skipped.
      const code = `from gt_flask import t, derive
base = {"x": "y"}
L = [*base, "c"]
t(f"{derive(L[k])}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      // Only "c" is collected; the spread is silently dropped
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('c');
    });

    it('spread of non-list (tuple) silently drops with no error', async () => {
      const code = `from gt_flask import t, derive
base = ("a", "b")
L = [*base, "c"]
t(f"{derive(L[k])}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      // Only "c" is collected; tuple spread is silently dropped
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('c');
    });

    it('spread of undefined variable silently drops with no error', async () => {
      const code = `from gt_flask import t, derive
L = [*missing, "c"]
t(f"{derive(L[k])}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      // Only "c" is collected; unresolvable spread is silently dropped
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('c');
    });

    it('attribute access on list reports "dictionary or list" in error', async () => {
      // L.x on a list — the attribute handler looks for a dict key "x",
      // which doesn't exist. Error message should mention both types.
      const code = `from gt_flask import t, derive
L = ["a", "b"]
t(f"{derive(L.x)}")`;
      const { errors } = await extractFromPythonSource(code, 'test.py');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.join(' ')).toContain('dictionary or list');
    });

    it('list with non-string elements errors per element', async () => {
      // Non-string elements (integer, None) each produce their own error
      // while string elements still resolve successfully.
      const code = `from gt_flask import t, derive
L = ["ok", 42, None]
t(f"{derive(L[k])}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('ok');
      expect(errors).toHaveLength(2);
      expect(errors[0]).toContain(
        'unsupported derive() argument type "integer"'
      );
      expect(errors[1]).toContain('unsupported derive() argument type "none"');
    });

    it('nested dynamic-dynamic list access returns all leaf values', async () => {
      // L[i][j] where both indices are dynamic: first resolves all
      // inner lists, then resolves all elements within each.
      const code = `from gt_flask import t, derive
L = [["a", "b"], ["c", "d"]]
t(f"{derive(L[i][j])}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        'test.py'
      );
      expect(errors).toHaveLength(0);
      expect(results).toHaveLength(4);
      const sources = results.map((r: ExtractionResult) => r.source).sort();
      expect(sources).toEqual(['a', 'b', 'c', 'd']);
    });
  });
});
