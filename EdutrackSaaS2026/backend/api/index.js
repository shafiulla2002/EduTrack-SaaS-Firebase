const main = require('../dist/main');
const handler = main.default || main;

module.exports = (req, res) => {
  return handler(req, res);
};
