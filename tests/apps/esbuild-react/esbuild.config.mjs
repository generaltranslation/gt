import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esbuild as gtCompiler } from '@generaltranslation/compiler';
import { context } from 'esbuild';

const args = new Set(process.argv.slice(2));
const serve = args.has('--serve');
const production = args.has('--production') || !serve;
const portArg = process.argv[process.argv.indexOf('--port') + 1];
const port = Number(portArg || 5178);
const appDir = path.dirname(fileURLToPath(import.meta.url));

async function writeHtml() {
  const html = await fs.readFile(
    new URL('./index.html', import.meta.url),
    'utf8'
  );
  await fs.mkdir(new URL('./dist', import.meta.url), { recursive: true });
  await fs.writeFile(
    new URL('./dist/index.html', import.meta.url),
    html
      .replace('/src/index.ts', '/assets/index.js')
      .replace(
        '</head>',
        '    <link rel="stylesheet" href="/assets/index.css" />\n  </head>'
      )
  );
}

await writeHtml();

const ctx = await context({
  alias: {
    react: path.join(appDir, 'node_modules/react'),
    'react-dom': path.join(appDir, 'node_modules/react-dom'),
  },
  entryPoints: ['src/index.ts'],
  bundle: true,
  outdir: 'dist/assets',
  format: 'esm',
  sourcemap: !production,
  define: {
    'process.env.NODE_ENV': JSON.stringify(
      production ? 'production' : 'development'
    ),
  },
  plugins: [gtCompiler()],
});

if (serve) {
  const server = await ctx.serve({
    servedir: 'dist',
    host: '127.0.0.1',
    port,
  });
  console.log(`esbuild dev server: http://${server.host}:${server.port}`);
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
