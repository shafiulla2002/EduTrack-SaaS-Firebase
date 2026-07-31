import { createRequire } from 'module';
const require = createRequire('/var/task/index.js');
const handler = require('./src/main');
export default handler;
