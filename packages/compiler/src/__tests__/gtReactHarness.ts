import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import generateModule from '@babel/generator';
import * as t from '@babel/types';
import { transformSync } from 'esbuild';
import { vi } from 'vitest';

const generate =
  (generateModule as unknown as { default?: typeof generateModule }).default ??
  generateModule;

// gt-react's browser builds, which its export conditions hide from Node
const GT_REACT_DIST = fileURLToPath(
  new URL('../../node_modules/gt-react/dist/', import.meta.url)
);

type Module = Record<string, unknown>;

export type GTRuntime = {
  modules: Record<string, Module>;
  /** Static HTML for a component, after anything it suspends on resolves */
  render: (component: unknown, props?: unknown) => Promise<string>;
};

/**
 * gt-react's SPA runtime in `locale`, which is `en` or `fr`, and the modules
 * compiled code imports. React comes from gt-react's install, so gt-react and
 * react-core share one copy.
 */
export async function loadGTRuntime(
  locale: string,
  loadTranslations: (locale: string) => Promise<Record<string, unknown>>
): Promise<GTRuntime> {
  // The SPA condition store keeps the locale in a cookie, which Node lacks
  const cookies = new Map<string, string>();
  vi.stubGlobal('document', {
    get cookie() {
      return Array.from(cookies, ([name, value]) => `${name}=${value}`).join(
        '; '
      );
    },
    set cookie(cookie: string) {
      const [pair] = cookie.split(';');
      const index = pair.indexOf('=');
      cookies.set(pair.slice(0, index), pair.slice(index + 1));
    },
  });
  const requireFromGtReact = createRequire(GT_REACT_DIST);
  const react = requireFromGtReact('react') as Module;
  const { prerenderToNodeStream } = requireFromGtReact('react-dom/static') as {
    prerenderToNodeStream: (
      element: unknown
    ) => Promise<{ prelude: AsyncIterable<Buffer> }>;
  };
  const createElement = react.createElement as (
    type: unknown,
    props?: unknown
  ) => unknown;
  const gtReact = (await import(
    path.join(GT_REACT_DIST, 'index.client.mjs')
  )) as Module & { initializeGTSPA: (config: unknown) => Promise<void> };
  await gtReact.initializeGTSPA({
    defaultLocale: 'en',
    locales: ['en', 'fr'],
    locale,
    loadTranslations,
  });
  return {
    modules: {
      react,
      'react/jsx-runtime': requireFromGtReact('react/jsx-runtime') as Module,
      'gt-react': gtReact,
    },
    render: async (component, props) => {
      const { prelude } = await prerenderToNodeStream(
        createElement(component, props)
      );
      let html = '';
      for await (const chunk of prelude) html += chunk.toString();
      // Separators between adjacent text nodes depend on how children are split
      return html.replaceAll('<!-- -->', '');
    },
  };
}

/** JSX source as a production build hands it to the plugin. */
export function compileJsx(source: string): string {
  return transformSync(source, {
    loader: 'tsx',
    jsx: 'automatic',
    jsxDev: false,
    format: 'esm',
  }).code;
}

/**
 * Runs an ES module's code with its imports taken from `modules`, and returns
 * its named exports.
 */
export function evaluateModule(
  code: string,
  modules: Record<string, Record<string, unknown>>
): Record<string, unknown> {
  const program = parse(code, { sourceType: 'module' }).program;
  const body: t.Statement[] = [];
  const exported: string[] = [];
  for (const statement of program.body) {
    if (t.isImportDeclaration(statement)) {
      for (const specifier of statement.specifiers) {
        const imported = t.isImportSpecifier(specifier)
          ? t.isIdentifier(specifier.imported)
            ? specifier.imported.name
            : specifier.imported.value
          : 'default';
        body.push(
          t.variableDeclaration('const', [
            t.variableDeclarator(
              specifier.local,
              t.isImportNamespaceSpecifier(specifier)
                ? importCall(statement.source.value)
                : t.memberExpression(
                    importCall(statement.source.value),
                    t.stringLiteral(imported),
                    true
                  )
            ),
          ])
        );
      }
    } else if (t.isExportNamedDeclaration(statement)) {
      if (statement.declaration) {
        body.push(statement.declaration);
        exported.push(
          ...Object.keys(t.getBindingIdentifiers(statement.declaration))
        );
      }
      for (const specifier of statement.specifiers) {
        if (t.isExportSpecifier(specifier)) exported.push(specifier.local.name);
      }
    } else {
      body.push(statement);
    }
  }
  body.push(
    t.returnStatement(
      t.objectExpression(
        exported.map((name) =>
          t.objectProperty(t.identifier(name), t.identifier(name), false, true)
        )
      )
    )
  );
  const run = new Function('__import', generate(t.program(body)).code) as (
    load: (source: string) => Record<string, unknown>
  ) => Record<string, unknown>;
  return run((source) => {
    const module = modules[source];
    if (!module) throw new Error(`unexpected import of ${source}`);
    return module;
  });
}

function importCall(source: string): t.CallExpression {
  return t.callExpression(t.identifier('__import'), [t.stringLiteral(source)]);
}
