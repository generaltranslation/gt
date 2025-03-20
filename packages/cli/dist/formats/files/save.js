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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveTranslatedFile = saveTranslatedFile;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
/**
 * Saves translated MDX/MD file content to the appropriate location
 */
function saveTranslatedFile(translatedContent, outputDir, fileName, dataFormat, locales) {
    return __awaiter(this, void 0, void 0, function* () {
        // Create locale-specific directories if they don't exist
        for (const locale of locales) {
            const localeDir = path_1.default.join(outputDir, locale);
            yield promises_1.default.mkdir(localeDir, { recursive: true });
            // Save the translated file with the appropriate extension
            const outputPath = path_1.default.join(localeDir, fileName);
            yield promises_1.default.writeFile(outputPath, translatedContent);
            console.log(`Saved translated ${dataFormat} file to: ${outputPath}`);
        }
    });
}
