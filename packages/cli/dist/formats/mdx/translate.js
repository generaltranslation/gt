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
exports.translateFile = translateFile;
const sendFiles_1 = require("../../api/sendFiles");
/**
 * Sends an entire file to the API for translation
 * @param fileContent - The raw content of the file to translate
 * @param options - Translation options including API settings
 * @returns The translated file content or null if translation failed
 */
function translateFile(fileContent, options) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield (0, sendFiles_1.sendFiles)([
                {
                    content: fileContent,
                    fileName: options.fileName,
                    fileFormat: options.fileFormat,
                },
            ], Object.assign(Object.assign({}, options), { publish: false, wait: true, timeout: '600' }));
            return response;
        }
        catch (error) {
            console.error('Error translating file:', error);
            return null;
        }
    });
}
