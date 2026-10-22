const https = require('https');

const keys = [
  "AIzaSyBAKsVm1aMGAywUNIVTG-CH_s9Rghc0Ajk", // key with Vm1a, UNIVTG, and g
  "AIzaSyBAKsVm1aMGAywUNIVTG-CH_s9Rqhc0Ajk"  // key with Vm1a, UNIVTG, and q
];

function testKey(key) {
  return new Promise((resolve) => {
    const url = `https://identitytoolkit.googleapis.com/v1/recaptchaParams?key=${key}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          key,
          statusCode: res.statusCode,
          data: data
        });
      });
    }).on('error', (err) => {
      resolve({ key, error: err.message });
    });
  });
}

async function run() {
  for (const key of keys) {
    const res = await testKey(key);
    console.log(`Key: ${res.key}`);
    console.log(`Status: ${res.statusCode}`);
    console.log(`Response: ${res.data || res.error}`);
    console.log('-----------------------------------');
  }
}

run();
