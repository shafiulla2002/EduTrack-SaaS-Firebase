const { GoogleAuth } = require('google-auth-library');
const serviceAccount = require('../firebase-service-account.json');

async function run() {
  try {
    const auth = new GoogleAuth({
      credentials: {
        client_email: serviceAccount.client_email,
        private_key: serviceAccount.private_key
      },
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const accessToken = tokenResponse.token;

    console.log('Obtained access token. Fetching project config...');
    const projectId = serviceAccount.project_id;
    const url = `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/config`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    console.log('Authorized Domains:', data.authorizedDomains);
  } catch (err) {
    console.error('Error fetching authorized domains:', err.response ? err.response.data : err.message);
  }
}

run();
