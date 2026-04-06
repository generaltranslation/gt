import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { processTranslationCall } from '../index.js';
import { ParsingConfig, ParsingOutput } from '../../types.js';
import { Updates } from '../../../../../../types/index.js';

const FILE_PATH = 'test.tsx';

function createConfig(overrides?: Partial<ParsingConfig>): ParsingConfig {
  return {
    parsingOptions: { conditionNames: [] },
    file: FILE_PATH,
    ignoreInlineMetadata: false,
    ignoreDynamicContent: false,
    ignoreInvalidIcu: false,
    ignoreInlineListContent: false,
    ignoreTaggedTemplates: false,
    ignoreGlobalTaggedTemplates: false,
    ...overrides,
  };
}

function createOutput(): ParsingOutput {
  return {
    updates: [] as Updates,
    errors: [] as string[],
    warnings: new Set<string>(),
  };
}

/**
 * Parses the given code, finds the first call to an identifier named `calleeName`,
 * and runs processTranslationCall with the callee's NodePath.
 */
function runProcessTranslationCall(
  code: string,
  calleeName: string = 't',
  config?: Partial<ParsingConfig>
): ParsingOutput {
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  const output = createOutput();
  const cfg = createConfig(config);

  traverse(ast, {
    CallExpression(path) {
      if (
        t.isIdentifier(path.node.callee) &&
        path.node.callee.name === calleeName
      ) {
        // processTranslationCall expects the NodePath of the callee identifier
        const calleePath = path.get('callee') as NodePath;
        processTranslationCall(calleePath, cfg, output);
      }
    },
  });

  return output;
}

describe('processTranslationCall - array support', () => {
  it('should extract each string literal in an array', () => {
    const output = runProcessTranslationCall(`t(["hello", "world"])`);

    expect(output.updates).toHaveLength(2);
    expect(output.updates[0]).toMatchObject({
      dataFormat: 'ICU',
      source: 'hello',
    });
    expect(output.updates[1]).toMatchObject({
      dataFormat: 'ICU',
      source: 'world',
    });
    expect(output.errors).toHaveLength(0);
  });

  it('should extract template literals without expressions in an array', () => {
    const output = runProcessTranslationCall('t([`hello`, `world`])');

    expect(output.updates).toHaveLength(2);
    expect(output.updates[0]).toMatchObject({
      dataFormat: 'ICU',
      source: 'hello',
    });
    expect(output.updates[1]).toMatchObject({
      dataFormat: 'ICU',
      source: 'world',
    });
    expect(output.errors).toHaveLength(0);
  });

  it('should handle mixed string literals and template literals', () => {
    const output = runProcessTranslationCall('t(["hello", `world`])');

    expect(output.updates).toHaveLength(2);
    expect(output.updates[0]).toMatchObject({ source: 'hello' });
    expect(output.updates[1]).toMatchObject({ source: 'world' });
    expect(output.errors).toHaveLength(0);
  });

  it('should append index to $id for each array element', () => {
    const output = runProcessTranslationCall(
      `t(["hello", "world"], { $id: "greetings" })`
    );

    expect(output.updates).toHaveLength(2);
    expect(output.updates[0]).toMatchObject({
      source: 'hello',
      metadata: { id: 'greetings.0' },
    });
    expect(output.updates[1]).toMatchObject({
      source: 'world',
      metadata: { id: 'greetings.1' },
    });
    expect(output.errors).toHaveLength(0);
  });

  it('should append index to $id and share $context across elements', () => {
    const output = runProcessTranslationCall(
      `t(["a", "b"], { $id: "x", $context: "page" })`
    );

    expect(output.updates).toHaveLength(2);
    expect(output.updates[0]).toMatchObject({
      source: 'a',
      metadata: { id: 'x.0', context: 'page' },
    });
    expect(output.updates[1]).toMatchObject({
      source: 'b',
      metadata: { id: 'x.1', context: 'page' },
    });
    expect(output.errors).toHaveLength(0);
  });

  it('should share $context without adding id when $id is not provided', () => {
    const output = runProcessTranslationCall(
      `t(["a", "b"], { $context: "nav" })`
    );

    expect(output.updates).toHaveLength(2);
    expect(output.updates[0]).toMatchObject({
      source: 'a',
      metadata: { context: 'nav' },
    });
    expect(output.updates[0].metadata).not.toHaveProperty('id');
    expect(output.updates[1]).toMatchObject({
      source: 'b',
      metadata: { context: 'nav' },
    });
    expect(output.updates[1].metadata).not.toHaveProperty('id');
    expect(output.errors).toHaveLength(0);
  });

  it('should produce no updates and no errors for an empty array', () => {
    const output = runProcessTranslationCall(`t([])`);

    expect(output.updates).toHaveLength(0);
    expect(output.errors).toHaveLength(0);
  });

  it('should handle a single-element array', () => {
    const output = runProcessTranslationCall(`t(["only"])`);

    expect(output.updates).toHaveLength(1);
    expect(output.updates[0]).toMatchObject({
      dataFormat: 'ICU',
      source: 'only',
    });
    expect(output.errors).toHaveLength(0);
  });

  it('should index $id for a single-element array', () => {
    const output = runProcessTranslationCall(`t(["only"], { $id: "single" })`);

    expect(output.updates).toHaveLength(1);
    expect(output.updates[0]).toMatchObject({
      source: 'only',
      metadata: { id: 'single.0' },
    });
    expect(output.errors).toHaveLength(0);
  });

  it('should error on template literals with expressions inside an array', () => {
    const code = `
      const name = "world";
      t(["hello", \`hi \${name}\`]);
    `;
    const output = runProcessTranslationCall(code);

    expect(output.updates).toHaveLength(1);
    expect(output.updates[0]).toMatchObject({ source: 'hello' });
    expect(output.errors.length).toBeGreaterThan(0);
  });

  it('should error on non-string elements (variables) inside an array', () => {
    const code = `
      const someVar = "dynamic";
      t(["hello", someVar]);
    `;
    const output = runProcessTranslationCall(code);

    expect(output.updates).toHaveLength(1);
    expect(output.updates[0]).toMatchObject({ source: 'hello' });
    expect(output.errors.length).toBeGreaterThan(0);
  });
});

