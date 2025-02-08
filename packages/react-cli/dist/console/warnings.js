'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.warnHasUnwrappedExpression =
  exports.warnNoId =
  exports.warnVariableProp =
  exports.warnApiKeyInConfig =
    void 0;
const chalk_1 = __importDefault(require('chalk'));
const warnApiKeyInConfig = (optionsFilepath) => {
  console.warn(
    chalk_1.default.red('ERROR: ') +
      `Found ${chalk_1.default.cyan('apiKey')} in "${chalk_1.default.green(optionsFilepath)}". ` +
      chalk_1.default.white(
        'Your API key is exposed! Please remove it from the file and include it as an environment variable.'
      )
  );
};
exports.warnApiKeyInConfig = warnApiKeyInConfig;
const warnVariableProp = (file, attrName, value) => {
  return (
    `Found ${chalk_1.default.green('<T>')} component in ${chalk_1.default.cyan(file)} with variable ${attrName}: "${chalk_1.default.white(value)}". ` +
    `Change "${attrName}" to ensure this content is translated.\n`
  );
};
exports.warnVariableProp = warnVariableProp;
const warnNoId = (file) => {
  return (
    `Found ${chalk_1.default.green('<T>')} component in ${chalk_1.default.cyan(file)} with no id. ` +
    chalk_1.default.white('Add an id to ensure the content is translated.\n')
  );
};
exports.warnNoId = warnNoId;
const warnHasUnwrappedExpression = (file, id, unwrappedExpressions) => {
  return (
    `${chalk_1.default.green('<T>')} with id "${id}" in ${chalk_1.default.cyan(file)} has children: ${unwrappedExpressions.join(', ')} that could change at runtime. ` +
    chalk_1.default.white('Use a variable component like ') +
    chalk_1.default.green('<Var>') +
    chalk_1.default.white(' (') +
    chalk_1.default.blue('https://generaltranslation.com/docs') +
    chalk_1.default.white(') to translate this properly.\n')
  );
};
exports.warnHasUnwrappedExpression = warnHasUnwrappedExpression;
