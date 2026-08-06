const http = require('http');

const payload = JSON.stringify({
  name: 'Test Submitter',
  schoolName: 'Vikas Public School',
  email: 'mr.shafiulla143@gmail.com',
  phone: '9876543210',
  subject: 'Integration Testing support request',
  message: 'This is a test message representing an integration test. It contains more than twenty characters.',
});

function postRequest(index) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path: '/support/contact',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent': 'TestClientAgent/1.0',
        'X-Forwarded-For': '192.168.1.50', // Mock IP to test rate limiting
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log(`Request #${index} status: ${res.statusCode}`);
        try {
          console.log(`Response #${index}:`, JSON.parse(data));
        } catch {
          console.log(`Response #${index} (text):`, data);
        }
        resolve();
      });
    });

    req.on('error', (err) => {
      console.error(`Request #${index} connection error:`, err.message);
      resolve();
    });

    req.write(payload);
    req.end();
  });
}

async function run() {
  console.log("Starting test requests to /support/contact...");
  // Make 6 requests consecutively to test the rate limit of 5 requests per hour.
  for (let i = 1; i <= 6; i++) {
    await postRequest(i);
  }
}

run();
