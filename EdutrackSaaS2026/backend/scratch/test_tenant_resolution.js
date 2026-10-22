const http = require('http');

// Test request to backend send-otp with host header edu-track-saas-orcin.vercel.app
const data = JSON.stringify({
  phone: '6001764234',
  portal: 'admin'
});

const req = http.request({
  hostname: 'localhost',
  port: 3001,
  path: '/auth/send-otp',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    'Host': 'edu-track-saas-orcin.vercel.app'
  }
}, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('Response Body:', body);
  });
});

req.on('error', (e) => {
  console.error('Request Error:', e.message);
});

req.write(data);
req.end();
