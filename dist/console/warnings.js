"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.warnHasUnwrappedExpression = exports.warnNoId = exports.warnVariableProp = exports.warnApiKeyInConfig = void 0;
const warnApiKeyInConfig = (optionsFilepath) => {
    console.warn(`WARNING: Found apiKey in "${optionsFilepath}". Are you sure you want to do this? Make sure your API key is not accidentally exposed, e.g. by putting ${optionsFilepath} in .gitignore.\n`);
};
exports.warnApiKeyInConfig = warnApiKeyInConfig;
const warnVariableProp = (file, attrName, value) => {
    console.warn(`WARNING: Found <T> component in ${file} with variable ${attrName}: "${value}". Change "${attrName}" to ensure this content is translated.\n`);
};
exports.warnVariableProp = warnVariableProp;
const warnNoId = (file) => {
    console.warn(`WARNING: Found <T> component in ${file} with no id. Add an id to ensure the content is translated.\n`);
};
exports.warnNoId = warnNoId;
const warnHasUnwrappedExpression = (file, id) => {
    console.warn(`WARNING: <T id="${id}"> in ${file} has children that could change at runtime. Use a variable component like <Var> (https://generaltranslation.com/docs) to translate this properly.\n`);
};
exports.warnHasUnwrappedExpression = warnHasUnwrappedExpression;
