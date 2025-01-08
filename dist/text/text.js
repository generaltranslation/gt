"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.asciiArt = void 0;
const figlet_1 = __importDefault(require("figlet"));
exports.asciiArt = figlet_1.default.textSync('General Translation', {
    font: 'Standard'
});
console.log(exports.asciiArt);
