'use strict';
var __assign =
  (this && this.__assign) ||
  function () {
    __assign =
      Object.assign ||
      function (t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
          s = arguments[i];
          for (var p in s)
            if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
      };
    return __assign.apply(this, arguments);
  };
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
var __generator =
  (this && this.__generator) ||
  function (thisArg, body) {
    var _ = {
        label: 0,
        sent: function () {
          if (t[0] & 1) throw t[1];
          return t[1];
        },
        trys: [],
        ops: [],
      },
      f,
      y,
      t,
      g = Object.create(
        (typeof Iterator === 'function' ? Iterator : Object).prototype
      );
    return (
      (g.next = verb(0)),
      (g['throw'] = verb(1)),
      (g['return'] = verb(2)),
      typeof Symbol === 'function' &&
        (g[Symbol.iterator] = function () {
          return this;
        }),
      g
    );
    function verb(n) {
      return function (v) {
        return step([n, v]);
      };
    }
    function step(op) {
      if (f) throw new TypeError('Generator is already executing.');
      while ((g && ((g = 0), op[0] && (_ = 0)), _))
        try {
          if (
            ((f = 1),
            y &&
              (t =
                op[0] & 2
                  ? y['return']
                  : op[0]
                    ? y['throw'] || ((t = y['return']) && t.call(y), 0)
                    : y.next) &&
              !(t = t.call(y, op[1])).done)
          )
            return t;
          if (((y = 0), t)) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (
                !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
                (op[0] === 6 || op[0] === 2)
              ) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
      if (op[0] & 5) throw op[1];
      return { value: op[0] ? op[1] : void 0, done: true };
    }
  };
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.default = tx;
var generaltranslation_1 = require('generaltranslation');
var getI18NConfig_1 = __importDefault(require('../../config/getI18NConfig'));
var getLocale_1 = __importDefault(require('../../request/getLocale'));
var getMetadata_1 = __importDefault(require('../../request/getMetadata'));
var createErrors_1 = require('../../errors/createErrors');
/**
 * Translates the provided content string based on the specified locale and options.
 * If no translation is required, it renders the content as is. Otherwise, it fetches the
 * required translations or falls back to on-demand translation if enabled.
 *
 * By default, General Translation saves the translation in a remote cache if an `id` option is passed.
 *
 * @async
 * @function tx (translate)
 *
 * @param {string} content - The content string that needs to be translated.
 * @param {Object} [options] - Translation options.
 * @param {string} [options.id] - A unique identifier for the content, used for caching and fetching translations.
 * @param {string} [options.locale] - The target locale for translation. Defaults to the current locale if not provided.
 * @param {string} [options.context] - Additional context for the translation process, which may influence the translation's outcome.
 * @param {Object} [options.variables] - An optional map of variables to be injected into the translated content.
 * @param {Object} [options.variableOptions] - Options for formatting numbers and dates using `Intl.NumberFormat` or `Intl.DateTimeFormat`.
 *
 * @returns {Promise<string>} - A promise that resolves to the translated content string, or the original content if no translation is needed.
 *
 * @throws {Error} - Throws an error if the translation process fails or if there are issues with fetching necessary data.
 *
 * @example
 * // Basic usage with default locale detection
 * const translation = await tx("Hello, world!");
 *
 * @example
 * // Providing specific translation options
 * const translation = await tx("Hello, world!", { locale: 'es', context: 'Translate informally' });
 *
 * @example
 * // Using variables in the content string
 * const translation = await tx("The price is {price}", { locale: 'es-MX', variables: { price: 29.99 } });
 */
function tx(content_1) {
  return __awaiter(this, arguments, void 0, function (content, options) {
    var I18NConfig,
      locale,
      _a,
      defaultLocale,
      translationRequired,
      contentArray,
      renderContent,
      hash,
      key,
      translations,
      translationResult,
      error_1,
      translationPromise,
      _b,
      _c,
      _d,
      target,
      error_2;
    var _e;
    if (options === void 0) {
      options = {};
    }
    return __generator(this, function (_f) {
      switch (_f.label) {
        case 0:
          // ----- SET UP ----- //
          // No content to translate
          if (!content) {
            // Reject empty strings
            if (content === '') {
              console.warn(
                'gt-next warn: Empty string found in tx() '.concat(
                  options.id && 'with id: '.concat(options.id)
                )
              );
              ('');
            }
            return [2 /*return*/, ''];
          }
          I18NConfig = (0, getI18NConfig_1.default)();
          _a = options.locale;
          if (_a) return [3 /*break*/, 2];
          return [4 /*yield*/, (0, getLocale_1.default)()];
        case 1:
          _a = _f.sent();
          _f.label = 2;
        case 2:
          locale = _a;
          defaultLocale = I18NConfig.getDefaultLocale();
          translationRequired = I18NConfig.requiresTranslation(locale);
          contentArray = (0, generaltranslation_1.splitStringToContent)(
            content
          );
          renderContent = function (content, locales) {
            return (0, generaltranslation_1.renderContentToString)(
              content,
              locales,
              options.variables,
              options.variablesOptions
            );
          };
          // ----- RENDER LOGIC ----- //
          // translation required
          if (!translationRequired)
            return [2 /*return*/, renderContent(contentArray, [defaultLocale])];
          hash = I18NConfig.hashContent(contentArray, options.context);
          key =
            process.env.NODE_ENV === 'development' ? hash : options.id || hash;
          if (!options.id) return [3 /*break*/, 6];
          translations = void 0;
          _f.label = 3;
        case 3:
          _f.trys.push([3, 5, , 6]);
          return [4 /*yield*/, I18NConfig.getCachedTranslations(locale)];
        case 4:
          translations = _f.sent();
          if (
            translations === null || translations === void 0
              ? void 0
              : translations[key]
          ) {
            translationResult = translations[key];
            if (translationResult.state !== 'success') {
              // fallback error
              return [
                2 /*return*/,
                renderContent(content, [locale, defaultLocale]),
              ];
            }
            return [
              2 /*return*/,
              renderContent(translationResult.target, [locale, defaultLocale]),
            ];
          }
          return [3 /*break*/, 6];
        case 5:
          error_1 = _f.sent();
          console.error('Error fetching translations from cache:', error_1);
          // fallback error
          return [
            2 /*return*/,
            renderContent(content, [locale, defaultLocale]),
          ];
        case 6:
          _c = (_b = I18NConfig).translateContent;
          _e = {
            source: contentArray,
            targetLocale: locale,
          };
          _d = [__assign({}, options)];
          return [4 /*yield*/, (0, getMetadata_1.default)()];
        case 7:
          translationPromise = _c.apply(_b, [
            ((_e.options = __assign.apply(void 0, [
              __assign.apply(void 0, _d.concat([_f.sent()])),
              { hash: hash },
            ])),
            _e),
          ]);
          _f.label = 8;
        case 8:
          _f.trys.push([8, 10, , 11]);
          return [4 /*yield*/, translationPromise];
        case 9:
          target = _f.sent();
          return [2 /*return*/, renderContent(target, [locale, defaultLocale])];
        case 10:
          error_2 = _f.sent();
          console.error(
            (0, createErrors_1.createStringTranslationError)(
              content,
              options.id
            ),
            error_2
          );
          return [2 /*return*/, renderContent(contentArray, [defaultLocale])];
        case 11:
          return [2 /*return*/];
      }
    });
  });
}
//# sourceMappingURL=tx.js.map
