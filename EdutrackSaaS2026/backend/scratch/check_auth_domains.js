const admin = require('firebase-admin');
const { getAuth } = require('firebase-admin/auth');
const serviceAccount = require('../firebase-service-account.json');

admin.initializeApp({
  credential: admin.cert(serviceAccount)
});

async function run() {
  try {
    const configManager = getAuth().projectConfigManager();
    const projectConfig = await configManager.getProjectConfig();
    console.log('Project ID:', serviceAccount.project_id);
    console.log('Project Config:', projectConfig);
  } catch (err) {
    console.error('Failed to get project config:', err.message);
  }
}

run();
