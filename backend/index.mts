import { createRequire } from 'module';
const require = createRequire('/var/task/backend/index.js');
const handler = require('./src/main');
export default handler;
