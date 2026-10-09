// Reads the React Router config and root module, and stops setup before any
// change for an app it cannot configure.
import path from 'node:path';
import * as t from '@babel/types';
import { createDiagnosticMessage } from 'generaltranslation/internal';
import { Libraries } from '../../../types/libraries.js';
import {
  getPackageJson,
  getPackageVersion,
  isPackageInstalled,
} from '../../../utils/packageJson.js';
import { permitsVersionBelow } from '../../../utils/reactPackageCompatibility.js';
import {
  getPropertyName,
  readSourceFile,
  type SourceFile,
} from '../shared/source.js';

export const DOCS_URL =
  'https://generaltranslation.com/docs/react/react-quickstart';

/** React Router's app directory, where the root module and loader live. */
export const SOURCE_DIRECTORY = 'app';

export const ROOT_MODULE = `${SOURCE_DIRECTORY}/root`;

export const LOADER_FILE = `${SOURCE_DIRECTORY}/loadTranslations.ts`;

/**
 * The configured root imports parseLocale, new in gt-react 11.0.4, and
 * Oxygen's worker build resolves gt-react's server entry from 11.1.3.
 */
const MINIMUM_GT_REACT = '11.1.3';

/** The extensions React Router resolves react-router.config with. */
const CONFIG_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.mts'];

function getRefusal(
  why: string,
  fix = 'With gt-react installed, rerun `npx gt@latest init --no-react-setup` to set up everything except the React code, and set that up manually'
): string {
  return createDiagnosticMessage({
    source: 'gt',
    severity: 'Error',
    whatHappened: 'GT cannot configure this React Router app automatically',
    why,
    reassurance: 'Nothing was changed',
    fix,
    docsUrl: DOCS_URL,
  });
}

const notFrameworkRefusal = getRefusal(
  'it has neither @react-router/dev nor a react-router.config',
  'If the app uses React Router as a library in a Vite app, rerun `npx gt@latest init --framework vite`'
);
const missingRootRefusal = getRefusal(
  'app/root.tsx was not found',
  'Run `npx gt@latest init` from the app directory'
);
const unreadableConfigRefusal = getRefusal(
  'setup cannot read the options react-router.config exports'
);
const spaModeRefusal = getRefusal(
  "react-router.config sets ssr: false, so the root loader cannot read each visitor's locale"
);
const prerenderRefusal = getRefusal(
  "react-router.config pre-renders pages, which cannot read each visitor's locale"
);
const appDirectoryRefusal = getRefusal(
  'react-router.config sets an appDirectory other than app'
);
const outdatedGtReactRefusal = getRefusal(
  `package.json allows gt-react versions older than ${MINIMUM_GT_REACT}, which the configured root needs`,
  `Upgrade gt-react to ${MINIMUM_GT_REACT} or later, then rerun \`npx gt@latest init\``
);
const rscRefusal = getRefusal(
  "it installs @vitejs/plugin-rsc, which React Router's experimental RSC Framework Mode uses"
);

/** Unwraps `satisfies Config` and `as const`. */
function unwrap(node: t.Node | null | undefined) {
  while (
    node?.type === 'TSSatisfiesExpression' ||
    node?.type === 'TSAsExpression'
  ) {
    node = node.expression;
  }
  return node;
}

/**
 * The object the config exports by default, directly or through a const that
 * nothing else refers to, so nothing can change it after its declaration.
 */
function getOptions(statements: t.Statement[]) {
  const options = unwrap(
    statements.find(
      (statement) => statement.type === 'ExportDefaultDeclaration'
    )?.declaration
  );
  if (options?.type !== 'Identifier') return options;
  const { name } = options;
  let references = 0;
  for (const statement of statements) {
    t.traverseFast(statement, (node) => {
      if (t.isIdentifier(node, { name })) references++;
    });
  }
  if (references !== 2) return undefined;
  const declarator = statements
    .flatMap((statement) =>
      statement.type === 'VariableDeclaration' && statement.kind === 'const'
        ? statement.declarations
        : []
    )
    .find((candidate) => t.isIdentifier(candidate.id, { name }));
  return unwrap(declarator?.init);
}

/**
 * Throws unless the config renders on each request from app/: each option it
 * sets must be one React Router treats like its default. Presets, such as
 * Hydrogen's, are trusted.
 */
function checkConfig({ statements }: SourceFile, appDirectory: string) {
  const options = statements && getOptions(statements);
  if (options?.type !== 'ObjectExpression') {
    throw new Error(unreadableConfigRefusal);
  }
  for (const property of options.properties) {
    const name = getPropertyName(property);
    if (name === undefined) throw new Error(unreadableConfigRefusal);
    const value =
      property.type === 'ObjectProperty' ? unwrap(property.value) : undefined;
    if (name === 'ssr') {
      if (!t.isBooleanLiteral(value)) throw new Error(unreadableConfigRefusal);
      if (!value.value) throw new Error(spaModeRefusal);
    }
    if (
      name === 'prerender' &&
      !t.isBooleanLiteral(value, { value: false }) &&
      !(t.isArrayExpression(value) && value.elements.length === 0)
    ) {
      throw new Error(prerenderRefusal);
    }
    // React Router resolves it from the project directory.
    if (
      name === 'appDirectory' &&
      !(
        t.isStringLiteral(value) &&
        path.resolve(appDirectory, value.value) ===
          path.resolve(appDirectory, SOURCE_DIRECTORY)
      )
    ) {
      throw new Error(appDirectoryRefusal);
    }
  }
}

/** Reads the root module, refusing an app setup cannot configure. */
export async function inspectReactRouter(appDirectory: string) {
  const config = await readSourceFile(appDirectory, 'react-router.config', {
    extensions: CONFIG_EXTENSIONS,
  });
  // Framework mode installs @react-router/dev, which a monorepo may install
  // at its root, so a config also counts.
  const packageJson = await getPackageJson(appDirectory);
  if (packageJson) {
    const installed = (name: string) =>
      isPackageInstalled(name, packageJson, false, true);
    if (!config && !installed('@react-router/dev')) {
      throw new Error(notFrameworkRefusal);
    }
    if (installed('@vitejs/plugin-rsc')) throw new Error(rscRefusal);
    // An undeclared gt-react is installed at its latest version.
    const gtReact = getPackageVersion(Libraries.GT_REACT, packageJson);
    if (gtReact && permitsVersionBelow(gtReact, MINIMUM_GT_REACT)) {
      throw new Error(outdatedGtReactRefusal);
    }
  }
  if (config) checkConfig(config, appDirectory);
  const root = await readSourceFile(appDirectory, ROOT_MODULE);
  if (!root) throw new Error(missingRootRefusal);
  return root;
}
