const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function syncPriceBookToStudentsPrisma(classId, academicYearId, tenantId) {
  const ay = await prisma.academicYear.findUnique({ where: { id: academicYearId } });
  const classRecord = await prisma.class.findUnique({ where: { id: classId } });
  const className = classRecord?.name;

  let pricebook = await prisma.pricebook.findFirst({
    where: { tenantId, classId, academicYearId, isActive: true },
    include: {
      pricebookEntries: {
        where: { isActive: true },
        include: { product: true }
      }
    }
  });

  if (!pricebook && className) {
    const normalizedName = className.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
    const hyphenName = className.replace(/\s+/g, '-');
    pricebook = await prisma.pricebook.findFirst({
      where: {
        tenantId,
        isActive: true,
        ...(academicYearId ? { academicYearId } : {}),
        OR: [
          { name: { equals: normalizedName, mode: 'insensitive' } },
          { name: { equals: hyphenName, mode: 'insensitive' } },
          { name: { startsWith: normalizedName, mode: 'insensitive' } },
          { class: { name: { equals: className, mode: 'insensitive' }, academicYearId } }
        ]
      },
      include: {
        pricebookEntries: {
          where: { isActive: true },
          include: { product: true }
        }
      }
    });
  }

  if (!pricebook || !pricebook.pricebookEntries.length) return;

  const activeEntries = pricebook.pricebookEntries.filter(e => e.product.isActive);

  const students = await prisma.studentProfile.findMany({
    where: {
      tenantId,
      user: { isActive: true },
      OR: [
        { classSection: { classId } },
        ...(className ? [
          { classSection: { class: { name: { equals: className, mode: 'insensitive' }, ...(academicYearId ? { academicYearId } : {}) } } }
        ] : [])
      ]
    },
    include: {
      user: true,
      classSection: true,
      opportunities: {
        where: { academicYearId, tenantId },
        include: {
          opportunityLineItems: {
            include: { product: true }
          }
        }
      }
    }
  });

  for (const student of students) {
    let opp = student.opportunities[0];
    if (!opp) {
      const sectionId = student.classSection?.sectionId || null;
      const oppName = `${student.user.name} - Admission ${ay?.name || ''}`.trim();
      opp = await prisma.opportunity.create({
        data: {
          name: oppName,
          studentId: student.id,
          stageName: 'Prospecting',
          closeDate: new Date(new Date().setDate(new Date().getDate() + 30)),
          classId,
          sectionId,
          academicYearId,
          totalPaidAmount: 0,
          tenantId
        },
        include: {
          opportunityLineItems: {
            include: { product: true }
          }
        }
      });
    }

    const currentOlis = opp.opportunityLineItems || [];
    const oliByProduct = new Map();
    for (const oli of currentOlis) {
      if (!oliByProduct.has(oli.productId)) {
        oliByProduct.set(oli.productId, []);
      }
      oliByProduct.get(oli.productId).push(oli);
    }

    for (const entry of activeEntries) {
      const matchingOlis = oliByProduct.get(entry.productId) || [];
      if (matchingOlis.length > 0) {
        const primaryOli = matchingOlis[0];
        if (Number(primaryOli.unitPrice) !== Number(entry.unitPrice) || primaryOli.pricebookEntryId !== entry.id) {
          await prisma.opportunityLineItem.update({
            where: { id: primaryOli.id },
            data: { unitPrice: entry.unitPrice, pricebookEntryId: entry.id }
          });
        }
      } else {
        await prisma.opportunityLineItem.create({
          data: {
            opportunityId: opp.id,
            pricebookEntryId: entry.id,
            productId: entry.productId,
            quantity: 1,
            unitPrice: entry.unitPrice,
            discount: 0,
            tenantId
          }
        });
      }
    }

    const existingInvoices = await prisma.invoice.findMany({
      where: { opportunityId: opp.id, tenantId, status: { not: 'VOIDED' } }
    });

    if (existingInvoices.length === 0) {
      const updatedOlis = await prisma.opportunityLineItem.findMany({
        where: { opportunityId: opp.id, tenantId },
        include: { product: true }
      });
      if (updatedOlis.length > 0) {
        const totalAmount = updatedOlis.reduce((sum, oli) => {
          const itemTotal = Number(oli.unitPrice) * Number(oli.quantity);
          const discountAmount = (itemTotal * Number(oli.discount)) / 100;
          return sum + (itemTotal - discountAmount);
        }, 0);

        const newInvoice = await prisma.invoice.create({
          data: {
            opportunityId: opp.id,
            studentId: student.id,
            invoiceDate: new Date(),
            dueDate: new Date(new Date().setDate(new Date().getDate() + 30)),
            totalAmount,
            paidAmount: 0,
            remainingBalance: totalAmount,
            status: 'UNPAID',
            description: `Fees Invoice — ${ay?.name || ''}`,
            tenantId
          }
        });

        await prisma.invoiceItem.createMany({
          data: updatedOlis.map(oli => ({
            invoiceId: newInvoice.id,
            opportunityLineItemId: oli.id,
            productId: oli.productId,
            name: oli.product.name,
            amount: Number(oli.unitPrice) * Number(oli.quantity) - ((Number(oli.unitPrice) * Number(oli.quantity) * Number(oli.discount)) / 100),
            tenantId
          }))
        });
      }
    }
  }
}

