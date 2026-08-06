const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.resolve(__dirname, '../.env.local');
const content = fs.readFileSync(envPath, 'utf8');
console.log('Raw content:\n', content);

const parsed = dotenv.parse(content);
console.log('Parsed API Key:', JSON.stringify(parsed.NEXT_PUBLIC_FIREBASE_API_KEY));
