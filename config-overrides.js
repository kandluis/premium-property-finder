const webpack = require('webpack'); 
module.exports = function override(config) { 
  const fallback = config.resolve.fallback || {}; 
  Object.assign(fallback, { 
    "timers": require.resolve("timers-browserify"),
    "stream": require.resolve("stream-browserify"),
  });
 config.resolve.fallback = fallback;
 return config; 
}
