const admin = require('firebase-admin');
const { getAuth } = require('firebase-admin/auth');
const serviceAccount = require('../firebase-service-account.json');

const app = admin.initializeApp({
  credential: admin.cert(serviceAccount)
});

async function run() {
  try {
    const auth = getAuth(app);
    const listUsersResult = await auth.listUsers(100);
    console.log('--- FIREBASE AUTH USERS ---');
    listUsersResult.users.forEach((userRecord) => {
      console.log('UID:', userRecord.uid);
      console.log('Email:', userRecord.email);
      console.log('Phone:', userRecord.phoneNumber);
      console.log('---------------------------');
    });
  } catch (err) {
    console.error('Error listing Firebase users:', err.message);
  }
}

run();
