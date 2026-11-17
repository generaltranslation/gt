import generate from '@babel/generator';
import type { MessageTree } from '@generaltranslation/icu';
import { TraverseOptions } from '@babel/traverse';
import * as t from '@babel/types';
import { isUnstableGTImportSource } from 'generaltranslation/internal';
import { TransformState } from '../state/types';
import { injectUnstableTaggedTemplateHash } from '../transform/injection/injectUnstableTaggedTemplateHash';
import { buildInlineTranslations } from '../transform/injection/inline-translations/injectInlineTranslations';
import { replaceTemplateSource } from '../transform/injection/inline-translations/replaceTemplateSource';
import type { HoistMessage } from '../transform/injection/precomputeUnstableMessage';
import { canReplaceMessageTree } from '../transform/injection/replaceMessageTree';
import { createErrorLocation } from '../utils/errors';

// Name of the module-scope constants that hold precomputed messages
const MESSAGE_NAME = 'gt';

/**
 * Unstable hash injection pass — injects `$_hash` into statically analyzable
 * unstable tagged templates (t`...`), and in production builds with
 * `files.gt.inlineTranslations` the translations embedded at the call site.
 * Each template is hashed and rewritten in the same visit, so this pass needs
 * no collection counters.
 *
 * A static t template is replaced by a call with its precomputed message. A
 * message with values is declared once at module scope, after the imports.
 */
export function unstableHashInjectionPass(
  state: TransformState
): TraverseOptions {
  const buildInline = state.settings.inlineTranslationsTable
    ? (hash: string) => buildInlineTranslations(hash, state)
    : undefined;
  const { sourceReplacement, inlineTranslationsTable } = state.settings;
  const translations =
    sourceReplacement && inlineTranslationsTable?.[sourceReplacement.locale];
  const replaceSource = translations
    ? (hash: string, quasi: t.TemplateLiteral) => {
        if (translations[hash] === undefined) return undefined;
        const replacement = replaceTemplateSource(quasi, translations[hash]);
        if (replacement.quasi) {
          state.statistics.sourceReplacementsCount += 1;
          return replacement.quasi;
        }
        state.statistics.sourceReplacementFallbacksCount += 1;
        state.logger.logDebug(
          `Kept the source of template ${hash}, with its embedded translation: ${replacement.reason}` +
            createErrorLocation(quasi).replace(
              '{filename}',
              state.settings.filename ?? ''
            )
        );
        return undefined;
      }
    : undefined;
  const replaceTree = translations
    ? (hash: string, source: MessageTree) => {
        const translation = translations[hash];
        if (!canReplaceMessageTree(source, translation)) return undefined;
        // replaceSource counted this template as kept.
        state.statistics.sourceReplacementsCount += 1;
        state.statistics.sourceReplacementFallbacksCount -= 1;
        state.logger.logDebug(
          `Replaced template ${hash} with its translation's message tree`
        );
        return translation;
      }
    : undefined;
  const declarations: t.VariableDeclaration[] = [];
  // Call sites with the same message share one, by its code.
  const hoisted = new Map<string, t.Identifier>();
  return {
    TaggedTemplateExpression(path) {
      const hoist: HoistMessage = (message) => {
        const { code } = generate(message, { compact: true });
        let id = hoisted.get(code);
        if (!id) {
          id = path.scope
            .getProgramParent()
            .generateUidIdentifier(MESSAGE_NAME);
          hoisted.set(code, id);
          declarations.push(
            t.variableDeclaration('const', [t.variableDeclarator(id, message)])
          );
        }
        return t.cloneNode(id);
      };
      if (
        injectUnstableTaggedTemplateHash(
          path,
          buildInline,
          replaceSource,
          state.settings.precomputeMessages
            ? { hoist, replacedLocale: sourceReplacement?.locale, replaceTree }
            : undefined
        )
      ) {
        state.statistics.unstableHashInjectionsCount += 1;
      }
    },
    Program: {
      exit(path) {
        const { body } = path.node;
        // After the imports, so a message reads a message module's import.
        const start =
          body
            .map((statement) => statement.type)
            .lastIndexOf('ImportDeclaration') + 1;
        body.splice(start, 0, ...declarations);
      },
    },
  };
}

/** Whether a file imports an unstable source, so the pass can be skipped. */
export function importsUnstableSource(ast: t.File): boolean {
  return ast.program.body.some(
    (statement) =>
      t.isImportDeclaration(statement) &&
      isUnstableGTImportSource(statement.source.value)
  );
}
