"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.downloadFile = downloadFile;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Helper function to download a file
function downloadFile(baseUrl_1, apiKey_1, translationId_1, outputPath_1) {
    return __awaiter(this, arguments, void 0, function* (baseUrl, apiKey, translationId, outputPath, maxRetries = 3, retryDelay = 1000) {
        let retries = 0;
        while (retries <= maxRetries) {
            try {
                const downloadResponse = yield fetch(`${baseUrl}/v1/project/translations/files/${translationId}/download`, {
                    method: 'GET',
                    headers: Object.assign({}, (apiKey && { 'x-gt-api-key': apiKey })),
                });
                if (downloadResponse.ok) {
                    // Ensure the directory exists
                    const dir = path.dirname(outputPath);
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }
                    // Get the file data as an ArrayBuffer
                    const fileData = yield downloadResponse.arrayBuffer();
                    // Write the file to disk
                    fs.writeFileSync(outputPath, Buffer.from(fileData));
                    return true;
                }
                // If we get here, the response was not OK
                if (retries >= maxRetries) {
                    console.error(`Failed to download file ${outputPath}. Status: ${downloadResponse.status} after ${maxRetries + 1} attempts.`);
                    return false;
                }
                // Increment retry counter and wait before next attempt
                retries++;
                yield new Promise((resolve) => setTimeout(resolve, retryDelay));
            }
            catch (error) {
                if (retries >= maxRetries) {
                    console.error(`Error downloading file ${outputPath} after ${maxRetries + 1} attempts:`, error);
                    return false;
                }
                retries++;
                yield new Promise((resolve) => setTimeout(resolve, retryDelay));
            }
        }
        return false;
    });
}
