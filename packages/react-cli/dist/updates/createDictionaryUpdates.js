'use strict';
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator['throw'](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.default = createDictionaryUpdates;
const react_1 = __importDefault(require('react'));
const fs_1 = __importDefault(require('fs'));
const path_1 = __importDefault(require('path'));
const os_1 = __importDefault(require('os'));
const esbuild_1 = require('esbuild');
const internal_1 = require('gt-react/internal');
const generaltranslation_1 = require('generaltranslation');
const loadJSON_1 = __importDefault(require('../fs/loadJSON'));
const id_1 = require('generaltranslation/id');
function createDictionaryUpdates(options, esbuildConfig) {
  return __awaiter(this, void 0, void 0, function* () {
    let dictionary;
    // ---- HANDLE JSON STRING DICTIONARY ----- //
    if (options.dictionary.endsWith('.json')) {
      dictionary = (0, internal_1.flattenDictionary)(
        (0, loadJSON_1.default)(options.dictionary) || {}
      );
    }
    // ----- HANDLE REACT DICTIONARY ---- //
    else {
      const result = yield (0, esbuild_1.build)(
        Object.assign(Object.assign({}, esbuildConfig), {
          entryPoints: [options.dictionary],
          write: false,
        })
      );
      const bundledCode = result.outputFiles[0].text;
      const tempFilePath = path_1.default.join(
        os_1.default.tmpdir(),
        'bundled-dictionary.js'
      );
      fs_1.default.writeFileSync(tempFilePath, bundledCode);
      globalThis.React = react_1.default;
      // Load the module using require
      let dictionaryModule;
      try {
        dictionaryModule = require(tempFilePath);
      } catch (error) {
        console.error(`Failed to load the bundled dictionary code:`, error);
        process.exit(1);
      } finally {
        // Clean up the temporary file
        fs_1.default.unlinkSync(tempFilePath);
      }
      dictionary = (0, internal_1.flattenDictionary)(
        dictionaryModule.default ||
          dictionaryModule.dictionary ||
          dictionaryModule
      );
    }
    if (!Object.keys(dictionary).length)
      throw new Error(
        `Dictionary filepath provided: "${options.dictionary}", but no entries found.`
      );
    // ----- CREATE PARTIAL UPDATES ----- //
    let updates = [];
    for (const id of Object.keys(dictionary)) {
      let {
        entry,
        metadata: props, // context, etc.
      } = (0, internal_1.extractEntryMetadata)(dictionary[id]);
      const taggedEntry = (0, internal_1.addGTIdentifier)(entry);
      const entryAsObjects = (0, internal_1.writeChildrenAsObjects)(
        taggedEntry
      );
      const context =
        props === null || props === void 0 ? void 0 : props.context;
      if (typeof entry === 'string') {
        const metadata = Object.assign(
          Object.assign({ id }, context && { context }),
          {
            hash: (0, id_1.hashJsxChildren)(
              Object.assign(
                {
                  source: (0, generaltranslation_1.splitStringToContent)(entry),
                },
                context && { context }
              )
            ),
          }
        );
        updates.push({
          type: 'content',
          source: (0, generaltranslation_1.splitStringToContent)(entry),
          metadata,
        });
      } else {
        const metadata = Object.assign(
          Object.assign({ id }, context && { context }),
          {
            hash: (0, id_1.hashJsxChildren)(
              Object.assign({ source: entryAsObjects }, context && { context })
            ),
          }
        );
        updates.push({
          type: 'jsx',
          source: entryAsObjects,
          metadata,
        });
      }
    }
    return updates;
  });
}
