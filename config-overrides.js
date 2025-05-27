const webpack = require('webpack');

module.exports = function override(config) {
  const fallback = {
    "process": require.resolve("process/browser")
  };

  config.resolve = {
    ...config.resolve,
    fallback: {
      ...config.resolve?.fallback,
      ...fallback,
    }
  };

  config.plugins = [
    ...config.plugins,
    new webpack.ProvidePlugin({
      process: 'process/browser'
    })
  ];

  return config;
}; 