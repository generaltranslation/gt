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
exports.waitForUpdates = void 0;
const chalk_1 = __importDefault(require("chalk"));
const console_1 = require("../console/console");
const waitForUpdates = (apiKey, baseUrl, versionId, locales) => __awaiter(void 0, void 0, void 0, function* () {
    const loadingInterval = (0, console_1.displayLoadingAnimation)('Waiting for translations to be completed...');
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes total (60 * 5000ms)
    const checkDeployment = () => __awaiter(void 0, void 0, void 0, function* () {
        if (!locales)
            return false;
        try {
            const response = yield fetch(`${baseUrl}/v1/project/translations/status`, {
                method: 'GET',
                headers: Object.assign({ 'Content-Type': 'application/json' }, (apiKey && { 'x-gt-api-key': apiKey })),
                body: JSON.stringify({
                    versionId: versionId,
                }),
            });
            if (response.status === 200) {
                const data = yield response.json();
                if (data.count >= locales.length) {
                    return true;
                }
            }
            return false;
        }
        catch (error) {
            return false;
        }
    });
    let intervalCheck;
    intervalCheck = setInterval(() => __awaiter(void 0, void 0, void 0, function* () {
        attempts++;
        const isDeployed = yield checkDeployment();
        if (isDeployed || attempts >= maxAttempts) {
            clearInterval(loadingInterval);
            clearInterval(intervalCheck);
            console.log('\n');
            if (isDeployed) {
                console.log(chalk_1.default.green('✓ All translations are live!'));
            }
            else {
                console.log(chalk_1.default.yellow('⚠️  Timed out waiting for translations'));
            }
        }
    }), 5000);
});
exports.waitForUpdates = waitForUpdates;
