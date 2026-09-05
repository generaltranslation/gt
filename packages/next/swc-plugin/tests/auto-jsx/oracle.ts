import { transformSync } from '@babel/core';
import jsx from '@babel/plugin-transform-react-jsx';
import jsxDevelopment from '@babel/plugin-transform-react-jsx-development';
import { parse } from '@babel/parser';
import traverse, { type NodePath } from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import { transformSync as stripTypes } from '@swc/core';
import { jsxInsertionPass } from '../../../../compiler/src/passes/jsxInsertionPass';
import { initializeState } from '../../../../compiler/src/state/utils/initializeState';
import { createFixtureError } from './diagnostics.mjs';

const missingAstError = createFixtureError({
  whatHappened: 'The reference JSX transform returned no AST',
  fix: 'Check the Babel transform configuration in the fixture oracle',
});

/** Keep comments that select JSX lowering while omitting ordinary printer noise. */
export function isJsxPragmaComment(comment: string): boolean {
  return /^\s*(?:\*\s*)?@jsx(?:ImportSource|Runtime|Frag)?\s+\S+/m.test(
    comment
  );
}

function removeTypes(input: string): string {
  return stripTypes(input, {
    filename: 'input.tsx',
    swcrc: false,
    configFile: false,
    jsc: {
      target: 'esnext',
      parser: { syntax: 'typescript', tsx: true, decorators: true },
      transform: { react: { runtime: 'preserve' } },
    },
  }).code;
}

/** Lower both implementations with the same JSX transform, before comparing. */
export function lower(input: string, development = false): t.File {
  // Both real hosts remove TypeScript-only wrappers before the compiler sees
  // React calls. Preserve JSX here, then share Babel's runtime lowering below.
  const hasJsxPragma =
    input.includes('@jsx') &&
    parse(input, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx', 'decorators-legacy'],
    }).comments?.some((comment) => isJsxPragmaComment(comment.value));
  // With a classic factory pragma, React/h/Fragment imports may be referenced
  // only by the calls JSX will produce. Lower JSX before removing types for
  // pragma-bearing files so SWC cannot erase those live value imports early.
  const source = hasJsxPragma ? input : removeTypes(input);
  const result = transformSync(source, {
    filename: 'input.tsx',
    configFile: false,
    babelrc: false,
    ast: true,
    code: false,
    parserOpts: { plugins: ['typescript', 'jsx', 'decorators-legacy'] },
    plugins: [[development ? jsxDevelopment : jsx, { runtime: 'automatic' }]],
  });
  if (!result?.ast || !t.isFile(result.ast)) throw missingAstError;
  // The real compiler reparses emitted code. Start with fresh bindings rather
  // than Babel's transform-time scope cache (which predates injected imports).
  const emitted = generate(result.ast).code;
  return parse(hasJsxPragma ? removeTypes(emitted) : emitted, {
    sourceType: 'module',
    plugins: ['typescript', 'decorators-legacy'],
  });
}

/** Invoke only the existing compiler insertion pass: no hashing, macros or derive. */
export function oracle(input: string, development = false): t.File {
  return insert(lower(input, development));
}

/** Reference the exact runtime calls emitted by a host's own JSX lowering. */
export function oracleCompiled(input: string): t.File {
  return insert(
    parse(input, { sourceType: 'module', plugins: ['typescript'] })
  );
}

function insert(ast: t.File): t.File {
  const state = initializeState(
    {
      enableAutoJsxInjection: true,
      autoJsxImportSource: 'gt-next',
      compileTimeHash: false,
      enableMacroTransform: false,
      autoderive: false,
      logLevel: 'silent',
    },
    'input.tsx'
  );
  traverse(ast, jsxInsertionPass(state));
  return ast;
}

const wrappers = new Set(['GtInternalTranslateJsx', 'GtInternalVar']);
const runtimeNames = new Set(['jsx', 'jsxs', 'jsxDEV', 'Fragment']);
const isVoidZero = (node: t.Node | null | undefined): boolean =>
  t.isUnaryExpression(node, { operator: 'void' }) &&
  t.isNumericLiteral(node.argument, { value: 0 });

