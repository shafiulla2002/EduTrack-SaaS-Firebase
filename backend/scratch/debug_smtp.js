const nodemailer = require('nodemailer');
require('dotenv').config();

async function testSMTP() {
  console.log("Checking environment variables loaded from .env...");
  console.log("SUPPORT_EMAIL:", process.env.SUPPORT_EMAIL);
  console.log("SMTP_HOST:", process.env.SMTP_HOST);
  console.log("SMTP_PORT:", process.env.SMTP_PORT);
  console.log("SMTP_SECURE:", process.env.SMTP_SECURE);
  console.log("SMTP_USER:", process.env.SMTP_USER);
  console.log("SMTP_PASS length:", process.env.SMTP_PASS ? process.env.SMTP_PASS.length : 0);

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error("\n❌ Error: SMTP variables are missing from your backend/.env file!");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  console.log("\nConnecting to SMTP server and verifying authentication credentials...");
  try {
    await transporter.verify();
    console.log("✅ SMTP connection and authentication succeeded! Gmail accepted your password.");
  } catch (error) {
    console.error("❌ SMTP verification failed with the following error:\n");
    console.error(error);
  }
}

testSMTP();
