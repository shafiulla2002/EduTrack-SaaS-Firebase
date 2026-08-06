const axios = require('axios');

async function main() {
  const url = 'https://edu-track-saa-s-orcin.vercel.app/auth/login?portal=admin';
  console.log('Fetching login page...');
  const res = await axios.get(url);
  const html = res.data;
  
  // Find all JS bundles
  const scriptRegex = /_next\/static\/chunks\/[^"]+\.js/g;
  const matches = html.match(scriptRegex) || [];
  const uniqueScripts = [...new Set(matches)];
  console.log('Found scripts:', uniqueScripts);
  
  for (const scriptPath of uniqueScripts) {
    const scriptUrl = `https://edu-track-saa-s-orcin.vercel.app/${scriptPath}`;
    console.log(`Checking ${scriptUrl}...`);
    try {
      const scriptRes = await axios.get(scriptUrl);
      const content = scriptRes.data;
      if (content.includes('AIzaSy')) {
        console.log(`Found AIzaSy in ${scriptPath}!`);
        // Let's find context around AIzaSy
        const index = content.indexOf('AIzaSy');
        console.log('Snippet:', content.substring(index, index + 350));
      }
    } catch (err) {
      console.error(`Failed to fetch ${scriptUrl}:`, err.message);
    }
  }
}

main().catch(console.error);
