import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import traverseModule, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { processTaggedTemplateCall } from '../index.js';
import { ParsingConfig, ParsingOutput } from '../../types.js';
import { Updates } from '../../../../../../types/index.js';

// Handle CommonJS/ESM interop
const traverse = (traverseModule as any).default || traverseModule;

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
 * Parses the given code, finds the first tagged template with `tagName` as the tag,
 * and runs processTaggedTemplateCall with the tag's NodePath.
 */
function runProcessTaggedTemplateCall(
  code: string,
  tagName: string = 't',
  config?: Partial<ParsingConfig>
): ParsingOutput {
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  const output = createOutput();
  const cfg = createConfig(config);

  traverse(ast, {
    TaggedTemplateExpression(path: NodePath<t.TaggedTemplateExpression>) {
      if (t.isIdentifier(path.node.tag) && path.node.tag.name === tagName) {
        const tagPath = path.get('tag') as NodePath;
        processTaggedTemplateCall(tagPath, cfg, output);
      }
    },
  });

  return output;
}

describe('processTaggedTemplateCall', () => {
  it('should extract a plain tagged template with no expressions', () => {
    const output = runProcessTaggedTemplateCall('t`hello`');
    expect(output.updates).toHaveLength(1);
    expect(output.updates[0]).toMatchObject({
      dataFormat: 'ICU',
      source: 'hello',
    });
    expect(output.errors).toHaveLength(0);
  });

  it('should extract a tagged template with a single expression', () => {
    const output = runProcessTaggedTemplateCall('t`Hello, ${name}`');
    expect(output.updates).toHaveLength(1);
    expect(output.updates[0]).toMatchObject({
      dataFormat: 'ICU',
      source: 'Hello, {0}',
    });
  });

  it('should extract a tagged template with multiple expressions', () => {
    const output = runProcessTaggedTemplateCall('t`${greeting}, ${name}!`');
    expect(output.updates).toHaveLength(1);
    expect(output.updates[0]).toMatchObject({
      dataFormat: 'ICU',
      source: '{0}, {1}!',
    });
  });

  it('should handle member expression variables', () => {
    const output = runProcessTaggedTemplateCall('t`Hello, ${user.name}`');
    expect(output.updates).toHaveLength(1);
    expect(output.updates[0]).toMatchObject({
      dataFormat: 'ICU',
      source: 'Hello, {0}',
    });
  });

  it('should extract an empty tagged template', () => {
    const output = runProcessTaggedTemplateCall('t``');
    expect(output.updates).toHaveLength(1);
    expect(output.updates[0]).toMatchObject({
      dataFormat: 'ICU',
      source: '',
    });
  });

  it('should handle adjacent expressions with no text between them', () => {
    const output = runProcessTaggedTemplateCall('t`${a}${b}`');
    expect(output.updates).toHaveLength(1);
    expect(output.updates[0]).toMatchObject({
      dataFormat: 'ICU',
      source: '{0}{1}',
    });
  });

  it('should preserve source file metadata for derive variants', () => {
    const output = runProcessTaggedTemplateCall(
      `
        function getSubject(gender: string) {
          return gender === "male" ? "boy" : "girl";
        }

        t\`The \${derive(getSubject(gender))} is playing in the park.\`
      `
    );

    expect(output.updates).toHaveLength(2);
    expect(output.updates.map((u) => u.source).sort()).toEqual([
      'The boy is playing in the park.',
      'The girl is playing in the park.',
    ]);
    expect(output.updates.every((u) => u.metadata.staticId)).toBe(true);
    expect(output.updates.every((u) => u.metadata.filePaths?.[0] === FILE_PATH))
      .toBe(true);
  });

  it('should still extract when ignoreTaggedTemplates is true (gating is done by caller)', () => {
    const output = runProcessTaggedTemplateCall('t`hello ${name}`', 't', {
      ignoreTaggedTemplates: true,
    });
    // processTaggedTemplateCall itself doesn't check the flag — that's done by the caller
    // So this test verifies the handler works regardless; the gating is tested at the integration level
    expect(output.updates).toHaveLength(1);
  });
});
