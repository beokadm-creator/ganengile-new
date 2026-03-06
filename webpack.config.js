const path = require('path');
const webpack = require('webpack');
const { resolver, getModules } = require('@expo/webpack-config/env');

const ROOT = path.resolve(__dirname, '..');

module.exports = function (env, argv) {
  const isProduction = argv.mode === 'production';

  return {
    mode: isProduction ? 'production' : 'development',
    entry: path.resolve(__dirname, 'index.js'),
    devtool: isProduction ? 'source-map' : 'cheap-module-source-map',
    output: {
      path: path.resolve(__dirname, 'dist-web'),
      filename: 'bundle.js',
      publicPath: '/',
    },
    resolve: {
      alias: {
        'react-native$': 'react-native-web',
      },
      extensions: ['.web.tsx', '.web.ts', '.tsx', '.ts', '.web.js', '.js', '.json'],
      modules: getModules({ root: ROOT }),
    },
    module: {
      rules: [
        {
          test: /\.(ts|tsx|js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              cacheDirectory: true,
              presets: ['babel-preset-expo'],
            },
          },
        },
        {
          test: /\.(png|jpe?g|gif|svg|webp)$/,
          type: 'asset/resource',
        },
        {
          test: /\.ttf$/,
          type: 'asset/resource',
        },
      ],
    },
    plugins: [
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
      }),
      new webpack.ProvidePlugin({
        React: 'react',
      }),
    ],
    devServer: {
      historyApiFallback: true,
      hot: true,
      static: {
        directory: path.join(__dirname, 'dist-web'),
      },
      port: 19006,
    },
  };
};