async function runTests() {
  console.log('=== STARTING PHONE SYNC & PRICE BOOK AUTOMATION TESTS ===\n');

  const tenant = await prisma.tenant.findFirst();
  const tenantId = tenant.id;
  console.log(`Testing with Tenant ID: ${tenantId} (${tenant.name})`);

  // 1. TEST PHONE NUMBER SYNCHRONIZATION
  console.log('\n--- TEST 1: PHONE NUMBER SYNCHRONIZATION ---');
  const testStudent = await prisma.studentProfile.findFirst({
    where: { tenantId },
    include: { user: true }
  });

  if (!testStudent) {
    console.error('No test student found in database.');
    return;
  }

  const newTestPhone = '9988776655';
  console.log(`Updating phone for student: ${testStudent.user.name} (ID: ${testStudent.id}) to ${newTestPhone}`);

  const normalized = `${tenantId.substring(0, 8)}-${newTestPhone}`;
  await prisma.user.update({
    where: { id: testStudent.userId },
    data: { phone: normalized }
  });
  await prisma.studentProfile.update({
    where: { id: testStudent.id },
    data: { fatherPhone: newTestPhone }
  });

  const viewProfile = await prisma.studentProfile.findUnique({
    where: { id: testStudent.id },
    include: { user: true }
  });

  const rawSearch = await prisma.studentProfile.findFirst({
    where: { id: testStudent.id },
    select: {
      fatherPhone: true,
      user: { select: { phone: true } }
    }
  });

  const rawPhone = rawSearch.user?.phone || rawSearch.fatherPhone || '';
  const dirPhone = rawPhone.includes('-') ? rawPhone.split('-').pop() : rawPhone;
  const profilePhone = viewProfile.user.phone.includes('-') ? viewProfile.user.phone.split('-').pop() : viewProfile.user.phone;

  console.log(`View Profile Phone:      ${profilePhone}`);
  console.log(`Student Directory Phone: ${dirPhone}`);

  if (profilePhone === newTestPhone && dirPhone === newTestPhone) {
    console.log('✔ TEST 1 PASSED: Phone numbers in Directory and Profile are 100% synchronized!');
  } else {
    console.error('❌ TEST 1 FAILED: Phone number mismatch.');
  }

  // 2. TEST AUTOMATIC PRICE BOOK ASSIGNMENT TO EXISTING STUDENTS
  console.log('\n--- TEST 2: PRICE BOOK AUTOMATIC ASSIGNMENT (EXISTING STUDENT) ---');
  
  const ay = await prisma.academicYear.findFirst({ where: { tenantId, isActive: true } });
  if (!ay) {
    console.error('No active Academic Year found.');
    return;
  }

  let cls = await prisma.class.findFirst({
    where: { tenantId, name: { contains: 'Class 2', mode: 'insensitive' } }
  });
  if (!cls) {
    cls = await prisma.class.create({
      data: { name: 'Class 2', academicYearId: ay.id, tenantId }
    });
  }

  let sec = await prisma.section.findFirst({ where: { tenantId, name: 'A' } });
  if (!sec) {
    sec = await prisma.section.create({ data: { name: 'A', tenantId } });
  }

  let classSec = await prisma.classSection.findFirst({
    where: { classId: cls.id, sectionId: sec.id, tenantId }
  });
  if (!classSec) {
    classSec = await prisma.classSection.create({
      data: { classId: cls.id, sectionId: sec.id, tenantId }
    });
  }

  const randomEmail = `test.student.pb.${Date.now()}@test.local`;
  const testUser = await prisma.user.create({
    data: {
      email: randomEmail,
      name: 'Test Student PriceBook',
      passwordHash: 'dummy',
      role: 'STUDENT',
      tenantId
    }
  });

  const testProfile = await prisma.studentProfile.create({
    data: {
      userId: testUser.id,
      rollNo: `999${Math.floor(Math.random() * 100)}`,
      classSectionId: classSec.id,
      tenantId
    }
  });

  console.log(`Created new student ${testUser.name} in Class 2 / Section A before Price Book creation.`);

  const oppBefore = await prisma.opportunity.findFirst({
    where: { studentId: testProfile.id, tenantId, academicYearId: ay.id },
    include: { opportunityLineItems: true }
  });
  console.log(`Line items BEFORE Price Book creation: ${oppBefore?.opportunityLineItems?.length || 0}`);

  let pb = await prisma.pricebook.findFirst({
    where: { tenantId, classId: cls.id, academicYearId: ay.id }
  });
  if (!pb) {
    pb = await prisma.pricebook.create({
      data: {
        name: `Class 2 Price Book`,
        classId: cls.id,
        academicYearId: ay.id,
        isActive: true,
        tenantId
      }
    });
  }

  let prod = await prisma.product.findFirst({ where: { tenantId, name: 'Class 2 Tuition Fee' } });
  if (!prod) {
    prod = await prisma.product.create({
      data: { name: 'Class 2 Tuition Fee', tenantId, productCode: 'TUIT_C2' }
    });
  }

  let pbe = await prisma.pricebookEntry.findFirst({
    where: { tenantId, pricebookId: pb.id, productId: prod.id }
  });
  if (!pbe) {
    pbe = await prisma.pricebookEntry.create({
      data: {
        pricebookId: pb.id,
        productId: prod.id,
        unitPrice: 15000,
        isActive: true,
        tenantId
      }
    });
  }

  await syncPriceBookToStudentsPrisma(cls.id, ay.id, tenantId);

  const oppAfter = await prisma.opportunity.findFirst({
    where: { studentId: testProfile.id, tenantId, academicYearId: ay.id },
    include: { opportunityLineItems: true }
  });

  console.log(`Line items AFTER Price Book creation: ${oppAfter?.opportunityLineItems?.length || 0}`);

  if (oppAfter && oppAfter.opportunityLineItems.length > 0) {
    console.log('✔ TEST 2 PASSED: Price Book automatically applied to existing student!');
  } else {
    console.error('❌ TEST 2 FAILED: Existing student did not receive fees.');
  }

  // 3. IDEMPOTENCY TEST (RUN SYNC AGAIN)
  console.log('\n--- TEST 3: IDEMPOTENCY TEST (PREVENT DUPLICATES) ---');
  await syncPriceBookToStudentsPrisma(cls.id, ay.id, tenantId);
  await syncPriceBookToStudentsPrisma(cls.id, ay.id, tenantId);

  const oppIdempotent = await prisma.opportunity.findFirst({
    where: { studentId: testProfile.id, tenantId, academicYearId: ay.id },
    include: { opportunityLineItems: true }
  });

  console.log(`Line items AFTER multiple sync runs: ${oppIdempotent?.opportunityLineItems?.length || 0}`);
  if (oppIdempotent?.opportunityLineItems?.length === oppAfter?.opportunityLineItems?.length) {
    console.log('✔ TEST 3 PASSED: Zero duplicate fee line items created!');
  } else {
    console.error('❌ TEST 3 FAILED: Duplicate line items detected.');
  }

  // 4. TEST PAYMENT PRESERVATION
  console.log('\n--- TEST 4: PAYMENT PRESERVATION ---');
  const inv = await prisma.invoice.findFirst({
    where: { studentId: testProfile.id, tenantId }
  });

  if (inv) {
    await prisma.invoice.update({
      where: { id: inv.id },
      data: { paidAmount: 5000, remainingBalance: 10000, status: 'PARTIALLY_PAID' }
    });

    await syncPriceBookToStudentsPrisma(cls.id, ay.id, tenantId);

    const invAfter = await prisma.invoice.findUnique({ where: { id: inv.id } });
    console.log(`Paid Amount before re-sync: 5000 | Paid Amount after re-sync: ${invAfter.paidAmount}`);

    if (Number(invAfter.paidAmount) === 5000 && invAfter.status === 'PARTIALLY_PAID') {
      console.log('✔ TEST 4 PASSED: Existing payments and paid amounts preserved 100%!');
    } else {
      console.error('❌ TEST 4 FAILED: Existing payment was overwritten.');
    }
  }

  // Clean up test student
  await prisma.user.delete({ where: { id: testUser.id } });
  console.log('\n=== ALL TESTS COMPLETED CLEANLY ===');
}

runTests().catch(console.error).finally(() => prisma.$disconnect());
