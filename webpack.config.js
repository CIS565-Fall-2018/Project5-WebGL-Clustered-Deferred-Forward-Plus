const path = require('path');
const webpack = require('webpack');
const MinifyPlugin = require('babel-minify-webpack-plugin');

module.exports = function(env) {
  const isProduction = env && env.production === true;

  return {
    entry: path.join(__dirname, 'src/init'),
    output: {
      path: path.join(__dirname, 'build'),
      filename: 'bundle.js',
    },
    module: {
      loaders: [
        {
          test: /\.js$/,
          exclude: /(node_modules|bower_components)/,
          loader: 'babel-loader',
          query: {
            presets: [['env', {
              targets: {
                browsers: ['> 1%', 'last 2 major versions'],
              },
              loose: true,
              modules: false,
            }]],
          },
        },
        {
          test: /\.glsl$/,
          loader: 'webpack-glsl-loader'
        },
      ],
    },
    devtool: 'source-map',
    devServer: {
      port: 5650,
      publicPath: '/build/'
    },
  };
};
