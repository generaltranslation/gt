"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = applyConfigToEsbuild;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function applyConfigToEsbuild(config) {
    const esbuildOptions = {
        bundle: true,
        format: 'cjs',
        platform: 'node',
        target: 'es2021',
        loader: {
            '.js': 'jsx',
            '.jsx': 'jsx',
            '.ts': 'ts',
            '.tsx': 'tsx',
        },
        sourcemap: 'inline',
        external: ['server-only'],
        define: {
            'React': 'global.React'
        },
        plugins: []
    };
    // Add the custom plugin to handle 'server-only' imports
    esbuildOptions.plugins.push({
        name: 'ignore-server-only',
        setup(build) {
            build.onResolve({ filter: /^server-only$/ }, () => {
                return {
                    path: 'server-only', // This can be a virtual module name
                    namespace: 'ignore-server-only',
                };
            });
            build.onLoad({ filter: /^server-only$/, namespace: 'ignore-server-only' }, () => {
                return {
                    contents: 'module.exports = {};', // Stubbing out the content
                    loader: 'js',
                };
            });
        },
    });
    if (config.compilerOptions) {
        // console.log('Compiler options found in config:', config.compilerOptions);
        if (config.compilerOptions.paths) {
            const aliases = {};
            // console.log('Found path aliases:', config.compilerOptions.paths);
            for (const [key, value] of Object.entries(config.compilerOptions.paths)) {
                if (Array.isArray(value) && typeof value[0] === 'string') {
                    const resolvedPath = path_1.default.resolve(process.cwd(), value[0].replace('/*', ''));
                    aliases[key.replace('/*', '')] = resolvedPath;
                    console.log(`Resolved alias '${key}' to '${resolvedPath}'`);
                }
            }
            esbuildOptions.plugins = esbuildOptions.plugins || [];
            esbuildOptions.plugins.push({
                name: 'alias',
                setup(build) {
                    build.onResolve({ filter: /.*/ }, args => {
                        for (const [aliasKey, aliasPath] of Object.entries(aliases)) {
                            if (args.path.startsWith(`${aliasKey}/`)) {
                                const resolvedPath = path_1.default.resolve(aliasPath, args.path.slice(aliasKey.length + 1));
                                const extensions = ['.js', '.jsx', '.ts', '.tsx'];
                                function resolveWithExtensions(basePath) {
                                    for (const ext of extensions) {
                                        const fullPath = `${basePath}${ext}`;
                                        try {
                                            const realPath = fs_1.default.realpathSync(fullPath); // Resolve symlink if necessary
                                            // console.log(`Resolved symlink for: ${fullPath} to ${realPath}`);
                                            return realPath;
                                        }
                                        catch (_) {
                                            continue;
                                        }
                                    }
                                    return null;
                                }
                                try {
                                    const realPath = fs_1.default.realpathSync(resolvedPath); // Try without an extension first
                                    // console.log(`Resolved symlink for: ${resolvedPath} to ${realPath}`);
                                    return { path: realPath };
                                }
                                catch (err) {
                                    // Check if the path has an extension
                                    const hasExtension = extensions.some(ext => resolvedPath.endsWith(ext));
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
    else {
        console.log('No compilerOptions found in the config.');
    }
    return esbuildOptions;
}
