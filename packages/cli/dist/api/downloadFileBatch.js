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
exports.downloadFileBatch = downloadFileBatch;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Downloads multiple translation files in a single batch request
 * @param baseUrl - The base URL for the General Translation API
 * @param apiKey - The API key for the General Translation API
 * @param files - Array of files to download with their output paths
 * @param maxRetries - Maximum number of retry attempts
 * @param retryDelay - Delay between retries in milliseconds
 * @returns Object containing successful and failed file IDs
 */
function downloadFileBatch(baseUrl_1, apiKey_1, files_1) {
    return __awaiter(this, arguments, void 0, function* (baseUrl, apiKey, files, maxRetries = 3, retryDelay = 1000) {
        let retries = 0;
        const fileIds = files.map((file) => file.translationId);
        const result = { successful: [], failed: [] };
        // Create a map of translationId to outputPath for easier lookup
        const outputPathMap = new Map(files.map((file) => [file.translationId, file.outputPath]));
        while (retries <= maxRetries) {
            try {
                const response = yield fetch(`${baseUrl}/v1/project/translations/files/batch-download`, {
                    method: 'POST',
                    headers: Object.assign({ 'Content-Type': 'application/json' }, (apiKey && { 'x-gt-api-key': apiKey })),
                    body: JSON.stringify({ fileIds }),
                });
                if (response.ok) {
                    const responseData = yield response.json();
                    const downloadedFiles = responseData.files || [];
                    // Process each file in the response
                    for (const file of downloadedFiles) {
                        try {
                            const translationId = file.id;
                            const outputPath = outputPathMap.get(translationId);
                            if (!outputPath) {
                                console.warn(`No output path found for file: ${translationId}`);
                                result.failed.push(translationId);
                                continue;
                            }
                            // Ensure the directory exists
                            const dir = path.dirname(outputPath);
                            if (!fs.existsSync(dir)) {
                                fs.mkdirSync(dir, { recursive: true });
                            }
                            // Write the file to disk
                            fs.writeFileSync(outputPath, file.data);
                            result.successful.push(translationId);
                        }
                        catch (error) {
                            console.error(`Error saving file ${file.id}:`, error);
                            result.failed.push(file.id);
                        }
                    }
                    // Add any files that weren't in the response to the failed list
                    const downloadedIds = new Set(downloadedFiles.map((file) => file.id));
                    for (const fileId of fileIds) {
                        if (!downloadedIds.has(fileId) && !result.failed.includes(fileId)) {
                            result.failed.push(fileId);
                        }
                    }
                    return result;
                }
                // If we get here, the response was not OK
                if (retries >= maxRetries) {
                    console.error(`Failed to download files in batch. Status: ${response.status} after ${maxRetries + 1} attempts.`);
                    // Mark all files as failed
                    result.failed = [...fileIds];
                    return result;
                }
                // Increment retry counter and wait before next attempt
                retries++;
                yield new Promise((resolve) => setTimeout(resolve, retryDelay));
            }
            catch (error) {
                if (retries >= maxRetries) {
                    console.error(`Error downloading files in batch after ${maxRetries + 1} attempts:`, error);
                    // Mark all files as failed
                    result.failed = [...fileIds];
                    return result;
                }
                retries++;
                yield new Promise((resolve) => setTimeout(resolve, retryDelay));
            }
        }
        // Mark all files as failed if we get here
        result.failed = [...fileIds];
        return result;
    });
}
