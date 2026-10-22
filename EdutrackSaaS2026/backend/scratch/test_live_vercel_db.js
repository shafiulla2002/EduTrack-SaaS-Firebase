// READ-ONLY: Query live Vercel backend and print a compact summary
const https = require('https');

function testUrl(tenantId) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'edu-track-saa-s-orcin.vercel.app',
      path: '/_backend/tenant/public-branding',
      method: 'GET',
      headers: {
        'X-Tenant-ID': tenantId
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          tenantId,
          status: res.statusCode,
          data: data
        });
      });
    });

    req.on('error', (e) => {
      resolve({
        tenantId,
        status: 'ERROR',
        error: e.message
      });
    });

    req.end();
  });
}

async function main() {
  const subdomains = [
    'demo-school',
    'synergy-school',
    'greenwood-high-school',
    'sri-vikas-high-school',
    'vikas-school',
    'david-school'
  ];

  console.log('--- COMPACT LIVE TEST ---');
  for (const sub of subdomains) {
    const r = await testUrl(sub);
    let summary = '';
    if (r.status === 200) {
      const parsed = JSON.parse(r.data);
      summary = `FOUND (${parsed.name})`;
    } else {
      summary = `FAILED (Status: ${r.status}, Msg: ${r.data.substring(0, 80)})`;
    }
    console.log(`Subdomain '${sub}': ${summary}`);
  }
}

main();
