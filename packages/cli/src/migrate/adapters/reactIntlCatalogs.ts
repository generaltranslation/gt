import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';
import { matchFiles } from '../../fs/matchFiles.js';
import type { FileEdit, MessageCatalogs, RoutingInfo } from '../types.js';

const traverse = traverseModule.default || traverseModule;

// FormatJS ships catalogs under a few conventional dirs; check the react-intl
// ones ahead of the shared next-intl defaults.
const CATALOG_DIRS = [
  'messages',
  'src/messages',
  'lang',
  'src/lang',
  'compiled-lang',
  'src/compiled-lang',
  'locales',
  'src/locales',
];

/**
 * Locates react-intl's per-locale catalogs and loads each. Accepts both the
 * compiled/flat shape (`{ id: 'ICU' }`) and the extracted/authoring shape
 * (`{ id: { defaultMessage, description } }`, read via `.defaultMessage`).
 * AST-compiled catalogs (`compile --ast`, arrays of MessageFormatElement) throw
 * a clear error — gt wants ICU source strings.
 *
 * The id-problem case b2 (no default-locale catalog, English served inline from
 * `defaultMessage`) is handled here: the missing default catalog is synthesized
 * from literal `defaultMessage`s harvested across the source, and queued in
 * `filesToEmit` so it is written to disk through the normal edit pipeline (never
 * mutating an existing file).
 */
export async function discoverReactIntlCatalogs(
  cwd: string,
  routing: RoutingInfo
): Promise<MessageCatalogs | null> {
  const dir = CATALOG_DIRS.map((candidate) => path.join(cwd, candidate)).find(
    (candidate) =>
      fs.existsSync(candidate) &&
      fs.statSync(candidate).isDirectory() &&
      fs.readdirSync(candidate).some((file) => file.endsWith('.json'))
  );
  if (!dir) return null;

  const stems = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => path.basename(file, '.json'));
  const locales = routing.locales
    ? stems.filter((stem) => routing.locales!.includes(stem))
    : stems;

  const byLocale: Record<string, Record<string, unknown>> = {};
  for (const locale of locales) {
    const file = path.join(dir, `${locale}.json`);
    byLocale[locale] = normalizeCatalog(file);
  }

  const defaultLocale = determineDefaultLocale(cwd, routing, locales);
  if (!defaultLocale) return null;

  const filesToEmit: FileEdit[] = [];
  const finalLocales = [...locales];

  if (!(defaultLocale in byLocale)) {
    // Case b2: the source (default-locale) catalog is absent. Seed it from
    // literal defaultMessages harvested across the project so gt's dictionary
    // path has a source entry per id (else t() throws at runtime).
    const harvested = harvestDefaultMessages(cwd);
    if (Object.keys(harvested).length === 0) {
      throw new Error(
        `No '${defaultLocale}' catalog was found in ${path.relative(cwd, dir) || '.'}/ and no literal ` +
          'defaultMessage could be harvested to synthesize one. gt-next needs a ' +
          'default-locale source entry per id (its dictionary throws on unknown ' +
          `keys). Add ${defaultLocale}.json, or give each formatMessage/` +
          '<FormattedMessage> a literal defaultMessage, then re-run gt migrate.'
      );
    }
    byLocale[defaultLocale] = harvested;
    finalLocales.push(defaultLocale);
    filesToEmit.push({
      path: path.join(dir, `${defaultLocale}.json`),
      kind: 'write',
      content: JSON.stringify(harvested, null, 2) + '\n',
    });
  }

  return {
    defaultLocale,
    locales: finalLocales,
    byLocale,
    dir,
    ...(filesToEmit.length > 0 ? { filesToEmit } : {}),
  };
}

/** Reads a catalog file and flattens it to `{ id: ICU-string }`. */
function normalizeCatalog(file: string): Record<string, unknown> {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(
      `Could not parse message catalog ${file}: ${String(error)}. ` +
        'Fix the JSON (no comments, trailing commas, or BOM) and re-run.'
    );
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`Message catalog ${file} is not a JSON object of messages.`);
  }
  const result: Record<string, unknown> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string') {
      result[id] = value;
    } else if (Array.isArray(value)) {
      throw new Error(
        `Message catalog ${file} looks AST-compiled (\`formatjs compile --ast\`): ` +
          'gt-next needs ICU source strings. Re-run `formatjs compile` without ' +
          '`--ast`, then re-run gt migrate.'
      );
    } else if (
      value !== null &&
      typeof value === 'object' &&
      typeof (value as Record<string, unknown>).defaultMessage === 'string'
    ) {
      // Extracted/authoring shape: read .defaultMessage, drop description.
      result[id] = (value as Record<string, unknown>).defaultMessage;
    } else {
      throw new Error(
        `Message catalog ${file} has an unrecognized entry for '${id}'. ` +
          'Expected an ICU string or `{ defaultMessage }`.'
      );
    }
  }
  return result;
}

