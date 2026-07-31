import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const handler = require('./src/main');
export default handler;
