const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
  mode: 'development',
  devtool: 'inline-source-map',
  devServer: {
    liveReload: true,
    hot: true,
    open: true,
    static: ['./'],
    watchFiles: {
      paths: ['**/*'],
      options: {
        ignored: ['**/node_modules/**', '**/.idea/**', '**/.git/**', '**/dist/**'],
      },
    },
  },
});
