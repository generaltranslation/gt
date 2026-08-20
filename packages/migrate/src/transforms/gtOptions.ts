import fs from 'node:fs';
import path from 'node:path';
import * as t from '@babel/types';
import type { MigrationContext } from '../pipeline/types.js';

/**
 * True when a GT project is configured for this app: a projectId in the
 * resolved gt.config.json, or the env vars gt-next reads at build time
 * (NEXT_PUBLIC_GT_PROJECT_ID / GT_PROJECT_ID). Dictionary-compat migrations
 * typically have none, and gt-next's I18nCache then warns on every build/dev
 * run that a remote store needs a projectId; its own suggested remedy is
 * `cacheUrl: null`, which the config transforms emit in exactly that case.
 */
export function hasGtProjectConfigured(ctx: MigrationContext): boolean {
  if (process.env.NEXT_PUBLIC_GT_PROJECT_ID || process.env.GT_PROJECT_ID) {
    return true;
  }
  const configFile = ctx.configFile ?? path.join(ctx.cwd, 'gt.config.json');
  try {
    const parsed = JSON.parse(fs.readFileSync(configFile, 'utf8')) as {
      projectId?: unknown;
    };
    return typeof parsed.projectId === 'string' && parsed.projectId.length > 0;
  } catch {
    return false;
  }
}

/**
 * The withGTConfig options object every config transform emits: `dictionary`
 * always, plus `cacheUrl: null` when no GT project is configured, so a
 * dictionary-only migration does not warn about a missing projectId on every
 * run. A project configured later just deletes the property.
 */
export function buildGtOptionsExpression(
  ctx: MigrationContext,
  dictionaryPath: string
): t.ObjectExpression {
  const properties = [
    t.objectProperty(
      t.identifier('dictionary'),
      t.stringLiteral(dictionaryPath)
    ),
  ];
  if (!hasGtProjectConfigured(ctx)) {
    properties.push(
      t.objectProperty(t.identifier('cacheUrl'), t.nullLiteral())
    );
  }
  return t.objectExpression(properties);
}
