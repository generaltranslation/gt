'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.createInlineUpdates =
  exports.createDictionaryUpdates =
  exports.scanForContent =
    void 0;
var scanForContent_1 = require('./scanForContent');
Object.defineProperty(exports, 'scanForContent', {
  enumerable: true,
  get: function () {
    return __importDefault(scanForContent_1).default;
  },
});
var createDictionaryUpdates_1 = require('./createDictionaryUpdates');
Object.defineProperty(exports, 'createDictionaryUpdates', {
  enumerable: true,
  get: function () {
    return __importDefault(createDictionaryUpdates_1).default;
  },
});
var createInlineUpdates_1 = require('./createInlineUpdates');
Object.defineProperty(exports, 'createInlineUpdates', {
  enumerable: true,
  get: function () {
    return __importDefault(createInlineUpdates_1).default;
  },
});
