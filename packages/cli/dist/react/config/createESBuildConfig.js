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
exports.default = createESBuildConfig;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const console_1 = require("../../console/console");
function createESBuildConfig(config = {}) {
    const esbuildOptions = {
        bundle: true,
        format: 'cjs',
        platform: 'node',
        target: 'es2021',
        loader: {
            '.js': 'jsx',
            '.ts': 'ts',
            '.css': 'css', // Add CSS loader
        },
        sourcemap: 'inline',
        external: ['server-only'],
        define: {
            React: 'global.React',
        },
        plugins: [],
    };
    // Add the custom plugin to handle 'server-only' imports
    esbuildOptions.plugins.push({
        name: 'ignore-server-only',
        setup(build) {
            build.onResolve({ filter: /^server-only$/ }, () => {
                return {
                    path: 'server-only',
                    namespace: 'ignore-server-only',
                };
            });
            build.onLoad({ filter: /^server-only$/, namespace: 'ignore-server-only' }, () => {
                return {
                    contents: 'module.exports = {};',
                    loader: 'js',
                };
            });
        },
    });
    // Add a plugin to handle CSS imports
    esbuildOptions.plugins.push({
        name: 'css-module',
        setup(build) {
            build.onResolve({ filter: /\.css$/ }, (args) => {
                return {
                    path: path_1.default.resolve(args.resolveDir, args.path),
                    namespace: 'css-module',
                };
            });
            build.onLoad({ filter: /\.css$/, namespace: 'css-module' }, (args) => __awaiter(this, void 0, void 0, function* () {
                const css = yield fs_1.default.promises.readFile(args.path, 'utf8');
                const contents = `
                    const style = document.createElement('style');
                    style.textContent = ${JSON.stringify(css)};
                    document.head.appendChild(style);
                `;
                return { contents, loader: 'js' };
            }));
        },
    });
    if (config.compilerOptions) {
        if (config.compilerOptions.paths) {
            const aliases = {};
            const resolvedPaths = [];
            for (const [key, value] of Object.entries(config.compilerOptions.paths)) {
                if (Array.isArray(value) && typeof value[0] === 'string') {
                    const resolvedPath = path_1.default.resolve(process.cwd(), value[0].replace('/*', ''));
                    aliases[key.replace('/*', '')] = resolvedPath;
                    resolvedPaths.push([key, resolvedPath]);
                }
            }
            if (resolvedPaths.length) {
                (0, console_1.displayResolvedPaths)(resolvedPaths);
            }
            esbuildOptions.plugins = esbuildOptions.plugins || [];
            esbuildOptions.plugins.push({
                name: 'alias',
                setup(build) {
                    build.onResolve({ filter: /.*/ }, (args) => {
                        for (const [aliasKey, aliasPath] of Object.entries(aliases)) {
                            if (args.path.startsWith(`${aliasKey}/`)) {
                                const resolvedPath = path_1.default.resolve(aliasPath, args.path.slice(aliasKey.length + 1));
                                const extensions = ['.js', '.ts', '.css']; // Add .css to extensions
                                function resolveWithExtensions(basePath) {
                                    for (const ext of extensions) {
                                        const fullPath = `${basePath}${ext}`;
                                        try {
                                            const realPath = fs_1.default.realpathSync(fullPath);
                                            return realPath;
                                        }
                                        catch (_) {
                                            continue;
                                        }
                                    }
                                    return null;
                                }
                                try {
                                    const realPath = fs_1.default.realpathSync(resolvedPath);
                                    return { path: realPath };
                                }
                                catch (err) {
                                    const hasExtension = extensions.some((ext) => resolvedPath.endsWith(ext));
                                    if (!hasExtension) {
                                        const resolvedWithExt = resolveWithExtensions(resolvedPath);
                                        if (resolvedWithExt) {
                                            return { path: resolvedWithExt };
                                        }
                                    }
                                    throw new Error(`Unable to resolve path: ${resolvedPath}`);
                                }
                            }
                        }
                    });
                },
            });
        }
    }
    return esbuildOptions;
}
