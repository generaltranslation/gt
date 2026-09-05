import { beforeAll, describe, expect, it } from 'vitest';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { safetyExamples } from './cases/adversarial';
import { lower } from './oracle';
import { buildNativeDriver, runNative } from './workflow';

let outputs: string[];
beforeAll(async () => {
  await buildNativeDriver();
  outputs = await runNative(safetyExamples.map(({ input }) => input));
}, 300_000);

describe('valid bindings where the reference compiler emits invalid imports', () => {
  for (const [index, example] of safetyExamples.entries()) {
    it(example.name, () => {
      const ast = lower(outputs[index]);
      let translate = 0;
      let variable = 0;
      traverse(ast, {
        ReferencedIdentifier(path) {
          if (/^GtInternal(TranslateJsx|Var)\d*$/.test(path.node.name)) {
            expect(
              path.scope.getBinding(path.node.name),
              example.reason
            ).toBeDefined();
          }
        },
        CallExpression(path) {
          const component = path.node.arguments[0];
          if (!t.isIdentifier(component)) return;
          const binding = path.scope.getBinding(component.name);
          if (!binding?.path.isImportSpecifier()) return;
          const source = binding.path.parentPath;
          if (
            !source?.isImportDeclaration() ||
            ![
              'gt-next',
              'gt-next/server',
              'gt-react',
              'gt-react/client',
              'gt-react/browser',
              'gt-i18n',
            ].includes(source.node.source.value)
          )
            return;
          const imported = binding.path.node.imported;
          const name = t.isIdentifier(imported)
            ? imported.name
            : imported.value;
          if (name === 'GtInternalTranslateJsx') translate++;
          if (name === 'GtInternalVar') variable++;
        },
      });
      expect(translate, example.reason).toBe(example.expectedTranslateCount);
      expect(variable, example.reason).toBe(example.expectedVariableCount);
    });
  }
});
