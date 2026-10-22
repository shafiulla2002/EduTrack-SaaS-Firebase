const admin = require('firebase-admin');
const { getAuth } = require('firebase-admin/auth');
const { GoogleAuth } = require('google-auth-library');
const serviceAccount = require('../firebase-service-account.json');

const app = admin.initializeApp({
  credential: admin.cert(serviceAccount)
});

async function run() {
  try {
    const auth = getAuth(app);
    
    // 1. Delete user from Firebase Auth if exists
    try {
      const user = await auth.getUserByPhoneNumber('+917989725121');
      console.log(`Found existing Firebase Auth user with UID: ${user.uid}. Deleting...`);
      await auth.deleteUser(user.uid);
      console.log('Firebase Auth user deleted successfully.');
    } catch (e) {
      console.log('User not found in Firebase Auth or already deleted:', e.message);
    }

    // 2. Obtain Google Auth token for patch config
    const googleAuth = new GoogleAuth({
      credentials: {
        client_email: serviceAccount.client_email,
        private_key: serviceAccount.private_key
      },
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    const client = await googleAuth.getClient();
    const tokenResponse = await client.getAccessToken();
    const accessToken = tokenResponse.token;

    const projectId = serviceAccount.project_id;
    const url = `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/config?updateMask=signIn.phoneNumber.testPhoneNumbers`;

    const body = {
      signIn: {
        phoneNumber: {
          testPhoneNumbers: {
            "+916001764234": "123456",
            "+919237640717": "123456",
            "+919060020002": "123456",
            "+919642402639": "123456",
            "+919638527410": "123456",
            "+917989725121": "123456" // Add user's phone number as a test number
          }
        }
      }
    };

    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json();
    console.log('Successfully updated Firebase Project Config! Current Test Phone Numbers:', data.signIn.phoneNumber.testPhoneNumbers);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();
