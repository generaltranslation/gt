"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = createInlineUpdates;
function createInlineUpdates(options, esbuildConfig) {
    return __awaiter(this, void 0, void 0, function* () {
        const updates = [];
        // Looks for "src", "app" folders, otherwise goes from root and looks at all folders not beginning ".", not "node_modules", and not in ".gitignore"
        // Find the files mentioning gt-next or gt-react
        // Not foolproof but good enough
        // Find <T> components within those
        // Extract { id, context, singular, plural, dual, zero, one, two, few, many, other }
        // Skip to the next tag if id is variable or blank, assume the user knows what they're doing
        // Write new temporary dictionary file with just one id, with, context, branches etc.
        // ESBuild that dictionary
        // Create an update for that dictionary's entry
        // Repeat
        return updates;
    });
}