/**
 * The default (source) locale: an explicit routing default, else a
 * `defaultLocale="…"` seen on an IntlProvider/createIntl in the source, else
 * 'en' when present, else the sole locale.
 */
function determineDefaultLocale(
  cwd: string,
  routing: RoutingInfo,
  locales: string[]
): string | null {
  if (routing.defaultLocale) return routing.defaultLocale;
  const declared = scanDeclaredDefaultLocale(cwd);
  if (declared) return declared;
  if (locales.includes('en')) return 'en';
  if (locales.length === 1) return locales[0];
  // Nothing to anchor on and multiple locales present; assume 'en' so the
  // harvest can seed it (real react-intl apps source from English).
  return 'en';
}

function scanDeclaredDefaultLocale(cwd: string): string | null {
  const pattern = /defaultLocale\s*[:=]\s*\{?\s*['"]([a-zA-Z][\w-]*)['"]/;
  for (const file of sourceFiles(cwd)) {
    let content: string;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (!content.includes('defaultLocale')) continue;
    const match = content.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Harvests `{ id: defaultMessage }` from every literal descriptor across the
 * source: `<FormattedMessage id defaultMessage />`, `formatMessage({ id,
 * defaultMessage })`, and `defineMessage(s)({ … })`. First writer wins.
 */
function harvestDefaultMessages(cwd: string): Record<string, string> {
  const harvested: Record<string, string> = {};
  const record = (id: string | null, message: string | null) => {
    if (id !== null && message !== null && !(id in harvested)) {
      harvested[id] = message;
    }
  };

  for (const file of sourceFiles(cwd)) {
    let code: string;
    try {
      code = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (!code.includes('defaultMessage')) continue;
    let ast: t.File;
    try {
      ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });
    } catch {
      continue;
    }
    traverse(ast, {
      JSXOpeningElement(path) {
        if (!t.isJSXIdentifier(path.node.name, { name: 'FormattedMessage' })) {
          return;
        }
        record(
          jsxStringAttr(path.node, 'id'),
          jsxStringAttr(path.node, 'defaultMessage')
        );
      },
      CallExpression(path) {
        const callee = path.node.callee;
        const isFormatMessage =
          t.isMemberExpression(callee) &&
          !callee.computed &&
          t.isIdentifier(callee.property, { name: 'formatMessage' });
        const isDefine =
          t.isIdentifier(callee, { name: 'defineMessages' }) ||
          t.isIdentifier(callee, { name: 'defineMessage' });
        if (isFormatMessage) {
          recordFromDescriptor(path.node.arguments[0], record);
        } else if (isDefine) {
          const arg = path.node.arguments[0];
          if (t.isObjectExpression(arg)) {
            for (const property of arg.properties) {
              if (
                t.isObjectProperty(property) &&
                t.isObjectExpression(property.value)
              ) {
                recordFromDescriptor(property.value, record);
              }
            }
          }
        }
      },
    });
  }
  return harvested;
}

function recordFromDescriptor(
  node: t.Node | undefined,
  record: (id: string | null, message: string | null) => void
): void {
  if (!node || !t.isObjectExpression(node)) return;
  record(objectStringProp(node, 'id'), objectStringProp(node, 'defaultMessage'));
}

function objectStringProp(
  object: t.ObjectExpression,
  name: string
): string | null {
  for (const property of object.properties) {
    if (
      t.isObjectProperty(property) &&
      !property.computed &&
      t.isIdentifier(property.key, { name }) &&
      t.isStringLiteral(property.value)
    ) {
      return property.value.value;
    }
  }
  return null;
}

function jsxStringAttr(
  opening: t.JSXOpeningElement,
  name: string
): string | null {
  for (const attr of opening.attributes) {
    if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name, { name })) {
      continue;
    }
    const value = attr.value;
    if (t.isStringLiteral(value)) return value.value;
    if (
      t.isJSXExpressionContainer(value) &&
      t.isStringLiteral(value.expression)
    ) {
      return value.expression.value;
    }
  }
  return null;
}

function sourceFiles(cwd: string): string[] {
  return matchFiles(cwd, [
    '**/*.{js,jsx,ts,tsx}',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/dist/**',
    '!**/build/**',
    '!**/out/**',
    '!**/coverage/**',
  ]);
}
