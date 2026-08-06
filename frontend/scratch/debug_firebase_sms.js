// debug_firebase_sms.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInWithPhoneNumber, RecaptchaVerifier } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

console.log('Firebase config:', firebaseConfig);

if (Object.values(firebaseConfig).some(v => !v)) {
  console.error('Missing Firebase env vars');
  process.exit(1);
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

// Use invisible recaptcha on a dummy hidden div
const div = document.createElement('div');
div.id = 'recaptcha-container';
document.body.appendChild(div);

const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });

const testPhone = '+15555555555'; // replace with a real test number if needed
signInWithPhoneNumber(auth, testPhone, verifier)
  .then((confirmationResult) => {
    console.log('signInWithPhoneNumber succeeded');
    // Not sending OTP, just exit
    process.exit(0);
  })
  .catch((error) => {
    console.error('signInWithPhoneNumber error code:', error.code, 'message:', error.message);
    process.exit(1);
  });
