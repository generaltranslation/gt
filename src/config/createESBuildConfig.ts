import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { displayResolvedPaths } from '../console/console';

export default function createESBuildConfig(config: Record<string, any> = {}) {
    const esbuildOptions: esbuild.BuildOptions = {
        bundle: true,
        format: 'cjs',
        platform: 'node',
        target: 'es2021',
        loader: {
            '.js': 'jsx',
            '.jsx': 'jsx',
            '.ts': 'ts',
            '.tsx': 'tsx',
            '.css': 'css',  // Add CSS loader
        },
        sourcemap: 'inline',
        external: ['server-only'],
        define: {
            'React': 'global.React'
        },
        plugins: []
    };

    // Add the custom plugin to handle 'server-only' imports
    (esbuildOptions.plugins as any).push({
        name: 'ignore-server-only',
        setup(build: any) {
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
    (esbuildOptions.plugins as any).push({
        name: 'css-module',
        setup(build: any) {
            build.onResolve({ filter: /\.css$/ }, (args: any) => {
                return {
                    path: path.resolve(args.resolveDir, args.path),
                    namespace: 'css-module',
                };
            });

            build.onLoad({ filter: /\.css$/, namespace: 'css-module' }, async (args: any) => {
                const css = await fs.promises.readFile(args.path, 'utf8');
                const contents = `
                    const style = document.createElement('style');
                    style.textContent = ${JSON.stringify(css)};
                    document.head.appendChild(style);
                `;
                return { contents, loader: 'js' };
            });
        },
    });

    if (config.compilerOptions) {
        if (config.compilerOptions.paths) {
            const aliases: any = {};

            const resolvedPaths: [string, string][] = []
            for (const [key, value] of Object.entries(config.compilerOptions.paths)) {
                if (Array.isArray(value) && typeof value[0] === 'string') {
                    const resolvedPath = path.resolve(process.cwd(), value[0].replace('/*', ''));
                    aliases[key.replace('/*', '')] = resolvedPath;
                    resolvedPaths.push([key, resolvedPath]);
                }
            }
            if (resolvedPaths.length) {
                displayResolvedPaths(resolvedPaths)
            }


            esbuildOptions.plugins = esbuildOptions.plugins || [];

            esbuildOptions.plugins.push({
                name: 'alias',
                setup(build) {
                    build.onResolve({ filter: /.*/ }, args => {
                        for (const [aliasKey, aliasPath] of Object.entries(aliases)) {
                            if (args.path.startsWith(`${aliasKey}/`)) {
                                const resolvedPath = path.resolve(aliasPath as string, args.path.slice(aliasKey.length + 1));

                                const extensions = ['.js', '.jsx', '.ts', '.tsx', '.css'];  // Add .css to extensions

                                function resolveWithExtensions(basePath: string): string | null {
                                    for (const ext of extensions) {
                                        const fullPath = `${basePath}${ext}`;
                                        try {
                                            const realPath = fs.realpathSync(fullPath);
                                            return realPath;
                                        } catch (_) {
                                            continue;
                                        }
                                    }
                                    return null;
                                }

                                try {
                                    const realPath = fs.realpathSync(resolvedPath);
                                    return { path: realPath };
                                } catch (err) {
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

    return esbuildOptions;
}