const https = require('https');

function testKey(key) {
  return new Promise((resolve) => {
    const url = `https://identitytoolkit.googleapis.com/v1/recaptchaParams?key=${key}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve({ key, success: true, data });
        } else {
          resolve({ key, success: false, statusCode: res.statusCode, data });
        }
      });
    }).on('error', (err) => {
      resolve({ key, success: false, error: err.message });
    });
  });
}

async function run() {
  const keys = [
    "AIzaSyBAKsVm1aMGAywUNIVTG-CH_s9Rghc0Ajk", // live (with g)
    "AIzaSyBAKsVm1aMGAywUNIVTG-CH_s9Rqhc0Ajk"  // local (with q)
  ];
  for (const key of keys) {
    console.log(`Testing key: ${key}`);
    const res = await testKey(key);
    console.log(`Success: ${res.success}`);
    console.log(`Status: ${res.statusCode}`);
    console.log(`Data: ${res.data}`);
    console.log('-----------------------------------------');
  }
}

run();
