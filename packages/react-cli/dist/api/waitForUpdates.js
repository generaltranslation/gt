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
const waitForUpdates = (apiKey, baseUrl, versionId, locales, startTime, timeoutDuration) => __awaiter(void 0, void 0, void 0, function* () {
    const loadingInterval = (0, console_1.displayLoadingAnimation)('Waiting for translations to be completed...');
    const checkDeployment = () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const response = yield fetch(`${baseUrl}/v1/project/translations/status/${encodeURIComponent(versionId)}`, {
                method: 'GET',
                headers: Object.assign({ 'Content-Type': 'application/json' }, (apiKey && { 'x-gt-api-key': apiKey })),
            });
            if (response.ok) {
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
    // Calculate time until next 5-second interval since startTime
    const msUntilNextInterval = Math.max(0, 5000 - ((Date.now() - startTime) % 5000));
    // Do first check immediately
    const initialCheck = yield checkDeployment();
    if (initialCheck) {
        clearInterval(loadingInterval);
        console.log('\n');
        console.log(chalk_1.default.green('✓ All translations are live!'));
        return;
    }
    let intervalCheck;
    // Start the interval aligned with the original request time
    setTimeout(() => {
        intervalCheck = setInterval(() => __awaiter(void 0, void 0, void 0, function* () {
            const isDeployed = yield checkDeployment();
            const elapsed = Date.now() - startTime;
            if (isDeployed || elapsed >= timeoutDuration) {
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
    }, msUntilNextInterval);
});
exports.waitForUpdates = waitForUpdates;
