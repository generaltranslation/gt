import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { createErrorLocation } from '../../utils/errors';
import { getHelperName } from '../injection/injectUnstableTaggedTemplateHash';

/**
 * A call site a static-runtime build resolves, in a form the compiler does
 * not transform:
 * - `jsx`: `<T>` still written as JSX, where the compiler reads the calls JSX
 *   compiles to;
 * - `template`: a `t` template already compiled to a call that takes a
 *   template object, as tools that target ES5 write tagged templates.
 */
export type UncompiledStaticCallSite = {
  kind: 'jsx' | 'template';
  /** How the module writes it: `T`, `Trans`, `GT.T` or `t` */
  name: string;
  /** The module it is imported from */
  source: string;
  node: t.Node;
};

// The helpers and variables TypeScript, Babel, SWC and esbuild write a
// compiled tagged template's strings with
const TEMPLATE_OBJECT_NAME =
  /template_?object|tagged_?template_?literal|^__template$/i;

const TRANSLATION_COMPONENT = 'T';

const MAX_LOCATIONS = 5;

/**
 * Reads a reference to an import from a GT package as an uncompiled call
 * site: `<T>` or `<GT.T>` as JSX, or `t` called with a template object.
 * Undefined for any other use, which needs the GT runtime as it is written.
 * @param imported The name the package exports it by; undefined for a namespace import.
 */
export function getUncompiledStaticCallSite(
  reference: NodePath,
  imported: string | undefined,
  source: string
): UncompiledStaticCallSite | undefined {
  const { node, parentPath } = reference;
  if (t.isJSXIdentifier(node) && parentPath) {
    if (
      parentPath.isJSXOpeningElement() &&
      imported === TRANSLATION_COMPONENT
    ) {
      return { kind: 'jsx', name: node.name, source, node: parentPath.node };
    }
    if (
      parentPath.isJSXMemberExpression() &&
      parentPath.node.object === node &&
      parentPath.node.property.name === TRANSLATION_COMPONENT &&
      parentPath.parentPath.isJSXOpeningElement()
    ) {
      return {
        kind: 'jsx',
        name: `${node.name}.${TRANSLATION_COMPONENT}`,
        source,
        node: parentPath.parent,
      };
    }
    return undefined;
  }
  if (
    !t.isIdentifier(node) ||
    !parentPath?.isCallExpression() ||
    parentPath.node.callee !== node ||
    getHelperName(node.name, reference.scope) !== 't'
  ) {
    return undefined;
  }
  // t(strings, ...values), or t({ context })(strings, ...values)
  const outer = parentPath.parentPath;
  const call =
    outer.isCallExpression() && outer.node.callee === parentPath.node
      ? outer.node
      : parentPath.node;
  const [strings] = call.arguments;
  return strings && isTemplateObject(strings)
    ? { kind: 'template', name: node.name, source, node: call }
    : undefined;
}

/**
 * The build error for a module whose call sites reached the compiler
 * uncompiled. `framework` is the bundler the plugin runs in, which decides
 * the fix.
 */
export function createUncompiledStaticCallSitesError(
  sites: UncompiledStaticCallSite[],
  filename: string,
  framework: string
): string {
  const [first] = sites;
  const sameKind = sites.filter((site) => site.kind === first.kind);
  const isJsx = first.kind === 'jsx';
  return createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Error',
    whatHappened: `This static-runtime build cannot resolve ${
      isJsx
        ? `<${first.name}> from "${first.source}"`
        : `a ${first.name} template from "${first.source}"`
    }`,
    why: `the compiler received it as ${
      isJsx
        ? 'JSX that is not compiled yet'
        : 'a call that takes a template object, not as a tagged template'
    }, and experimentalStaticRuntime leaves out the GT runtime that would render it`,
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
    return 'esbuild runs plugins before it compiles JSX, so its plugin cannot resolve <T>: build with Vite, webpack, Rspack or Rollup, write these messages as t templates from gt-react/unstable, or turn off experimentalStaticRuntime';
  }
  // Rolldown runs the plugin Rollup does
  if (framework === 'rollup' || framework === 'rolldown') {
    return 'Compile JSX before this plugin runs, with a plugin listed ahead of it. In Rolldown, which compiles JSX after its plugins run, the transform of that plugin can return transformSync(id, code, { jsx: { runtime: "automatic" } }) from rolldown/utils for .jsx and .tsx files';
  }
  return 'Compile JSX before this plugin runs: put the plugin or loader that compiles JSX ahead of it, and make sure it handles this file';
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
