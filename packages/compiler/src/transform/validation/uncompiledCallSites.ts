import traverse from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { isUnstableGTImportSource } from 'generaltranslation/internal';
import {
  isGTImportSource,
  isTranslationComponent,
} from '../../utils/constants/gt/helpers';
import { createErrorLocation } from '../../utils/errors';
import { getUnstableTag } from '../injection/injectUnstableTaggedTemplateHash';

/**
 * A call site the compiler embeds translations at, in a form it does not
 * transform:
 * - `jsx`: `<T>` still written as JSX, where the compiler reads the calls JSX
 *   compiles to;
 * - `template`: a `t` template already compiled to a call that takes a
 *   template object, as tools that target ES5 write tagged templates.
 */
export type UncompiledCallSite = {
  kind: 'jsx' | 'template';
  /** How the module writes it: `T`, `Trans`, `GT.T`, `t` or `gt` */
  name: string;
  /** The module it is imported from */
  source: string;
  node: t.Node;
};

// The helpers and variables TypeScript, Babel, SWC and esbuild write a
// compiled tagged template's strings with
const TEMPLATE_OBJECT_NAME =
  /template_?object|tagged_?template_?literal|^__template$/i;

const MAX_LOCATIONS = 5;

/**
 * The call sites of `ast` the compiler cannot transform because of how they
 * reached it. At runtime they render as if no compiler ran: without a hash
 * and without an embedded translation.
 */
export function findUncompiledCallSites(ast: t.File): UncompiledCallSite[] {
  if (!ast.program.body.some(importsEmbeddableApi)) return [];
  const sites: UncompiledCallSite[] = [];
  traverse(ast, {
    JSXOpeningElement(path) {
      const component = getTranslationComponent(path);
      if (component) sites.push({ kind: 'jsx', ...component, node: path.node });
    },
    CallExpression(path) {
      const { callee, arguments: args } = path.node;
      // t(strings, ...values), or t({ context })(strings, ...values)
      const tag = t.isCallExpression(callee) ? callee.callee : callee;
      if (
        !t.isIdentifier(tag) ||
        !args[0] ||
        !isTemplateObject(args[0]) ||
        isTypeImport(path.scope.getBinding(tag.name)?.path)
      ) {
        return;
      }
      const unstableTag = getUnstableTag(tag.name, path.scope);
      if (unstableTag?.kind !== 'gt') return;
      sites.push({
        kind: 'template',
        name: tag.name,
        source: unstableTag.source,
        node: path.node,
      });
    },
  });
  return sites;
}

/**
 * The error for a module whose call sites reached the compiler uncompiled, in
 * a build that embeds translations. `framework` is the bundler the plugin
 * runs in, which decides the fix.
 */
export function createUncompiledCallSitesError(
  sites: UncompiledCallSite[],
  filename: string,
  framework: string
): string {
  const [first] = sites;
  const sameKind = sites.filter((site) => site.kind === first.kind);
  const isJsx = first.kind === 'jsx';
  const subject = isJsx
    ? `<${first.name}> from "${first.source}"`
    : `a ${first.name} template from "${first.source}"`;
  return createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Error',
    whatHappened: `This build would show ${subject} in the source language`,
    why: `the compiler received it as ${
      isJsx
        ? 'JSX that is not compiled yet'
        : 'a call that takes a template object, not as a tagged template,'
    } and embeds no translation for it, while files.gt.inlineTranslations leaves embedded translations out of msgOutput files`,
    fix: isJsx ? getJsxFix(framework) : TEMPLATE_FIX,
    details: [
      ...sameKind
        .slice(0, MAX_LOCATIONS)
        .map((site) =>
          createErrorLocation(site.node).trim().replace('{filename}', filename)
        ),
      ...(sameKind.length > MAX_LOCATIONS
        ? [`and ${sameKind.length - MAX_LOCATIONS} more in this file`]
        : []),
    ],
  });
}

const TEMPLATE_FIX =
  'Raise the target of the tool that compiles this file before the plugin runs, so tagged templates stay as they are: jsc.target: "es2022" for SWC, "target": "ES2015" or later in tsconfig.json, or Babel targets that support template literals';

