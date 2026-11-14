import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { webpack as gtCompiler } from '@generaltranslation/compiler';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import webpack from 'webpack';
import gtConfig from './gt.config.json' with { type: 'json' };

const appDir = path.dirname(fileURLToPath(import.meta.url));

// Monorepo only: gt-react is a linked workspace package, so we point React at
// this app's copy to guarantee a single React instance. This is needed ONLY
// because the example lives inside the GT monorepo. When you copy the example
// out to run it standalone, delete both these two realpath lookups and the
// resolve.alias block below: a standalone app installs React from npm and
// resolves a single copy on its own.
const reactDir = fs.realpathSync(path.join(appDir, 'node_modules/react'));
const reactDomDir = fs.realpathSync(
  path.join(appDir, 'node_modules/react-dom')
);

export default (_env, argv) => {
  const mode = argv.mode ?? 'production';

  return {
    mode,
    entry: './src/index.ts',
    devtool: mode === 'production' ? 'source-map' : 'eval-source-map',
    output: {
      path: path.join(appDir, 'dist'),
      filename: 'assets/[name].[contenthash].js',
      publicPath: '/',
      clean: true,
    },
    resolve: {
      // Monorepo-only: delete this whole resolve.alias block when copying the
      // example out to run it standalone (see the reactDir note above).
      alias: {
        react: reactDir,
        'react-dom': reactDomDir,
      },
      extensions: ['.tsx', '.ts', '.jsx', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
            },
          },
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
      ],
    },
    plugins: [
      // The GT compiler must run first so it can transform <T> and t() before
      // the rest of the pipeline.
      gtCompiler({ ...gtConfig }),
      new HtmlWebpackPlugin({
        // Reference the template file so HtmlWebpackPlugin watches it in dev.
        template: path.join(appDir, 'index.html'),
      }),
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(mode),
      }),
    ],
    devServer: {
      historyApiFallback: true,
      host: '127.0.0.1',
      static: {
        directory: path.join(appDir, 'dist'),
      },
    },
  };
};
