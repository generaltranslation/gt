import type { Config } from 'payload';

import { createTranslateEndpoint } from './translate';

export type GtPayloadConfig = {
  collections: Record<string, string[]>;
  targetLocales?: string[];
};

export const gtPayload =
  (pluginOptions: GtPayloadConfig) =>
  (config: Config): Config => {
    if (!config.localization) {
      throw new Error('gt-payload requires localization in the Payload config');
    }
    for (const [slug, fields] of Object.entries(pluginOptions.collections)) {
      const collection = (config.collections ?? []).find(
        (candidate) => candidate.slug === slug
      );
      if (!collection) {
        throw new Error(
          `gt-payload: collection "${slug}" is not in the Payload config`
        );
      }
      for (const fieldName of fields) {
        const fieldConfig = collection.fields.find(
          (candidate) => 'name' in candidate && candidate.name === fieldName
        );
        if (!fieldConfig) {
          throw new Error(
            `gt-payload: field "${slug}.${fieldName}" is not a top-level field in the collection config`
          );
        }
        if (!('localized' in fieldConfig) || fieldConfig.localized !== true) {
          throw new Error(
            `gt-payload: field "${slug}.${fieldName}" must set localized: true; ` +
              'translating a shared field would overwrite its value for every locale'
          );
        }
      }
      collection.endpoints = [
        ...(typeof collection.endpoints === 'object' && collection.endpoints
          ? collection.endpoints
          : []),
        createTranslateEndpoint({
          fields,
          slug,
          targetLocales: pluginOptions.targetLocales,
        }),
      ];
      collection.admin = {
        ...collection.admin,
        components: {
          ...collection.admin?.components,
          edit: {
            ...collection.admin?.components?.edit,
            beforeDocumentControls: [
              ...(collection.admin?.components?.edit?.beforeDocumentControls ??
                []),
              'gt-payload/client#TranslateButton',
            ],
          },
        },
      };
    }
    return config;
  };
