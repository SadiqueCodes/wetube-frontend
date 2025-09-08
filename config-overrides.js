const webpack = require('webpack');

module.exports = function override(config) {
  const fallback = {
    "process": require.resolve("process/browser.js")
  };

  config.resolve = {
    ...config.resolve,
    fallback: {
      ...config.resolve?.fallback,
      ...fallback,
    },
    fullySpecified: false
  };

  config.module.rules.push({
    test: /\.m?js/,
    resolve: {
      fullySpecified: false
    }
  });

  config.plugins = [
    ...config.plugins,
    new webpack.ProvidePlugin({
      process: 'process/browser.js'
    })
  ];

  return config;
}; 