#!/usr/bin/env node

import { program } from "commander";
import dotenv from "dotenv";
import loadJSON from "./fs/loadJSON";
import findFilepath, { findFilepaths } from "./fs/findFilepath";
import { parseNextConfig } from "./fs/parseNextConfig";
import createESBuildConfig from "./config/createESBuildConfig";
import createDictionaryUpdates from "./updates/createDictionaryUpdates";
import createInlineUpdates from "./updates/createInlineUpdates";
import { isValidLocale } from "generaltranslation";
import updateConfigFile from "./fs/updateConfigFile";
import {
  displayAsciiTitle,
  displayInitializingText,
  displayProjectId,
} from "./console/console";
import { warnApiKeyInConfig } from "./console/warnings";
import { noTranslationsError } from "./console/errors";
import { defaultBaseUrl } from "generaltranslation/internal";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

export type Updates = (
  | {
      type: "jsx";
      source: any;
      metadata: Record<string, any>;
    }
  | {
      type: "content";
      source: any;
      metadata: Record<string, any>;
    }
)[];

export type Options = {
  options: string;
  apiKey?: string;
  projectId?: string;
  jsconfig?: string;
  dictionary?: string;
  src?: string[];
  defaultLocale?: string;
  locales?: string[];
  baseUrl: string;
  inline: boolean;
  replace: boolean;
  retranslate: boolean;
};

program
  .name("translate")
  .description(
    "Scans the project for a dictionary and/or <T> tags, and updates the General Translation remote dictionary with the latest content."
  )
  .option(
    "--options <path>",
    "Filepath to options JSON file, by default gt.config.json",
    "./gt.config.json"
  )
  .option(
    "--apiKey <key>",
    "API key for General Translation cloud service",
    process.env.GT_API_KEY
  )
  .option(
    "--projectId <id>",
    "Project ID for the translation service",
    process.env.GT_PROJECT_ID
  )
  .option(
    "--tsconfig, --jsconfig <path>",
    "Path to jsconfig or tsconfig file",
    findFilepath(["./tsconfig.json", "./jsconfig.json"])
  )
  .option(
    "--dictionary <path>",
    "Path to dictionary file",
    findFilepath([
      "./dictionary.js",
      "./src/dictionary.js",
      "./dictionary.json",
      "./src/dictionary.json",
      "./dictionary.jsx",
      "./src/dictionary.jsx",
      "./dictionary.ts",
      "./src/dictionary.ts",
      "./dictionary.tsx",
      "./src/dictionary.tsx",
    ])
  )
  .option(
    "--src <path>",
    "Filepath to directory containing the app's source code, by default ./src || ./app || ./pages || ./components",
    findFilepaths(["./src", "./app", "./pages", "./components"])
  )
  .option(
    "--defaultLanguage, --defaultLocale <locale>",
    "Default locale (e.g., en)"
  )
  .option(
    "--languages, --locales <locales...>",
    "Space-separated list of locales (e.g., en fr es)",
    []
  )
  .option(
    "--replace",
    "Replace existing translations in the remote dictionary",
    false
  )
  .option(
    "--inline",
    "Include inline <T> tags in addition to dictionary file",
    true
  )
  .option("--retranslate", "Forces a new translation for all content.", false)
  .action(async (options: Options) => {
    displayAsciiTitle();
    displayInitializingText();

    // ------ SETUP ----- //

    // Consolidate config options
    // options given in command || --options filepath || ./gt.config.json || parsing next.config.js
    // it's alright for any of the options to be undefined at this point

    // --options filepath || gt.config.json
    const gtConfig = loadJSON(options.options) || {};

    options = { ...gtConfig, ...options };
    if (!options.baseUrl) options.baseUrl = defaultBaseUrl;

    // Error if no API key at this point
    if (!options.apiKey)
      throw new Error(
        "No General Translation API key found. Use the --apiKey flag to provide one."
      );
    // Warn if apiKey is present in gt.config.json
    if (gtConfig.apiKey) {
      warnApiKeyInConfig(options.options);
    }

    // Error if no API key at this point
    if (!options.projectId)
      throw new Error(
        "No General Translation Project ID found. Use the --projectId flag to provide one."
      );

    displayProjectId(options.projectId);

    // Check locales
    if (options.defaultLocale && !isValidLocale(options.defaultLocale))
      throw new Error(
        `defaultLocale: ${options.defaultLocale} is not a valid locale!`
      );
    if (options.locales) {
      for (const locale of options.locales) {
        if (!isValidLocale(locale)) {
          throw new Error(
            `locales: "${options?.locales?.join()}", ${locale} is not a valid locale!`
          );
        }
      }
    }

    // // manually parsing next.config.js (or .mjs, .cjs, .ts etc.)
    // // not foolproof but can't hurt
    // const nextConfigFilepath = findFilepath([
    //   "./next.config.mjs",
    //   "./next.config.js",
    //   "./next.config.ts",
    //   "./next.config.cjs",
    // ]);
    // if (nextConfigFilepath)
    //   options = { ...parseNextConfig(nextConfigFilepath), ...options };

    // if there's no existing config file, creates one
    // does not include the API key to avoid exposing it
    const { apiKey, ...rest } = options;
    if (options.options) updateConfigFile(rest.options, rest);

    // ---- CREATING UPDATES ---- //

    let updates: Updates = [];

    // Parse dictionary with esbuildConfig
    if (options.dictionary) {
      let esbuildConfig;
      if (options.jsconfig) {
        const jsconfig = loadJSON(options.jsconfig);
        if (!jsconfig)
          throw new Error(
            `Failed to resolve jsconfig.json or tsconfig.json at provided filepath: "${options.jsconfig}"`
          );
        esbuildConfig = createESBuildConfig(jsconfig);
      } else {
        esbuildConfig = createESBuildConfig({});
      }
      updates = [
        ...updates,
        ...(await createDictionaryUpdates(options as any, esbuildConfig)),
      ];
    }

    // Scan through project for <T> tags
    if (options.inline) {
      updates = [...updates, ...(await createInlineUpdates(options))];
    }

    // Metadata addition and validation
    const idHashMap = new Map<string, string>();
    updates = updates.map((update) => {
      const existingHash = idHashMap.get(update.metadata.id);
      if (existingHash) {
        if (existingHash !== update.metadata.hash)
          throw new Error(
            `Hashes don't match on two translations with the same id: ${update.metadata.id}. Check your <T id="${update.metadata.id}"> tags and make sure you're not accidentally duplicating IDs.`
          );
      } else {
        idHashMap.set(update.metadata.id, update.metadata.hash);
      }
      return update;
    });

    // Send updates to General Translation API
    if (updates.length) {
      const { projectId, defaultLocale } = options;
      const globalMetadata = {
        ...(projectId && { projectId }),
        ...(defaultLocale && { sourceLocale: defaultLocale }),
      };

      const body = {
        updates,
        locales: options.locales,
        metadata: globalMetadata,
      };

      const response = await fetch(
        `${options.baseUrl}/v1/project/translations/update`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey && { "x-gt-api-key": apiKey }),
          },
          body: JSON.stringify(body),
        }
      );

      console.log();

      if (!response.ok) {
        throw new Error(response.status + ". " + (await response.text()));
      }
      const result = await response.text();
      console.log(result);
    } else {
      throw new Error(noTranslationsError);
    }
  });

program.parse();
