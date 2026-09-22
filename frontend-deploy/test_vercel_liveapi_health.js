const axios = require('axios');

async function main() {
  const liveApiUrl = 'https://edutrack-liveapi-app.vercel.app';
  console.log(`Checking health of Live Vercel API at ${liveApiUrl}...`);

  try {
    const healthRes = await axios.get(`${liveApiUrl}/health`);
    console.log('GET /health SUCCESS:', healthRes.status, healthRes.data);
  } catch (err) {
    console.error('GET /health ERROR:', err.response?.status, err.response?.data || err.message);
  }
}

main();
