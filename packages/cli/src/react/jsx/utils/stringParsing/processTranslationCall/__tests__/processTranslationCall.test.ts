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