/** Recognize only the inert source record emitted for this harness's filename. */
function generatedDevSource(
  path: NodePath<t.CallExpression>,
  node: t.Node | undefined
): { fileBinding?: string } | undefined {
  if (!t.isObjectExpression(node) || node.properties.length !== 3) return;
  const names = ['fileName', 'lineNumber', 'columnNumber'];
  if (
    !node.properties.every(
      (prop, index) =>
        t.isObjectProperty(prop) &&
        !prop.computed &&
        !prop.shorthand &&
        t.isIdentifier(prop.key, { name: names[index] }) &&
        (index === 0 ||
          (t.isNumericLiteral(prop.value) &&
            Number.isInteger(prop.value.value) &&
            prop.value.value > 0))
    )
  )
    return;
  const file = (node.properties[0] as t.ObjectProperty).value;
  const isFixtureFilename = (value: string): boolean =>
    value === 'input.tsx' || value.replaceAll('\\', '/').endsWith('/input.tsx');
  // SWC embeds the filename directly; Babel uses a generated program binding.
  if (t.isStringLiteral(file) && isFixtureFilename(file.value)) return {};
  if (!t.isIdentifier(file) || !/^_jsxFileName\d*$/.test(file.name)) return;
  const binding = path.scope.getBinding(file.name);
  if (
    binding?.constant &&
    binding.scope.path.isProgram() &&
    binding.path.isVariableDeclarator() &&
    binding.path.parentPath.isVariableDeclaration({ kind: 'var' }) &&
    t.isStringLiteral(binding.path.node.init) &&
    isFixtureFilename(binding.path.node.init.value)
  )
    return { fileBinding: file.name };
}

/**
 * Custom automatic runtimes and classic factories keep their own development
 * metadata in canonical output. Their development output must be compared with
 * the same host/mode, rather than asserting equality with production output.
 */
function inspectJsxDevelopmentCalls(ast: t.File): {
  unnormalized: boolean;
  unsupported: boolean;
} {
  let found = false;
  let unsupported = false;
  traverse(ast, {
    CallExpression(path) {
      const callee = path.node.callee;
      const binding = t.isIdentifier(callee)
        ? path.scope.getBinding(callee.name)?.path
        : undefined;
      const imported = binding?.isImportSpecifier()
        ? binding.node.imported
        : undefined;
      const source = binding?.parentPath?.isImportDeclaration()
        ? binding.parentPath.node.source.value
        : undefined;
      const name = t.isIdentifier(imported)
        ? imported.name
        : t.isStringLiteral(imported)
          ? imported.value
          : undefined;
      if (
        name === 'jsxDEV' &&
        source?.endsWith('/jsx-dev-runtime') &&
        source !== 'react/jsx-dev-runtime'
      ) {
        found = true;
        unsupported = true;
        return;
      }
      const props = path.node.arguments[1];
      if (!t.isObjectExpression(props)) return;
      const metadata = props.properties.find(
        (prop) =>
          t.isObjectProperty(prop) &&
          !prop.computed &&
          t.isIdentifier(prop.key, { name: '__source' })
      );
      if (
        !t.isObjectProperty(metadata) ||
        !generatedDevSource(path, metadata.value)
      )
        return;
      if (!source || !/^react\/jsx(-dev)?-runtime$/.test(source))
        unsupported = true;
      if (
        !(source === 'react' && name === 'createElement') ||
        props.properties.every(
          (prop) =>
            prop === metadata ||
            (t.isObjectProperty(prop) &&
              !prop.computed &&
              t.isIdentifier(prop.key, { name: '__self' }) &&
              t.isThisExpression(prop.value))
        )
      )
        found = true;
    },
  });
  return { unnormalized: found, unsupported };
}

export function hasUnnormalizedJsxDevelopmentMetadata(ast: t.File): boolean {
  return inspectJsxDevelopmentCalls(ast).unnormalized;
}

/** Actual lowered custom runtime/classic calls outside the compiler recognizer. */
export function hasUnsupportedJsxCalls(ast: t.File): boolean {
  return inspectJsxDevelopmentCalls(ast).unsupported;
}

/**
 * Canonicalize only runtime helper aliases and compiler-generated wrapper aliases.
 * Preserve all user expressions, child array nesting/order, props, keys and imports.
 * jsx/jsxs/jsxDEV share element semantics; dev source locations are not content.
 */
