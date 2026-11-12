import { afterAll, describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { disposeParser } from '../parser.js';
import { extractFromPythonSource } from '../index.js';
import {
  PYTHON_GT_PACKAGES,
  PYTHON_GT_DEPENDENCIES,
  PYTHON_T_FUNCTION,
  PYTHON_DERIVE,
  PYTHON_DECLARE_VAR,
  PYTHON_METADATA_KWARGS,
} from '../constants.js';
import { nodeToStrings } from '../stringNode.js';

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

    it.each([
      ['single-quoted', `t('single quoted')`, 'single quoted'],
      ['triple-quoted', `t("""triple quoted""")`, 'triple quoted'],
      ['empty', `t("")`, ''],
    ])('handles %s strings', async (_kind, call, source) => {
      const { results, errors } = await extractFromPythonSource(
        `from gt_flask import t\n${call}`,
        'test.py'
      );
      expect(errors).toEqual([]);
      expect(results.map((r) => r.source)).toEqual([source]);
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
      // fixtures/dotpkg/__init__.py defines get_time(), and
      // fixtures/dotpkg/reexport.py has "from . import get_time", so the
      // re-export has to follow the bare dot back to __init__.py.
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
      // fixtures/reexport_alias.py: from static_test_defs import get_gender as gg
      const code = `from gt_fastapi import t, derive
from reexport_alias import gg
t(f"{derive(gg(v))}")`;
      const { results, errors } = await extractFromPythonSource(
        code,
        path.join(__dirname, 'fixtures', 'reexport_alias_main.py')
      );
      expect(errors).toEqual([]);
      expect(results).toHaveLength(2);
      const sources = results.map((r) => r.source).sort();
      expect(sources).toEqual(['he', 'she']);
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

  // ===== derive() argument resolution ===== //

  // Each `body` is the module source after `from gt_flask import t, derive`.
  const extractDerive = (body: string) =>
    extractFromPythonSource(
      `from gt_flask import t, derive\n${body}`,
      'test.py'
    );

  describe('derive argument resolution', () => {
    it.each<[name: string, body: string, sortedSources: string[]]>([
      // identifiers
      [
        'resolves constant string identifier',
        `GREETING = "hello"\nt(f"{derive(GREETING)}")`,
        ['hello'],
      ],
      [
        'resolves chained constant assignment',
        `A = "hi"\nB = A\nt(f"{derive(B)}")`,
        ['hi'],
      ],
      [
        'resolves constant in template',
        `PREFIX = "Hello"\nt(f"{derive(PREFIX)} world")`,
        ['Hello world'],
      ],
      // Known limitation: findConstantAssignment returns the first match, so a
      // reassigned name resolves to its first value ("new" would be ideal).
      [
        'resolves first assignment for reassigned variable',
        `x = "old"\nx = "new"\nt(f"{derive(x)}")`,
        ['old'],
      ],
      [
        'resolves first dict for reassigned dict',
        `D = {0: "a"}\nD = {0: "b"}\nt(f"{derive(D[k])}")`,
        ['a'],
      ],
      // dictionary access
      [
        'extracts all dict values with dynamic subscript',
        `LABELS = {0: "Bad", 1: "OK", 2: "Good"}\nt(f"{derive(LABELS[score])}")`,
        ['Bad', 'Good', 'OK'],
      ],
      [
        'handles dict with conditional values',
        `LABELS = {0: "x" if cond else "y", 1: "z"}\nt(f"{derive(LABELS[k])}")`,
        ['x', 'y', 'z'],
      ],
      [
        'handles dict in f-string template',
        `LABELS = {0: "Bad", 1: "Good"}\nt(f"Score: {derive(LABELS[s])}")`,
        ['Score: Bad', 'Score: Good'],
      ],
      [
        'extracts values from dict with mixed key types',
        `D = {0: "zero", "a": "alpha"}\nt(f"{derive(D[k])}")`,
        ['alpha', 'zero'],
      ],
      [
        'resolves chained subscript access reusing the f-string quote',
        `LABELS = {0: {"a": "x"}}\nt(f"{derive(LABELS[k]["a"])}")`,
        ['x'],
      ],
      // nested dictionary access
      [
        'nested dict: static key, then computed key returns all values',
        `D = {"a": {"x": "p", "y": "q"}}\nt(f"{derive(D['a'][k])}")`,
        ['p', 'q'],
      ],
      [
        'nested dict: computed key, then static key',
        `D = {"a": {"x": "p"}, "b": {"x": "q"}}\nt(f"{derive(D[k]['x'])}")`,
        ['p', 'q'],
      ],
      [
        'nested dict: 3-deep static keys',
        `D = {"a": {"b": {"c": "deep"}}}\nt(f"{derive(D['a']['b']['c'])}")`,
        ['deep'],
      ],
      [
        'nested dict: static keys exclude sibling entries',
        `D = {"a": {"x": "yes"}, "b": {"x": "no"}}\nt(f"{derive(D['a']['x'])}")`,
        ['yes'],
      ],
      [
        'nested dict: computed.static only gets the matching prop',
        `D = {"a": {"label": "A", "desc": "AA"}, "b": {"label": "B", "desc": "BB"}}\nt(f"{derive(D[k]['label'])}")`,
        ['A', 'B'],
      ],
      // dict spread
      [
        'resolves dict unpacking',
        `base = {"a": "x"}\nD = {**base, "b": "y"}\nt(f"{derive(D[k])}")`,
        ['x', 'y'],
      ],
      [
        'resolves static access through dict unpacking',
        `base = {"greeting": "Hi"}\nD = {**base}\nt(f"{derive(D['greeting'])}")`,
        ['Hi'],
      ],
      [
        'collects both the spread entry and the own key that overrides it',
        `base = {"x": "first"}\nD = {**base, "x": "second"}\nt(f"{derive(D['x'])}")`,
        ['first', 'second'],
      ],
      // list access
      [
        'extracts all list values with dynamic subscript',
        `L = ["Bad", "OK", "Good"]\nt(f"{derive(L[score])}")`,
        ['Bad', 'Good', 'OK'],
      ],
      [
        'narrows to one list value with static integer subscript',
        `L = ["zero", "one", "two"]\nt(f"{derive(L[0])}")`,
        ['zero'],
      ],
      [
        'handles list with conditional values',
        `L = ["a" if cond else "b", "c"]\nt(f"{derive(L[k])}")`,
        ['a', 'b', 'c'],
      ],
      [
        'handles list in f-string template',
        `L = ["Bad", "Good"]\nt(f"Score: {derive(L[s])}")`,
        ['Score: Bad', 'Score: Good'],
      ],
      [
        'resolves list spread (*base)',
        `base = ["a", "b"]\nL = [*base, "c"]\nt(f"{derive(L[k])}")`,
        ['a', 'b', 'c'],
      ],
      [
        'resolves multiple list spreads',
        `a = ["x"]\nb = ["y"]\nL = [*a, *b, "z"]\nt(f"{derive(L[k])}")`,
        ['x', 'y', 'z'],
      ],
      // nested list/dict access
      [
        'resolves nested list access L[0][1]',
        `L = [["a", "b"], ["c", "d"]]\nt(f"{derive(L[0][1])}")`,
        ['b'],
      ],
      [
        'resolves dict nested in list',
        `L = [{"x": "hi"}, {"x": "bye"}]\nt(f"{derive(L[k]['x'])}")`,
        ['bye', 'hi'],
      ],
      [
        'resolves list nested in dict',
        `D = {"items": ["a", "b"]}\nt(f"{derive(D['items'][k])}")`,
        ['a', 'b'],
      ],
      [
        'nested dynamic-dynamic list access returns all leaf values',
        `L = [["a", "b"], ["c", "d"]]\nt(f"{derive(L[i][j])}")`,
        ['a', 'b', 'c', 'd'],
      ],
      // Unintuitive outcomes, documented as current behavior.
      // tree-sitter parses -1 as a unary_operator, not an integer literal, so
      // it is a dynamic key: all values are returned instead of just "c".
      [
        'negative index falls through to dynamic mode (returns all values)',
        `L = ["a", "b", "c"]\nt(f"{derive(L[-1])}")`,
        ['a', 'b', 'c'],
      ],
      // Python treats D[0] and D["0"] as different keys; the extractor
      // normalizes both to the string "0".
      [
        'integer key matches string subscript (unlike Python)',
        `D = {0: "zero"}\nt(f"{derive(D['0'])}")`,
        ['zero'],
      ],
      [
        'string key matches integer subscript (unlike Python)',
        `D = {"0": "zero", "1": "one"}\nt(f"{derive(D[0])}")`,
        ['zero'],
      ],
      // collectListEntries only follows splats that resolve to lists; anything
      // else is dropped without an error.
      [
        'spread of a dict into a list is silently dropped',
        `base = {"x": "y"}\nL = [*base, "c"]\nt(f"{derive(L[k])}")`,
        ['c'],
      ],
      [
        'spread of a tuple into a list is silently dropped',
        `base = ("a", "b")\nL = [*base, "c"]\nt(f"{derive(L[k])}")`,
        ['c'],
      ],
      [
        'spread of an undefined variable into a list is silently dropped',
        `L = [*missing, "c"]\nt(f"{derive(L[k])}")`,
        ['c'],
      ],
    ])('%s', async (_name, body, sortedSources) => {
      const { results, errors } = await extractDerive(body);
      expect(errors).toEqual([]);
      expect(results.map((r) => r.source).sort()).toEqual(sortedSources);
    });

    // `error` is a required substring of the reported errors (null: any error).
    // `sortedSources` are the values that still resolve (null: not asserted).
    it.each<
      [
        name: string,
        body: string,
        error: string | null,
        sortedSources: string[] | null,
      ]
    >([
      [
        'errors on unresolvable identifier',
        `t(f"{derive(NONEXISTENT)}")`,
        'identifier',
        null,
      ],
      // Recursion guard: these must terminate.
      [
        'errors on circular variable references without hanging',
        `x = y\ny = x\nt(f"{derive(x)}")`,
        null,
        null,
      ],
      [
        'errors on self-referencing variable without hanging',
        `x = x\nt(f"{derive(x)}")`,
        null,
        null,
      ],
      // True and None are tree-sitter types 'true' and 'none', not identifiers.
      ['errors on Python builtin True', `t(f"{derive(True)}")`, null, null],
      ['errors on integer literal', `t(f"{derive(42)}")`, null, null],
      ['errors on None', `t(f"{derive(None)}")`, null, null],
      [
        'rejects non-plus operator in static context',
        `t(f"{derive('a' * 3)}")`,
        null,
        null,
      ],
      [
        'errors on empty dict',
        `LABELS = {}\nt(f"{derive(LABELS[k])}")`,
        null,
        null,
      ],
      [
        'errors on empty list',
        `L = []\nt(f"{derive(L[k])}")`,
        'no resolvable values',
        null,
      ],
      [
        'errors on tuple subscript',
        `T = ("a", "b")\nt(f"{derive(T[0])}")`,
        'dictionary or list',
        null,
      ],
      // L.x looks for a dict key "x"; the message names both container types.
      [
        'errors on attribute access on a list',
        `L = ["a", "b"]\nt(f"{derive(L.x)}")`,
        'dictionary or list',
        null,
      ],
      [
        'errors on list value in dict (dynamic key), keeping string values',
        `D = {0: "Bad", 1: "OK", 2: "Good", 3: ["yyoyoo"]}\nt(f"{derive(D[score])}")`,
        'unsupported derive() argument type',
        ['Bad', 'Good', 'OK'],
      ],
      [
        'errors on list value in dict (static key)',
        `D = {"items": ["a", "b"]}\nt(f"{derive(D['items'])}")`,
        'unsupported derive() argument type',
        null,
      ],
      [
        'errors on nested dict value without further access',
        `D = {"a": "ok", "b": {"nested": "value"}}\nt(f"{derive(D[k])}")`,
        'unsupported derive() argument type',
        ['ok'],
      ],
      [
        'errors on tuple value in dict',
        `D = {0: "ok", 1: ("a", "b")}\nt(f"{derive(D[k])}")`,
        'unsupported derive() argument type',
        ['ok'],
      ],
      [
        'errors on unresolvable list element',
        `L = ["ok", ["nested"]]\nt(f"{derive(L[k])}")`,
        'unsupported derive() argument type',
        ['ok'],
      ],
      // resolveSubscript finds no entry and reports it, but the f-string shell
      // still emits an empty-string result.
      [
        'out-of-bounds index produces an error and an empty result',
        `L = ["a", "b"]\nt(f"{derive(L[5])}")`,
        'no resolvable values',
        [''],
      ],
    ])('%s', async (_name, body, error, sortedSources) => {
      const { results, errors } = await extractDerive(body);
      expect(errors.length).toBeGreaterThan(0);
      if (error) expect(errors.join(' ')).toContain(error);
      if (sortedSources) {
        expect(results.map((r) => r.source).sort()).toEqual(sortedSources);
      }
    });

    // The operand cannot be resolved as a dictionary; the error must be about
    // that, not about the + operator.
    it.each([
      ['subscript', `t(f"{derive(obj['key'] + '!')}")`],
      ['attribute', `t(f"{derive(obj.attr + '!')}")`],
    ])(
      'blames the %s operand, not the operator, in derive concat',
      async (_kind, body) => {
        const { errors } = await extractDerive(body);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors.join(' ')).not.toContain('unsupported binary operator');
        expect(errors.join(' ')).toContain('dictionary');
      }
    );

    it('list with non-string elements errors per element', async () => {
      const { results, errors } = await extractDerive(
        `L = ["ok", 42, None]\nt(f"{derive(L[k])}")`
      );
      expect(results.map((r) => r.source)).toEqual(['ok']);
      expect(errors).toHaveLength(2);
      expect(errors[0]).toContain(
        'unsupported derive() argument type "integer"'
      );
      expect(errors[1]).toContain('unsupported derive() argument type "none"');
    });
  });

  // ===== stringNode tests ===== //

  describe('stringNode', () => {
    it('nodeToStrings expands sequences and choices', () => {
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

  // These values are shared with the Python packages and the CLI.
  it('exports the Python GT constants', () => {
    expect(PYTHON_GT_PACKAGES).toEqual(['gt_flask', 'gt_fastapi']);
    expect(PYTHON_GT_DEPENDENCIES).toEqual(['gt-flask', 'gt-fastapi']);
    expect(PYTHON_T_FUNCTION).toBe('t');
    expect(PYTHON_DERIVE).toBe('derive');
    expect(PYTHON_DECLARE_VAR).toBe('declare_var');
    expect(PYTHON_METADATA_KWARGS).toEqual({
      _id: 'id',
      _context: 'context',
      _max_chars: 'maxChars',
    });
  });
});
