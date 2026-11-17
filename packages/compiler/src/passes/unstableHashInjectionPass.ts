import generate from '@babel/generator';
import { TraverseOptions } from '@babel/traverse';
import * as t from '@babel/types';
import { isUnstableGTImportSource } from 'generaltranslation/internal';
import { TransformState } from '../state/types';
import {
  injectUnstableTaggedTemplateHash,
  type TemplateSourceReplacer,
} from '../transform/injection/injectUnstableTaggedTemplateHash';
import { buildInlineTranslations } from '../transform/injection/inline-translations/injectInlineTranslations';
import { replaceTemplateSource } from '../transform/injection/inline-translations/replaceTemplateSource';
import type { HoistMessage } from '../transform/injection/precomputeUnstableMessage';
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
  const { sourceReplacement } = state.settings;
  const replaceSource = getTemplateSourceReplacer(state);
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
            ? { hoist, replacedLocale: sourceReplacement?.locale }
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

/**
 * How this build replaces the source content of templates: with the static
 * locale's embedded translations, or with the source text itself when that
 * locale renders the source.
 */
function getTemplateSourceReplacer(
  state: TransformState
): TemplateSourceReplacer | undefined {
  const { sourceReplacement, inlineTranslationsTable } = state.settings;
  if (!sourceReplacement) return undefined;
  const translations =
    sourceReplacement.locale === undefined
      ? undefined
      : inlineTranslationsTable?.[sourceReplacement.locale];
  if (sourceReplacement.locale !== undefined && !translations) return undefined;

  const keep = (message: string, quasi: t.TemplateLiteral) => {
    state.statistics.sourceReplacementFallbacksCount += 1;
    state.logger.logDebug(
      message +
        createErrorLocation(quasi).replace(
          '{filename}',
          state.settings.filename ?? ''
        )
    );
    return undefined;
  };
  return {
    getText(hash, source, { maxChars }, quasi) {
      const text = translations ? translations[hash] : source;
      if (typeof text !== 'string') return undefined;
      if (maxChars !== undefined) {
        // An embedded template still has its text replaced
        return translations
          ? undefined
          : keep(
              `Kept template ${hash} as a call: maxChars cuts its text off at runtime`,
              quasi
            );
      }
      state.statistics.sourceReplacementsCount += 1;
      return text;
    },
    replaceTemplate: translations
      ? (hash, quasi) => {
          if (translations[hash] === undefined) return undefined;
          const replacement = replaceTemplateSource(quasi, translations[hash]);
          if (replacement.quasi) {
            state.statistics.sourceReplacementsCount += 1;
            return replacement.quasi;
          }
          return keep(
            `Kept the source of template ${hash}, with its embedded translation: ${replacement.reason}`,
            quasi
          );
        }
      : undefined,
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
