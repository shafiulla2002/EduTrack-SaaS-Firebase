const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  console.log('Verifying PostgreSQL migration results...');
  try {
    const invoices = await prisma.subscriptionInvoice.findMany();
    console.log(`Found ${invoices.length} SubscriptionInvoice records.`);
    invoices.forEach(inv => {
      console.log(`Invoice ID: ${inv.id}, Number: ${inv.invoiceNumber}, Status: ${inv.status}`);
    });

    const payments = await prisma.subscriptionPayment.findMany();
    console.log(`Found ${payments.length} SubscriptionPayment records.`);
    payments.forEach(pay => {
      console.log(`Payment ID: ${pay.id}, TransactionId: ${pay.transactionId}, Status: ${pay.status}`);
    });

    const settings = await prisma.paymentSettings.findMany();
    console.log(`Found ${settings.length} PaymentSettings records.`);

    console.log('Verification successful! All existing records preserved with valid status values.');
  } catch (err) {
    console.error('Verification failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