export function canonical(ast: t.File): string {
  ast = t.cloneNode(ast, true);
  const devFileNames = new Set<string>();
  const devCalls = new WeakSet<t.CallExpression>();
  const createElementNames = new Set<string>();
  const identifiers = new Set<string>();
  traverse(ast, {
    Identifier(path) {
      identifiers.add(path.node.name);
    },
  });
  let prefix = '$gtParity';
  while ([...identifiers].some((name) => name.startsWith(prefix)))
    prefix += '_';
  const jsxName = `${prefix}Jsx`;
  const translateName = `${prefix}GtInternalTranslateJsx`;
  traverse(ast, {
    enter(path) {
      delete path.node.extra;
    },
    Program: {
      enter(path) {
        path.scope.crawl();
        for (const statement of path.get('body')) {
          if (!statement.isImportDeclaration()) continue;
          const runtime = /^react\/jsx(-dev)?-runtime$/.test(
            statement.node.source.value
          );
          for (const specifier of statement.get('specifiers')) {
            if (!specifier.isImportSpecifier()) continue;
            const imported = specifier.node.imported;
            const name = t.isIdentifier(imported)
              ? imported.name
              : imported.value;
            // Record the original imported kind before jsx/jsxs/jsxDEV aliases
            // converge. Scope references exclude user functions shadowing it.
            if (runtime && name === 'jsxDEV') {
              const binding = path.scope.getBinding(specifier.node.local.name);
              for (const reference of binding?.referencePaths ?? [])
                if (
                  reference.parentPath?.isCallExpression() &&
                  reference.key === 'callee'
                )
                  devCalls.add(reference.parentPath.node);
            }
            if (
              statement.node.source.value === 'react' &&
              name === 'createElement'
            )
              createElementNames.add(specifier.node.local.name);
            if (
              (runtime && runtimeNames.has(name)) ||
              (statement.node.source.value === 'gt-next' && wrappers.has(name))
            ) {
              const canonicalName =
                runtime && name !== 'Fragment' ? jsxName : `${prefix}${name}`;
              path.scope.rename(specifier.node.local.name, canonicalName);
            }
          }
        }
      },
      exit(path) {
        path.scope.crawl();
        for (const name of devFileNames) {
          const binding = path.scope.getBinding(name);
          if (
            binding &&
            !binding.referenced &&
            binding.constant &&
            binding.path.isVariableDeclarator() &&
            t.isStringLiteral(binding.path.node.init)
          )
            binding.path.remove();
        }
      },
    },
    CallExpression(path) {
      // Babel's key-after-spread fallback uses createElement, including legacy
      // __source/__self metadata in development rather than jsxDEV arguments.
      if (
        t.isIdentifier(path.node.callee) &&
        createElementNames.has(path.node.callee.name) &&
        path.scope
          .getBinding(path.node.callee.name)
          ?.path.isImportSpecifier() &&
        t.isObjectExpression(path.node.arguments[1])
      ) {
        const props = path.node.arguments[1];
        const source = props.properties.find(
          (prop) =>
            t.isObjectProperty(prop) &&
            !prop.computed &&
            t.isIdentifier(prop.key, { name: '__source' })
        );
        const metadata = t.isObjectProperty(source)
          ? generatedDevSource(path, source.value)
          : undefined;
        if (metadata) {
          if (metadata.fileBinding) devFileNames.add(metadata.fileBinding);
          props.properties = props.properties.filter(
            (prop) =>
              prop !== source &&
              !(
                t.isObjectProperty(prop) &&
                !prop.computed &&
                t.isIdentifier(prop.key, { name: '__self' }) &&
                t.isThisExpression(prop.value)
              )
          );
        }
      }
      // The reference pass falls back to an unbound `jsx` for an injected T
      // around a single array child when only aliased `jsx` was imported.
      // Compare its component tree, without reproducing that helper-binding bug.
      if (
        t.isIdentifier(path.node.callee, { name: 'jsx' }) &&
        !path.scope.getBinding('jsx') &&
        t.isIdentifier(path.node.arguments[0], { name: translateName })
      )
        path.node.callee = t.identifier(jsxName);
      if (t.isIdentifier(path.node.callee, { name: jsxName })) {
        const args = path.node.arguments;
        if (devCalls.has(path.node) && t.isBooleanLiteral(args[3])) {
          const metadata = generatedDevSource(path, args[4]);
          const generatedWrapper =
            t.isIdentifier(args[0]) &&
            [translateName, `${prefix}GtInternalVar`].includes(args[0].name) &&
            isVoidZero(args[2]) &&
            // Babel's compiler wrappers omit source/self; SWC's DUMMY_SP
            // wrappers retain an inert missing source and self argument.
            (args.length === 4 ||
              (args.length === 6 &&
                isVoidZero(args[4]) &&
                (t.isThisExpression(args[5]) || isVoidZero(args[5]))));
          // Fragment syntax has no source/self record in Babel's JSX runtime.
          // The fresh canonical name exists only for a bound runtime Fragment.
          const generatedFragment =
            args.length === 4 &&
            t.isIdentifier(args[0], { name: `${prefix}Fragment` }) &&
            isVoidZero(args[2]);
          if (
            generatedWrapper ||
            generatedFragment ||
            (metadata &&
              (args.length === 5 ||
                (args.length === 6 &&
                  (t.isThisExpression(args[5]) || isVoidZero(args[5])))))
          ) {
            if (metadata?.fileBinding) devFileNames.add(metadata.fileBinding);
            path.node.arguments = args.slice(0, 3);
          }
        }
        const key = path.node.arguments[2];
        if (path.node.arguments.length === 3 && isVoidZero(key))
          path.node.arguments.pop();
      }
    },
    ImportDeclaration(path) {
      if (!path.node.specifiers.length) return;
      const runtime = /^react\/jsx(-dev)?-runtime$/.test(
        path.node.source.value
      );
      path.node.specifiers = path.node.specifiers.filter((specifier) => {
        if (!t.isImportSpecifier(specifier)) return true;
        const imported = specifier.imported;
        const name = t.isIdentifier(imported) ? imported.name : imported.value;
        return (
          !(runtime && runtimeNames.has(name)) &&
          !(path.node.source.value === 'gt-next' && wrappers.has(name))
        );
      });
      if (
        !path.node.specifiers.length &&
        (runtime || path.node.source.value === 'gt-next')
      )
        path.remove();
    },
  });
  // Reparse to discard printer-specific optional fields, locations and raw quotes.
  return generate(
    parse(generate(ast, { comments: false }).code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx', 'decorators-legacy'],
    }),
    { comments: false, compact: true, jsescOption: { minimal: true } }
  ).code;
}

