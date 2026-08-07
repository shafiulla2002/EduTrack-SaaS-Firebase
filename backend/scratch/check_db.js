const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('--- RUNNING AGGREGATIONS FOR CAMBRIDGE INTERNATIONAL ---');
  try {
    const tenantId = 'ebc2dcb0-8985-43a7-bc83-c62b22f301d1';
    
    // 1. Fetch active academic year
    const activeYear = await prisma.academicYear.findFirst({
      where: { tenantId, isActive: true },
    });
    console.log('Active Academic Year:', activeYear);

    // Build Invoices query filter
    const invoiceWhere = {
      tenantId,
      status: { not: 'VOIDED' },
    };
    if (activeYear) {
      invoiceWhere.invoiceDate = { gte: activeYear.startDate, lte: activeYear.endDate };
    }

    const filteredInvoices = await prisma.invoice.findMany({
      where: invoiceWhere,
    });
    console.log(`Filtered Invoices count: ${filteredInvoices.length}`);
    console.log(`Filtered Invoices total paidAmount:`, filteredInvoices.reduce((sum, i) => sum + Number(i.paidAmount), 0));

    const allTimeInvoices = await prisma.invoice.findMany({
      where: { tenantId, status: { not: 'VOIDED' } }
    });
    console.log(`All-time Invoices count: ${allTimeInvoices.length}`);
    console.log(`All-time Invoices total paidAmount:`, allTimeInvoices.reduce((sum, i) => sum + Number(i.paidAmount), 0));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
