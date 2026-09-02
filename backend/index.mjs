import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const main = require('./dist/main');
const handler = main.default || main;

export default (req, res) => handler(req, res);