/** Invert only React runtime calls for human-readable, compiler-authored fixtures. */
export function readableOutput(ast: t.File, originalInput?: string): string {
  if (originalInput?.includes('@jsx')) {
    const original = parse(originalInput, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx', 'decorators-legacy'],
    });
    if (
      original.comments?.some((comment) => isJsxPragmaComment(comment.value)) &&
      hasUnsupportedJsxCalls(lower(originalInput, true)) &&
      canonical(lower(originalInput)) === canonical(ast)
    ) {
      // The actual compiler proved this source is unchanged. Keep its original
      // JSX for no-insertion runtimes rather than inventing an inverse for an
      // arbitrary factory; comparison still checks the complete lowered output.
      return `${
        generate(original, {
          comments: false,
          shouldPrintComment: isJsxPragmaComment,
          jsescOption: { minimal: true },
        }).code
      }\n`;
    }
  }
  ast = t.cloneNode(ast, true);
  const callees = new Set<string>();
  const fragments = new Set<string>();
  for (const statement of ast.program.body) {
    if (
      !t.isImportDeclaration(statement) ||
      !/^react\/jsx(-dev)?-runtime$/.test(statement.source.value)
    )
      continue;
    for (const specifier of statement.specifiers) {
      if (!t.isImportSpecifier(specifier)) continue;
      const name = t.isIdentifier(specifier.imported)
        ? specifier.imported.name
        : specifier.imported.value;
      (name === 'Fragment' ? fragments : callees).add(specifier.local.name);
    }
  }
  const jsxName = (
    node: t.Expression
  ): t.JSXIdentifier | t.JSXMemberExpression => {
    if (t.isStringLiteral(node)) return t.jsxIdentifier(node.value);
    if (t.isIdentifier(node)) return t.jsxIdentifier(node.name);
    if (
      t.isMemberExpression(node) &&
      !node.computed &&
      t.isIdentifier(node.property)
    ) {
      return t.jsxMemberExpression(
        jsxName(node.object),
        t.jsxIdentifier(node.property.name)
      );
    }
    throw createFixtureError({
      whatHappened: 'The fixture printer cannot represent this JSX tag',
      details: node.type,
      fix: 'Add support for this tag shape to the fixture printer',
    });
  };
  traverse(ast, {
    CallExpression: {
      exit(path) {
        if (!t.isIdentifier(path.node.callee)) return;
        const referenceFallback =
          path.node.callee.name === 'jsx' &&
          !path.scope.getBinding('jsx') &&
          t.isIdentifier(path.node.arguments[0], {
            name: 'GtInternalTranslateJsx',
          });
        if (!callees.has(path.node.callee.name) && !referenceFallback) return;
        const [tag, props, key] = path.node.arguments;
        if (!t.isExpression(tag) || !t.isObjectExpression(props)) return;
        const attrs: (t.JSXAttribute | t.JSXSpreadAttribute)[] = [];
        const children: t.JSXElement['children'] = [];
        // Runtime keys have already been lifted out of props. Put them first:
        // key after a spread would cause Babel to switch to createElement.
        if (key && t.isExpression(key) && !isVoidZero(key))
          attrs.push(
            t.jsxAttribute(
              t.jsxIdentifier('key'),
              t.jsxExpressionContainer(key)
            )
          );
        for (const prop of props.properties) {
          if (t.isSpreadElement(prop)) {
            attrs.push(t.jsxSpreadAttribute(prop.argument));
            continue;
          }
          if (!t.isObjectProperty(prop) || !t.isExpression(prop.value)) {
            attrs.push(t.jsxSpreadAttribute(t.objectExpression([prop])));
            continue;
          }
          const name = t.isIdentifier(prop.key)
            ? prop.key.name
            : t.isStringLiteral(prop.key)
              ? prop.key.value
              : null;
          // Re-emitting these as JSX attributes would lift key out of props,
          // expand shorthand __proto__ into a prototype setter, or change the
          // compiler's distinction between quoted and identifier children keys.
          if (
            prop.shorthand ||
            t.isStringLiteral(prop.key) ||
            ['key', '__self', '__source'].includes(name ?? '')
          ) {
            attrs.push(t.jsxSpreadAttribute(t.objectExpression([prop])));
            continue;
          }
          if (
            name === 'children' &&
            !prop.computed &&
            prop === props.properties.at(-1)
          ) {
            // Preserve child arrays, including holes/spreads, as a single expression.
            children.push(
              t.isJSXElement(prop.value) || t.isJSXFragment(prop.value)
                ? prop.value
                : t.jsxExpressionContainer(prop.value)
            );
          } else if (name && !prop.computed) {
            attrs.push(
              t.jsxAttribute(
                t.jsxIdentifier(name),
                t.jsxExpressionContainer(prop.value)
              )
            );
          } else {
            attrs.push(t.jsxSpreadAttribute(t.objectExpression([prop])));
          }
        }
        if (t.isIdentifier(tag) && fragments.has(tag.name) && !attrs.length) {
          path.replaceWith(
            t.jsxFragment(
              t.jsxOpeningFragment(),
              t.jsxClosingFragment(),
              children
            )
          );
        } else {
          const name = jsxName(tag);
          path.replaceWith(
            t.jsxElement(
              t.jsxOpeningElement(name, attrs, !children.length),
              children.length ? t.jsxClosingElement(t.cloneNode(name)) : null,
              children
            )
          );
        }
      },
    },
  });
  let pendingPragmas: t.Comment[] = [];
  ast.program.body = ast.program.body.filter((statement) => {
    const preservePragmas = (): true => {
      if (pendingPragmas.length) {
        const comments = [
          ...pendingPragmas,
          ...(statement.leadingComments ?? []),
        ];
        statement.leadingComments = comments.filter(
          (comment, index) =>
            comments.findIndex(
              (other) =>
                other.start === comment.start &&
                other.end === comment.end &&
                other.type === comment.type &&
                other.value === comment.value
            ) === index
        );
        pendingPragmas = [];
      }
      return true;
    };
    if (
      !t.isImportDeclaration(statement) ||
      !/^react\/jsx(-dev)?-runtime$/.test(statement.source.value)
    )
      return preservePragmas();
    if (!statement.specifiers.length) return preservePragmas();
    statement.specifiers = statement.specifiers.filter(
      (specifier) =>
        t.isImportSpecifier(specifier) && fragments.has(specifier.local.name)
    );
    if (statement.specifiers.length) return preservePragmas();
    // Type stripping can move a pragma from an unused React import onto the
    // generated runtime import. Carry it to the next retained statement when
    // reversing that import, retaining its position relative to other pragmas.
    pendingPragmas.push(
      ...[
        ...(statement.leadingComments ?? []),
        ...(statement.trailingComments ?? []),
      ].filter((comment) => isJsxPragmaComment(comment.value))
    );
    return false;
  });
  if (pendingPragmas.length)
    ast.program.trailingComments = [
      ...pendingPragmas,
      ...(ast.program.trailingComments ?? []),
    ];
  return `${
    generate(ast, {
      comments: false,
      shouldPrintComment: isJsxPragmaComment,
      jsescOption: { minimal: true },
    }).code
  }\n`;
}