describe('$format option support', () => {
  it('should extract $format from options and set dataFormat', () => {
    const output = runProcessTranslationCall(
      `t("Hello", { $format: "STRING" })`
    );
    expect(output.updates).toHaveLength(1);
    expect(output.updates[0]).toMatchObject({
      dataFormat: 'STRING',
      source: 'Hello',
    });
    expect(output.errors).toHaveLength(0);
  });

  it('should default to ICU when $format is not provided', () => {
    const output = runProcessTranslationCall(`t("Hello")`);
    expect(output.updates).toHaveLength(1);
    expect(output.updates[0]).toMatchObject({
      dataFormat: 'ICU',
      source: 'Hello',
    });
  });

  it('should extract $format alongside other metadata', () => {
    const output = runProcessTranslationCall(
      `t("Hello", { $id: "greeting", $context: "home", $format: "I18NEXT" })`
    );
    expect(output.updates).toHaveLength(1);
    expect(output.updates[0]).toMatchObject({
      dataFormat: 'I18NEXT',
      source: 'Hello',
      metadata: { id: 'greeting', context: 'home' },
    });
  });

  it('should warn on invalid $format value', () => {
    const output = runProcessTranslationCall(
      `t("Hello", { $format: "INVALID" })`
    );
    expect(output.updates).toHaveLength(1);
    // Invalid format should fall back to ICU
    expect(output.updates[0]).toMatchObject({
      dataFormat: 'ICU',
      source: 'Hello',
    });
    // Should produce a warning
    expect(output.warnings.size).toBeGreaterThan(0);
  });

  it('should extract $format for array of strings', () => {
    const output = runProcessTranslationCall(
      `t(["Hello", "World"], { $format: "STRING" })`
    );
    expect(output.updates).toHaveLength(2);
    expect(output.updates[0]).toMatchObject({ dataFormat: 'STRING' });
    expect(output.updates[1]).toMatchObject({ dataFormat: 'STRING' });
  });

  it('should not warn on invalid ICU when $format is STRING', () => {
    const output = runProcessTranslationCall(
      `t("Hello {{plain}} string", { $format: "STRING" })`
    );
    expect(output.updates).toHaveLength(1);
    expect(output.updates[0]).toMatchObject({
      dataFormat: 'STRING',
      source: 'Hello {{plain}} string',
    });
    expect(output.errors).toHaveLength(0);
    expect(output.warnings.size).toBe(0);
  });

  it('should still warn on invalid ICU when $format is ICU', () => {
    const output = runProcessTranslationCall(
      `t("Hello {{plain}} string", { $format: "ICU" })`
    );
    expect(output.updates).toHaveLength(0);
    expect(output.warnings.size).toBeGreaterThan(0);
  });

  it('should still warn on invalid ICU when no $format specified', () => {
    const output = runProcessTranslationCall(`t("Hello {{plain}} string")`);
    expect(output.updates).toHaveLength(0);
    expect(output.warnings.size).toBeGreaterThan(0);
  });
});

