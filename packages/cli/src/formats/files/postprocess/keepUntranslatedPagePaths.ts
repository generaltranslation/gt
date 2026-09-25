import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import type { Settings, TransformOptions } from '../../../types/index.js';
import type { JSONValue } from '../../../types/data/json.js';
import { getRelative } from '../../../fs/findFilepath.js';
import { PAGE_EXTENSIONS } from '../../../utils/localizeStaticUrls.js';
import { getConfiguredLocaleProperties } from '../../utils.js';
import { getJSONPathMatches } from '../../json/jsonPath.js';
import {
  getJSONPointerValue,
  setJSONPointerValue,
} from '../../json/jsonPointer.js';
import { transformValue } from '../../json/mergeJson.js';
import {
  applyStructuralTransforms,
  unapplyStructuralTransforms,
} from '../../json/transformJson.js';
import { api } from '../../../utils/api.js';
import {
  findMatchingItemArray,
  findMatchingItemObject,
  generateSourceObjectPointers,
  validateJsonSchema,
} from '../../json/utils.js';
import { validateYamlSchema } from '../../yaml/utils.js';
import { createFileMapping } from '../fileMapping.js';

/**
 * With `skipUntranslatedPages`, undo `transform` rewrites that point a
 * localized JSON or YAML file (such as a docs navigation file) at a page that
 * was not translated. A value is restored to its source form when the source
 * value names an existing .md/.mdx page and the transformed value does not.
 * Values that are not page paths are left alone. Runs after all downloads, so
 * every translated page from this run is on disk.
 */
export function keepUntranslatedPagePaths(
  settings: Settings,
  includeFiles?: Set<string>
): void {
  const options = settings.options;
  const localizeOptions = options?.experimentalLocalizeStaticUrls;
  if (
    !options ||
    typeof localizeOptions !== 'object' ||
    localizeOptions.skipUntranslatedPages !== true ||
    !settings.files
  ) {
    return;
  }
  const { defaultLocale } = settings;
  const targetLocales = settings.locales.filter((l) => l !== defaultLocale);
  const isIncluded = (filePath: string) =>
    !includeFiles ||
    includeFiles.has(filePath) ||
    includeFiles.has(getRelative(filePath));

  // Composite JSON: every locale's entry lives in the source file itself.
  for (const filePath of settings.files.resolvedPaths.json ?? []) {
    const schema = validateJsonSchema(options, filePath);
    if (!schema?.composite || !isIncluded(filePath)) continue;
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8')) as JSONValue;
    const dir = path.dirname(filePath);
    // Match entries the way mergeJson wrote them: same structural transforms
    // and the same locale keys.
    if (schema.structuralTransform) {
      applyStructuralTransforms(
        json,
        schema.structuralTransform,
        schema.composite
      );
    }
    const localeKey = (locale: string) =>
      options.experimentalCanonicalLocaleKeys
        ? api.resolveCanonicalLocale(locale)
        : locale;
    let changed = false;
    const sourceObjects = generateSourceObjectPointers(schema.composite, json);
    for (const [
      pointer,
      { sourceObjectValue, sourceObjectOptions },
    ] of Object.entries(sourceObjects)) {
      if (!sourceObjectOptions.transform) continue;
      // Every entry for a locale, in order. mergeJson builds one target entry
      // per default-locale entry in the same order, so they pair by position.
      const entriesFor = (locale: string): JSONValue[] => {
        if (Array.isArray(sourceObjectValue)) {
          return Object.values(
            findMatchingItemArray(
              localeKey(locale),
              sourceObjectOptions,
              pointer,
              sourceObjectValue
            )
          )
            .sort((a, b) => a.index - b.index)
            .map(({ sourceItem }) => sourceItem);
        }
        const { sourceItem } = findMatchingItemObject(
          localeKey(locale),
          pointer,
          sourceObjectOptions,
          sourceObjectValue as Record<string, JSONValue>
        );
        return sourceItem === undefined ? [] : [sourceItem];
      };
      const sources = entriesFor(defaultLocale);
      for (const locale of targetLocales) {
        entriesFor(locale).forEach((target, i) => {
          if (sources[i] === undefined) return;
          changed =
            restorePagePaths(
              sources[i],
              target,
              sourceObjectOptions.transform!,
              locale,
              defaultLocale,
              dir,
              dir
            ) || changed;
        });
      }
    }
    if (changed) {
      if (schema.structuralTransform) {
        unapplyStructuralTransforms(
          json,
          schema.structuralTransform,
          schema.composite
        );
      }
      fs.writeFileSync(filePath, JSON.stringify(json, null, 2));
    }
  }

  // YAML: each locale has its own output file, mapped from the source file.
  const yamlSources = settings.files.resolvedPaths.yaml ?? [];
  if (!yamlSources.length) return;
  const fileMapping = createFileMapping(
    settings.files.resolvedPaths,
    settings.files.placeholderPaths,
    settings.files.transformPaths,
    settings.files.transformFormats,
    settings.locales,
    defaultLocale
  );
  for (const filePath of yamlSources) {
    const schema = validateYamlSchema(options, filePath);
    if (!schema?.transform) continue;
    const source = YAML.parse(fs.readFileSync(filePath, 'utf8')) as JSONValue;
    for (const locale of targetLocales) {
      const outputPath = fileMapping[locale]?.[getRelative(filePath)];
      if (!outputPath || !fs.existsSync(outputPath) || !isIncluded(outputPath))
        continue;
      const target = YAML.parse(
        fs.readFileSync(outputPath, 'utf8')
      ) as JSONValue;
      const restored = restorePagePaths(
        source,
        target,
        schema.transform,
        locale,
        defaultLocale,
        path.dirname(filePath),
        path.dirname(outputPath)
      );
      if (restored) fs.writeFileSync(outputPath, YAML.stringify(target));
    }
  }
}

/**
 * For each value a transform produced in `target` from the value at the same
 * position in `source`, restore the source page path when the transformed
 * page does not exist. Returns whether anything changed.
 */
function restorePagePaths(
  source: JSONValue,
  target: JSONValue,
  transform: TransformOptions,
  locale: string,
  defaultLocale: string,
  sourceDir: string,
  targetDir: string
): boolean {
  const targetLocaleProperties = getConfiguredLocaleProperties(locale);
  const defaultLocaleProperties = getConfiguredLocaleProperties(defaultLocale);
  let changed = false;
  for (const [transformPath, transformOption] of Object.entries(transform)) {
    for (const match of getJSONPathMatches(source, transformPath) ?? []) {
      if (typeof match.value !== 'string') continue;
      const transformed = transformValue(
        match.value,
        transformOption,
        targetLocaleProperties,
        defaultLocaleProperties
      );
      if (
        transformed === match.value ||
        getJSONPointerValue(target, match.pointer) !== transformed ||
        pageExists(transformed, targetDir) ||
        !pageExists(match.value, sourceDir)
      ) {
        continue;
      }
      const restored =
        sourceDir === targetDir
          ? match.value
          : path
              .relative(targetDir, path.join(sourceDir, match.value))
              .split(path.sep)
              .join('/');
      setJSONPointerValue(target, match.pointer, restored);
      changed = true;
    }
  }
  return changed;
}

/** Whether a path value names an .md/.mdx page, with or without extension. */
function pageExists(value: string, dir: string): boolean {
  const filePath = path.join(dir, value);
  if (PAGE_EXTENSIONS.includes(path.extname(filePath))) {
    return fs.existsSync(filePath);
  }
  return PAGE_EXTENSIONS.some((ext) => fs.existsSync(`${filePath}${ext}`));
}
