"use strict";
// ---- ERRORS ---- //
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMismatchingIdHashWarning = exports.createMismatchingHashWarning = exports.createInvalidElementEntryWarning = exports.createNoEntryWarning = exports.createLibraryNoEntryWarning = exports.createGenericRuntimeTranslationError = exports.dynamicTranslationError = exports.renderingError = exports.createNestedTError = exports.createNestedDataGTError = exports.createClientSideTHydrationError = exports.createClientSideTDictionaryCollisionError = exports.createStringTranslationError = exports.createClientSideTWithoutIdError = exports.createPluralMissingError = exports.projectIdMissingError = void 0;
exports.projectIdMissingError = "gt-react Error: General Translation cloud services require a project ID! Find yours at www.generaltranslation.com/dashboard.";
const createPluralMissingError = (children) => `<Plural> component with children "${children}" requires "n" option.`;
exports.createPluralMissingError = createPluralMissingError;
const createClientSideTWithoutIdError = (children) => `Client-side <T> with no provided 'id' prop. Children: "${children}"`;
exports.createClientSideTWithoutIdError = createClientSideTWithoutIdError;
const createStringTranslationError = (content, id) => `gt-next string translation error. tx("${content}")${id ? ` with id "${id}"` : ""} failed.`;
exports.createStringTranslationError = createStringTranslationError;
const createClientSideTDictionaryCollisionError = (id) => `<T id="${id}">, "${id}" is also used as a key in the dictionary. Don't give <T> components the same ID as dictionary entries.`;
exports.createClientSideTDictionaryCollisionError = createClientSideTDictionaryCollisionError;
const createClientSideTHydrationError = (id) => `<T id="${id}"> is used in a client component without a valid saved translation. This can cause hydration errors.` +
    `\n\nTo fix this error, consider using a dictionary with useGT() or pushing translations from the command line in advance.`;
exports.createClientSideTHydrationError = createClientSideTHydrationError;
const createNestedDataGTError = (child) => `General Translation already in use on child with props: ${child.props}. This usually occurs when you nest <T> components within the same file. Remove one of the <T> components to continue.`;
exports.createNestedDataGTError = createNestedDataGTError;
const createNestedTError = (child) => { var _a; return `General Translation: Nested <T> components. The inner <T> has the id: "${(_a = child === null || child === void 0 ? void 0 : child.props) === null || _a === void 0 ? void 0 : _a.id}".`; };
exports.createNestedTError = createNestedTError;
exports.renderingError = "General Translation: Rendering error.";
exports.dynamicTranslationError = "Error fetching batched translations:";
const createGenericRuntimeTranslationError = (id, hash) => {
    if (!id) {
        return `Translation failed for hash: ${hash}`;
    }
    else {
        return `Translation failed for id: ${id}, hash: ${hash} `;
    }
};
exports.createGenericRuntimeTranslationError = createGenericRuntimeTranslationError;
// ---- WARNINGS ---- //
const createLibraryNoEntryWarning = (id) => `gt-react: No dictionary entry found for id: "${id}"`;
exports.createLibraryNoEntryWarning = createLibraryNoEntryWarning;
const createNoEntryWarning = (id, prefixedId) => `t('${id}') finding no translation for dictionary item ${prefixedId} !`;
exports.createNoEntryWarning = createNoEntryWarning;
const createInvalidElementEntryWarning = (id, prefixedId) => `t('${id}') invalid dictionary entry for ${prefixedId} ! useElement() can only be used to render JSX elements. Strings and other types are not allowed.`;
exports.createInvalidElementEntryWarning = createInvalidElementEntryWarning;
const createMismatchingHashWarning = (expectedHash, receivedHash) => `Mismatching hashes! Expected hash: ${expectedHash}, but got hash: ${receivedHash}. We will still render your translation, but make sure to update to the newest version: www.generaltranslation.com/docs`;
exports.createMismatchingHashWarning = createMismatchingHashWarning;
const createMismatchingIdHashWarning = (expectedId, expectedHash, receivedId, receivedHash) => `Mismatching ids or hashes! Expected id: ${expectedId}, hash: ${expectedHash}, but got id: ${receivedId}, hash: ${receivedHash}. We will still render your translation, but make sure to update to the newest version: www.generaltranslation.com/docs`;
exports.createMismatchingIdHashWarning = createMismatchingIdHashWarning;
//# sourceMappingURL=createMessages.js.map