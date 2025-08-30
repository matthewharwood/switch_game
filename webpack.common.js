const path = require('path');

module.exports = {
  entry: {
    app: './js/app.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    clean: true,
    filename: './js/app.js',
  },
  module: {
    unknownContextCritical: false,
    exprContextCritical: false,
  },
  ignoreWarnings: [
    {
      module: /gun/,
      message: /Critical dependency/,
    },
  ],
};
