import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

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
            const aliases: any = {};

            // console.log('Found path aliases:', config.compilerOptions.paths);

            for (const [key, value] of Object.entries(config.compilerOptions.paths)) {
                if (Array.isArray(value) && typeof value[0] === 'string') {
                    const resolvedPath = path.resolve(process.cwd(), value[0].replace('/*', ''));
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
                                const resolvedPath = path.resolve(aliasPath as string, args.path.slice(aliasKey.length + 1));

                                const extensions = ['.js', '.jsx', '.ts', '.tsx'];

                                function resolveWithExtensions(basePath: string): string | null {
                                    for (const ext of extensions) {
                                        const fullPath = `${basePath}${ext}`;
                                        try {
                                            const realPath = fs.realpathSync(fullPath); // Resolve symlink if necessary
                                            // console.log(`Resolved symlink for: ${fullPath} to ${realPath}`);
                                            return realPath;
                                        } catch (_) {
                                            continue;
                                        }
                                    }
                                    return null;
                                }

                                try {
                                    const realPath = fs.realpathSync(resolvedPath); // Try without an extension first
                                    // console.log(`Resolved symlink for: ${resolvedPath} to ${realPath}`);
                                    return { path: realPath };
                                } catch (err) {
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
    } else {
        console.log('No compilerOptions found in the config.');
    }

    return esbuildOptions;
}