describe('derive in context', () => {
  it('should produce 2 updates when $context uses derive with ternary', () => {
    const code = `
      import { derive } from 'generaltranslation';
      t("Hello", { $context: derive(x ? "formal" : "casual") })
    `;
    const output = runProcessTranslationCall(code);

    expect(output.errors).toHaveLength(0);
    expect(output.updates).toHaveLength(2);

    const contexts = output.updates.map((u) => u.metadata.context).sort();
    expect(contexts).toEqual(['casual', 'formal']);

    // Both should have the same source
    expect(output.updates[0].source).toBe('Hello');
    expect(output.updates[1].source).toBe('Hello');

    // Both should share the same staticId
    expect(output.updates[0].metadata.staticId).toBeDefined();
    expect(output.updates[0].metadata.staticId).toBe(
      output.updates[1].metadata.staticId
    );
  });

  it('should produce cross-product when both content and context use derive', () => {
    const code = `
      import { derive } from 'generaltranslation';
      t(derive(x ? "Hello" : "Hi"), { $context: derive(y ? "formal" : "casual") })
    `;
    const output = runProcessTranslationCall(code);

    expect(output.errors).toHaveLength(0);
    expect(output.updates).toHaveLength(4);

    const pairs = output.updates
      .map((u) => `${u.source}|${u.metadata.context}`)
      .sort();
    expect(pairs).toEqual([
      'Hello|casual',
      'Hello|formal',
      'Hi|casual',
      'Hi|formal',
    ]);

    // All 4 should share the same staticId
    const staticId = output.updates[0].metadata.staticId;
    expect(staticId).toBeDefined();
    expect(output.updates.every((u) => u.metadata.staticId === staticId)).toBe(
      true
    );
  });

  it('should still work with static string $context (regression)', () => {
    const output = runProcessTranslationCall(
      `t("Hello", { $context: "greeting" })`
    );

    expect(output.errors).toHaveLength(0);
    expect(output.updates).toHaveLength(1);
    expect(output.updates[0]).toMatchObject({
      source: 'Hello',
      metadata: { context: 'greeting' },
    });
  });

  it('should produce N updates when context derives a function with N return variants', () => {
    const code = `
      import { derive } from 'generaltranslation';
      function getFormality() {
        if (isFormal) {
          return "formal";
        } else {
          return "casual";
        }
      }
      t("Hello", { $context: derive(getFormality()) })
    `;
    const output = runProcessTranslationCall(code);

    expect(output.errors).toHaveLength(0);
    expect(output.updates).toHaveLength(2);

    const contexts = output.updates.map((u) => u.metadata.context).sort();
    expect(contexts).toEqual(['casual', 'formal']);

    expect(output.updates[0].source).toBe('Hello');
    expect(output.updates[1].source).toBe('Hello');

    expect(output.updates[0].metadata.staticId).toBeDefined();
    expect(output.updates[0].metadata.staticId).toBe(
      output.updates[1].metadata.staticId
    );
  });

  it('should handle derive in context via string concatenation', () => {
    const code = `
      import { derive } from 'generaltranslation';
      t("Hello", { $context: "prefix-" + derive(x ? "formal" : "casual") })
    `;
    const output = runProcessTranslationCall(code);

    expect(output.errors).toHaveLength(0);
    expect(output.updates).toHaveLength(2);

    const contexts = output.updates.map((u) => u.metadata.context).sort();
    expect(contexts).toEqual(['prefix-casual', 'prefix-formal']);
  });

  it('should handle derive in context via template literal', () => {
    const code = `
      import { derive } from 'generaltranslation';
      t("Hello", { $context: \`prefix-\${derive(x ? "formal" : "casual")}\` })
    `;
    const output = runProcessTranslationCall(code);

    expect(output.errors).toHaveLength(0);
    expect(output.updates).toHaveLength(2);

    const contexts = output.updates.map((u) => u.metadata.context).sort();
    expect(contexts).toEqual(['prefix-casual', 'prefix-formal']);
  });
});
