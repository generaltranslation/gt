import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractFromPythonSource,
  PYTHON_GT_PACKAGES,
  PYTHON_GT_DEPENDENCIES,
  PYTHON_T_FUNCTION,
  PYTHON_DECLARE_STATIC,
  PYTHON_DECLARE_VAR,
  PYTHON_METADATA_KWARGS,
} from '../index.js';
import type { ExtractionResult, ExtractionMetadata } from '../types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) =>
  fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

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
      const { results, errors } = await extractFromPythonSource(code, 'main.py');
      expect(errors).toEqual([]);
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('Hello, world!');
    });

    it('extracts _max_chars with snake_case kwarg', async () => {
      const code = `from gt_flask import t\nt("Hello", _max_chars=10)`;
      const { results, errors } = await extractFromPythonSource(code, 'test.py');
      expect(errors).toEqual([]);
      expect(results).toHaveLength(1);
      expect(results[0].metadata.maxChars).toBe(10);
    });
  });

  // ===== declare_static tests ===== //

  describe('declare_static', () => {
    it('expands simple ternary into 2 variants', async () => {
      const { results, errors } = await extractFromPythonSource(
        fixture('declare_static_ternary.py'),
        'test.py'
      );
      // First call: t(f"It is {declare_static('day' if is_day() else 'night')}!")
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
      const { results, errors } = await extractFromPythonSource(
        fixture('declare_static_ternary.py'),
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

    it('handles plain string in declare_static', async () => {
      const { results, errors } = await extractFromPythonSource(
        fixture('declare_static_ternary.py'),
        'test.py'
      );
      const plainResult = results.find((r) => r.source === 'Hello world!');
      expect(plainResult).toBeDefined();
      expect(plainResult!.metadata.staticId).toBeDefined();
    });

    it('resolves local function returns in declare_static', async () => {
      const { results, errors } = await extractFromPythonSource(
        fixture('declare_static_func.py'),
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

    it('resolves cross-file function in declare_static', async () => {
      const helperPath = path.join(__dirname, 'fixtures', 'declare_static_helper.py');
      const code = `from gt_flask import t, declare_static
from declare_static_helper import get_time
t(f"It is {declare_static(get_time())}!")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        path.join(__dirname, 'fixtures', 'declare_static_crossfile.py')
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(2);
      const sources = results.map((r) => r.source).sort();
      expect(sources).toEqual(['It is evening!', 'It is morning!']);
      expect(results[0].metadata.staticId).toBe(results[1].metadata.staticId);
    });

    it('handles concatenation with declare_static', async () => {
      const { results, errors } = await extractFromPythonSource(
        fixture('declare_static_concat.py'),
        'test.py'
      );
      // t("Hello " + declare_static("day" if x else "night") + "!")
      const concatResults = results.filter(
        (r) => r.source === 'Hello day!' || r.source === 'Hello night!'
      );
      expect(concatResults).toHaveLength(2);
      expect(concatResults[0].metadata.staticId).toBe(
        concatResults[1].metadata.staticId
      );
    });

    it('produces cartesian product for multiple declare_statics', async () => {
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

    it('preserves metadata kwargs with declare_static', async () => {
      const code = `from gt_flask import t, declare_static
t(f"It is {declare_static('day' if x else 'night')}", _id="time_msg", _context="greeting")`;
      const { results, errors } = await extractFromPythonSource(code, 'test.py');
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
      const { results, errors } = await extractFromPythonSource(code, 'test.py');
      expect(errors).toEqual([]);
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('Hello world');
      expect(results[0].metadata.staticId).toBeUndefined();
    });

    it('handles string concatenation inside declare_static', async () => {
      const { results, errors } = await extractFromPythonSource(
        fixture('declare_static_string_concat.py'),
        'test.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('Hello, ab!');
      expect(results[0].metadata.staticId).toBeDefined();
    });

    it('resolves single-return function in declare_static', async () => {
      const { results, errors } = await extractFromPythonSource(
        fixture('declare_static_func_simple.py'),
        'test.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('Hello, !!');
      expect(results[0].metadata.staticId).toBeDefined();
    });

    it('resolves function returning declare_var + concat in declare_static', async () => {
      const { results, errors } = await extractFromPythonSource(
        fixture('declare_var_in_func_only.py'),
        'test.py'
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(1);
      // Function returns: declare_var(name) + '!'
      // → {_gt_, select, other {}} + "!" → sequence
      // After indexVars: {_gt_1, select, other {}}
      expect(results[0].source).toBe(
        'Hello, {_gt_1, select, other {}}!!'
      );
      expect(results[0].metadata.staticId).toBeDefined();
    });

    it('resolves function with declare_var in ternary with declare_static', async () => {
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

    it('handles declare_static with inline concat of ternary + string', async () => {
      const code = `from gt_flask import t, declare_static
t(f"Result: {declare_static(('yes' if x else 'no') + '!')}")`;
      const { results, errors } = await extractFromPythonSource(code, 'test.py');
      expect(errors).toEqual([]);
      expect(results).toHaveLength(2);
      const sources = results.map((r) => r.source).sort();
      expect(sources).toEqual(['Result: no!', 'Result: yes!']);
    });

    it('handles declare_static with declare_var nested directly', async () => {
      const code = `from gt_flask import t, declare_static, declare_var
t(f"Hello, {declare_static(declare_var(name) + '!')}")`;
      const { results, errors } = await extractFromPythonSource(code, 'test.py');
      expect(errors).toEqual([]);
      expect(results).toHaveLength(1);
      // declare_var(name) + '!' → "{_gt_, select, other {}}" + "!" → "{_gt_, select, other {}}!"
      // Full f-string: "Hello, {_gt_, select, other {}}!"
      // After indexVars: "Hello, {_gt_1, select, other {}}!"
      expect(results[0].source).toBe(
        'Hello, {_gt_1, select, other {}}!'
      );
    });

    it('handles aliased imports with functions returning conditionals and declare_var', async () => {
      // This exercises:
      // - aliased declare_static/declare_var imports
      // - function resolution with conditional return expressions
      // - declare_var inside a function return branch
      // - cartesian product across two declare_static calls (2 × 2 = 4 variants)
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

  // ===== declare_var tests ===== //

  describe('declare_var', () => {
    it('produces ICU placeholder for basic declare_var', async () => {
      const code = `from gt_flask import t, declare_var
t(f"Hello {declare_var(name)}!")`;
      const { results, errors } = await extractFromPythonSource(code, 'test.py');
      expect(errors).toEqual([]);
      expect(results).toHaveLength(1);
      // declareVar('') → {_gt_, select, other {}}
      // indexVars → {_gt_1, select, other {}}
      expect(results[0].source).toBe(
        'Hello {_gt_1, select, other {}}!'
      );
      expect(results[0].metadata.staticId).toBeDefined();
    });

    it('produces ICU placeholder with _name kwarg', async () => {
      const code = `from gt_flask import t, declare_var
t(f"Hello {declare_var(name, _name='user')}!")`;
      const { results, errors } = await extractFromPythonSource(code, 'test.py');
      expect(errors).toEqual([]);
      expect(results).toHaveLength(1);
      expect(results[0].source).toBe(
        'Hello {_gt_1, select, other {} _gt_var_name {user}}!'
      );
    });
  });

  // ===== mixed declare_static + declare_var tests ===== //

  describe('mixed declare_static + declare_var', () => {
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

  // ===== stringNode tests ===== //

  describe('stringNode', () => {
    // These are tested indirectly through the integration tests above,
    // but let's also test nodeToStrings directly
    it('nodeToStrings is importable and works', async () => {
      const { nodeToStrings } = await import('../stringNode.js');

      expect(nodeToStrings({ type: 'text', text: 'hello' })).toEqual([
        'hello',
      ]);

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

    it('exports PYTHON_DECLARE_STATIC', () => {
      expect(PYTHON_DECLARE_STATIC).toBe('declare_static');
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
});
