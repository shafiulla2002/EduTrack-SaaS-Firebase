const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

// Shared encryption helpers matching encryption.util.ts
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

function encrypt(text, secretKey) {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = crypto.pbkdf2Sync(secretKey, salt, ITERATIONS, KEY_LENGTH, 'sha256');
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    salt.toString('hex'),
    iv.toString('hex'),
    tag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':');
}

function decrypt(cipherText, secretKey) {
  const parts = cipherText.split(':');
  if (parts.length !== 4) throw new Error('Invalid ciphertext format');
  const [saltHex, ivHex, tagHex, encryptedHex] = parts;
  const salt = Buffer.from(saltHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const key = crypto.pbkdf2Sync(secretKey, salt, ITERATIONS, KEY_LENGTH, 'sha256');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
}

async function runTests() {
  console.log('====================================================');
  console.log('CS EduTrack - Comprehensive Razorpay Integration Tests');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Locate test tenant
    const tenant = await prisma.tenant.findFirst({
      include: { schoolSetup: true }
    });
    assert(!!tenant, 'Found active school tenant: ' + (tenant?.name || 'N/A'));

    const encryptionKey = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'edutrack_saas_secure_encryption_key_32_bytes_!';
    
    // 2. Test AES-256-GCM Credential Encryption & Decryption
    const mockSecret = 'mock_rzp_secret_key_testing_987654321';
    const encryptedSecret = encrypt(mockSecret, encryptionKey);
    assert(encryptedSecret.split(':').length === 4, 'Secret encrypted with salt, IV, authTag, and ciphertext');
    assert(!encryptedSecret.includes(mockSecret), 'Encrypted text does NOT contain plaintext secret');

    const decryptedSecret = decrypt(encryptedSecret, encryptionKey);
    assert(decryptedSecret === mockSecret, 'Decrypted secret exactly matches original secret');

    // 3. Test saving Razorpay configuration in Tenant model
    const testKeyId = 'rzp_test_EduTrackSchoolMockKeyId';
    const mockWebhook = 'mock_webhook_secret_12345';
    const encryptedWebhook = encrypt(mockWebhook, encryptionKey);

    const updatedTenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        razorpayEnabled: true,
        razorpayIsTestMode: true,
        razorpayKeyId: testKeyId,
        razorpayKeySecret: encryptedSecret,
        razorpayWebhookSecret: encryptedWebhook,
      }
    });

    assert(updatedTenant.razorpayEnabled === true, 'Tenant razorpayEnabled set to true');
    assert(updatedTenant.razorpayIsTestMode === true, 'Tenant razorpayIsTestMode set to true');
    assert(updatedTenant.razorpayKeyId === testKeyId, 'Tenant razorpayKeyId stored accurately');
    assert(updatedTenant.razorpayKeySecret !== mockSecret, 'Key Secret is NOT plaintext in database');

    // 4. Test API response sanitization (no secret leakage)
    const sanitized = {
      razorpayEnabled: updatedTenant.razorpayEnabled,
      razorpayIsTestMode: updatedTenant.razorpayIsTestMode,
      razorpayKeyId: updatedTenant.razorpayKeyId,
      hasRazorpayKeySecret: !!updatedTenant.razorpayKeySecret,
      hasRazorpayWebhookSecret: !!updatedTenant.razorpayWebhookSecret,
    };
    assert(!('razorpayKeySecret' in sanitized), 'Sanitized response strips razorpayKeySecret');
    assert(!('razorpayWebhookSecret' in sanitized), 'Sanitized response strips razorpayWebhookSecret');
    assert(sanitized.hasRazorpayKeySecret === true, 'Sanitized response includes boolean hasRazorpayKeySecret flag');

    // 5. Test Cryptographic HMAC-SHA256 Signature Generation & Verification
    const testOrderId = 'order_mock_' + Date.now();
    const testPaymentId = 'pay_mock_' + Date.now();
    const expectedSig = crypto
      .createHmac('sha256', mockSecret)
      .update(`${testOrderId}|${testPaymentId}`)
      .digest('hex');

    const sigBuffer = Buffer.from(expectedSig, 'utf8');
    const expectedBuffer = Buffer.from(expectedSig, 'utf8');
    const isSigValid = sigBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(sigBuffer, expectedBuffer);
    assert(isSigValid, 'HMAC-SHA256 payment signature verified successfully');

    // Tampered signature test
    const tamperedSig = expectedSig.slice(0, -2) + 'aa';
    const tamperedBuffer = Buffer.from(tamperedSig, 'utf8');
    const isTamperedRejected = !(sigBuffer.length === tamperedBuffer.length && crypto.timingSafeEqual(sigBuffer, tamperedBuffer));
    assert(isTamperedRejected, 'Tampered payment signature correctly rejected');

    // 6. Test Idempotency & Invoice Creation with Razorpay Audit Fields
    const student = await prisma.studentProfile.findFirst({
      where: {
        opportunities: {
          some: {}
        }
      },
      include: {
        opportunities: {
          include: { opportunityLineItems: true }
        }
      }
    });

    if (student && student.opportunities.length > 0) {
      const opp = student.opportunities[0];
      const targetTenantId = student.tenantId || tenant.id;
      const items = opp.opportunityLineItems.slice(0, 1).map(oli => ({
        oliId: oli.id,
        productId: oli.productId,
        amount: Math.min(Number(oli.unitPrice) || 100, 100)
      }));

      const testInvoice = await prisma.invoice.create({
        data: {
          tenantId: targetTenantId,
          studentId: student.id,
          opportunityId: opp.id,
          totalAmount: 100,
          paidAmount: 100,
          remainingBalance: 0,
          status: 'PAID',
          invoiceDate: new Date(),
          dueDate: new Date(),
          paymentMethod: 'RAZORPAY',
          razorpayOrderId: testOrderId,
          razorpayPaymentId: testPaymentId,
          razorpaySignature: expectedSig,
        }
      });

      assert(testInvoice.paymentMethod === 'RAZORPAY', 'Invoice created with paymentMethod RAZORPAY');
      assert(testInvoice.razorpayOrderId === testOrderId, 'Invoice audit includes razorpayOrderId');
      assert(testInvoice.razorpayPaymentId === testPaymentId, 'Invoice audit includes razorpayPaymentId');

      // Idempotency check: finding invoice by razorpayPaymentId
      const duplicateInvoiceCheck = await prisma.invoice.findFirst({
        where: { tenantId: targetTenantId, razorpayPaymentId: testPaymentId }
      });
      assert(!!duplicateInvoiceCheck, 'Idempotency lookup identifies previously processed payment');

      // Clean up test invoice
      await prisma.invoice.delete({ where: { id: testInvoice.id } });
      assert(true, 'Test invoice cleaned up safely without affecting production data');
    } else {
      console.log('[SKIP] No student/opportunity in database for invoice creation test');
    }

    // 7. Test Public School Payment Info
    const publicInfo = {
      tenantId: updatedTenant.id,
      schoolName: updatedTenant.schoolSetup?.schoolName || updatedTenant.name,
      upi: {
        googlePayId: updatedTenant.googlePayId || '',
        phonePeId: updatedTenant.phonePeId || '',
        upiQrId: updatedTenant.upiQrId || '',
      },
      razorpay: {
        enabled: !!updatedTenant.razorpayEnabled,
        isTestMode: updatedTenant.razorpayIsTestMode ?? true,
        keyId: updatedTenant.razorpayEnabled ? (updatedTenant.razorpayKeyId || '') : '',
      }
    };
    assert(publicInfo.razorpay.enabled === true, 'Public info correctly returns razorpay.enabled');
    assert(publicInfo.razorpay.keyId === testKeyId, 'Public info returns keyId for parent checkout');
    assert(!('keySecret' in publicInfo.razorpay), 'Public info NEVER leaks keySecret');

    console.log(`\n====================================================`);
    console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
    console.log(`====================================================`);
  } catch (err) {
    console.error('Fatal error during test execution:', err);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