function getJsxFix(framework: string): string {
  if (framework === 'esbuild') {
    return 'esbuild runs plugins before it compiles JSX, so its plugin cannot embed translations of <T>: build with Vite, webpack, Rspack or Rollup, write these messages as t templates from gt-react/unstable, or remove files.gt.inlineTranslations from gt.config.json';
  }
  // Rolldown runs the plugin Rollup does
  if (framework === 'rollup' || framework === 'rolldown') {
    return 'Compile JSX before this plugin runs, with a plugin listed ahead of it. In Rolldown, which compiles JSX after its plugins run, the transform of that plugin can return transformSync(id, code, { jsx: { runtime: "automatic" } }) from rolldown/utils for .jsx and .tsx files';
  }
  return 'Compile JSX before this plugin runs: put the plugin or loader that compiles JSX ahead of it, and make sure it handles this file';
}

/** Whether a statement imports from an entry that exports `T` or `t`. */
function importsEmbeddableApi(statement: t.Statement): boolean {
  if (!t.isImportDeclaration(statement) || statement.importKind === 'type') {
    return false;
  }
  const source = statement.source.value;
  return isUnstableGTImportSource(source) || isGTImportSource(source);
}

/** `T` as a module imports it from a GT package: `<T>`, `<Trans>` or `<GT.T>`. */
function getTranslationComponent(
  path: NodePath<t.JSXOpeningElement>
): { name: string; source: string } | undefined {
  const { name } = path.node;
  if (t.isJSXIdentifier(name)) {
    const binding = path.scope.getBinding(name.name);
    if (!binding?.path.isImportSpecifier() || isTypeImport(binding.path)) {
      return undefined;
    }
    const { imported } = binding.path.node;
    const source = getGTImportSource(binding.path.parent);
    return source !== undefined &&
      isTranslationComponent(
        t.isIdentifier(imported) ? imported.name : imported.value
      )
      ? { name: name.name, source }
      : undefined;
  }
  if (t.isJSXMemberExpression(name) && t.isJSXIdentifier(name.object)) {
    const binding = path.scope.getBinding(name.object.name);
    if (
      !binding?.path.isImportNamespaceSpecifier() ||
      isTypeImport(binding.path)
    ) {
      return undefined;
    }
    const source = getGTImportSource(binding.path.parent);
    return source !== undefined && isTranslationComponent(name.property.name)
      ? { name: `${name.object.name}.${name.property.name}`, source }
      : undefined;
  }
  return undefined;
}

function getGTImportSource(declaration: t.Node): string | undefined {
  return t.isImportDeclaration(declaration) &&
    isGTImportSource(declaration.source.value)
    ? declaration.source.value
    : undefined;
}

/** `import type { T }`, `import { type T }` or `import type * as GT`, which name no value. */
function isTypeImport(path: NodePath | undefined): boolean {
  return (
    !!path &&
    t.isImportDeclaration(path.parent) &&
    (path.parent.importKind === 'type' ||
      (path.isImportSpecifier() && path.node.importKind === 'type'))
  );
}

/**
 * Whether an argument is the strings of a compiled tagged template:
 * `_templateObject()`,
 * `_templateObject || (_templateObject = _taggedTemplateLiteral([...]))`,
 * `templateObject_1 || (templateObject_1 = __makeTemplateObject([...], [...]))`
 * or `_a || (_a = __template([...]))`.
 */
function isTemplateObject(node: t.Node): boolean {
  if (t.isIdentifier(node)) return TEMPLATE_OBJECT_NAME.test(node.name);
  if (t.isCallExpression(node)) return isTemplateObject(node.callee);
  if (t.isLogicalExpression(node)) {
    return isTemplateObject(node.left) || isTemplateObject(node.right);
  }
  if (t.isAssignmentExpression(node)) return isTemplateObject(node.right);
  if (t.isParenthesizedExpression(node)) {
    return isTemplateObject(node.expression);
  }
  return false;
}
