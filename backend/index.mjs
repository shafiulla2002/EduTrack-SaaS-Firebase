import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const handler = require('./dist/main');
export default handler;
