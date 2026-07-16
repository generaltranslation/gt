import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { webpack as gtCompiler } from '@generaltranslation/compiler';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import webpack from 'webpack';

const appDir = path.dirname(fileURLToPath(import.meta.url));
const reactDir = fs.realpathSync(path.join(appDir, 'node_modules/react'));
const reactDomDir = fs.realpathSync(
  path.join(appDir, 'node_modules/react-dom')
);
const html = fs
  .readFileSync(path.join(appDir, 'index.html'), 'utf8')
  .replace(/\s*<script type="module" src="\/src\/index\.ts"><\/script>\s*/, '');

export default (_env, argv) => {
  const mode = argv.mode ?? 'production';

  return {
    mode,
    entry: './src/index.ts',
    devtool: mode === 'production' ? 'source-map' : 'eval-source-map',
    output: {
      path: path.join(appDir, 'dist'),
      filename: 'assets/[name].js',
      clean: true,
    },
    resolve: {
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
      gtCompiler(),
      new HtmlWebpackPlugin({
        templateContent: html,
      }),
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(mode),
      }),
    ],
    devServer: {
      historyApiFallback: true,
      static: {
        directory: path.join(appDir, 'dist'),
      },
    },
  };
};
