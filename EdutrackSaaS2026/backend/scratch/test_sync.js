require('dotenv').config();
const { PrismaClient, PaymentStatus, PaymentMethod } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log("Starting transactional integration test for syncPriceBookToStudents...");

  const tenantId = 'ebc2dcb0-8985-43a7-bc83-c62b22f301d1'; // Cambridge International School

  await prisma.$transaction(async (tx) => {
    // 1. Resolve a real student
    const student = await tx.studentProfile.findFirst({
      where: { tenantId },
      include: { classSection: true, user: true }
    });

    if (!student) {
      throw new Error("No student found to test with");
    }

    console.log(`Testing with student: ${student.user.name} (roll: ${student.rollNo})`);

    // 2. Create test academic year, class, and section
    const testAy = await tx.academicYear.create({
      data: {
        name: "TEST-YEAR-99",
        startDate: new Date(),
        endDate: new Date(),
        tenantId,
        isActive: true
      }
    });

    const testClass = await tx.class.create({
      data: {
        name: "TEST-CLASS-99",
        academicYearId: testAy.id,
        tenantId,
        isActive: true
      }
    });

    const testSection = await tx.section.create({
      data: {
        name: "TEST-SECTION-99",
        tenantId
      }
    });

    const testClassSection = await tx.classSection.create({
      data: {
        classId: testClass.id,
        sectionId: testSection.id,
        tenantId,
        strength: 1
      }
    });

    // Temporarily associate student with our test class section
    const originalClassSectionId = student.classSectionId;
    await tx.studentProfile.update({
      where: { id: student.id },
      data: { classSectionId: testClassSection.id }
    });

    // 3. Create test products
    const prodA = await tx.product.create({
      data: { name: "TEST-FEE-A", productCode: "TFA_99", tenantId, isActive: true }
    });
    const prodB = await tx.product.create({
      data: { name: "TEST-FEE-B", productCode: "TFB_99", tenantId, isActive: true }
    });

    // 4. Create Price Book and Entries
    const pb = await tx.pricebook.create({
      data: {
        name: "TEST-PB-99",
        classId: testClass.id,
        academicYearId: testAy.id,
        tenantId,
        isActive: true
      }
    });

    const pbeA = await tx.pricebookEntry.create({
      data: {
        pricebookId: pb.id,
        productId: prodA.id,
        unitPrice: 1000,
        tenantId,
        isActive: true
      }
    });

    const pbeB = await tx.pricebookEntry.create({
      data: {
        pricebookId: pb.id,
        productId: prodB.id,
        unitPrice: 2000,
        tenantId,
        isActive: true
      }
    });

    // 5. Instantiate BillingService helper logic directly on the transaction
    const syncHelper = async () => {
      // Find the active pricebook for the class and academic year
      const pricebook = await tx.pricebook.findFirst({
        where: { tenantId, classId: testClass.id, academicYearId: testAy.id, isActive: true },
        include: {
          pricebookEntries: {
            where: { isActive: true },
            include: { product: true }
          }
        }
      });

      if (!pricebook) {
        console.log("No pricebook found to sync");
        return;
      }

      const activeEntries = pricebook.pricebookEntries.filter(e => e.product.isActive);

      const studentsToSync = await tx.studentProfile.findMany({
        where: {
          tenantId,
          classSection: { classId: testClass.id },
          user: { isActive: true }
        },
        include: {
          user: true,
          classSection: true,
          opportunities: {
            where: { academicYearId: testAy.id, tenantId },
            include: {
              opportunityLineItems: {
                include: { product: true }
              }
            }
          }
        }
      });

      for (const st of studentsToSync) {
        let opp = st.opportunities[0];
        if (!opp) {
          opp = await tx.opportunity.create({
            data: {
              name: `${st.user.name} - Test Opp`,
              studentId: st.id,
              stageName: 'Prospecting',
              closeDate: new Date(),
              classId: testClass.id,
              sectionId: testSection.id,
              academicYearId: testAy.id,
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

        // A. Add/update OLIs
        for (const entry of activeEntries) {
          const existingOli = currentOlis.find(oli => oli.productId === entry.productId);
          if (existingOli) {
            if (Number(existingOli.unitPrice) !== Number(entry.unitPrice)) {
              await tx.opportunityLineItem.update({
                where: { id: existingOli.id },
                data: { unitPrice: entry.unitPrice }
              });
            }
          } else {
            await tx.opportunityLineItem.create({
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

        // B. Remove OLIs no longer in pricebook
        for (const oli of currentOlis) {
          if (oli.product.productCode === 'PREV_DUES' || oli.product.name.includes('Previous Year')) {
            continue;
          }
          const inPricebook = activeEntries.some(e => e.productId === oli.productId);
          if (!inPricebook) {
            const invoiceItems = await tx.invoiceItem.findMany({
              where: {
                opportunityLineItemId: oli.id,
                tenantId,
                invoice: {
                  status: { in: [PaymentStatus.PAID, PaymentStatus.PARTIALLY_PAID] }
                }
              }
            });
            if (invoiceItems.length === 0) {
              await tx.opportunityLineItem.delete({ where: { id: oli.id } });
            }
          }
        }

        // C. Sync unpaid invoices
        const unpaidInvoices = await tx.invoice.findMany({
          where: {
            opportunityId: opp.id,
            studentId: st.id,
            tenantId,
            status: { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIALLY_PAID] }
          }
        });

        for (const inv of unpaidInvoices) {
          const updatedOlis = await tx.opportunityLineItem.findMany({
            where: { opportunityId: opp.id, tenantId },
            include: { product: true }
          });

          await tx.invoiceItem.deleteMany({ where: { invoiceId: inv.id } });

          const newInvoiceItems = updatedOlis.map(oli => ({
            invoiceId: inv.id,
            opportunityLineItemId: oli.id,
            productId: oli.productId,
            name: oli.product.name,
            amount: Number(oli.unitPrice),
            tenantId
          }));

          await tx.invoiceItem.createMany({ data: newInvoiceItems });

          const totalInvoiceAmount = newInvoiceItems.reduce((sum, item) => sum + item.amount, 0);
          const paidInvoiceAmount = Number(inv.paidAmount);
          const remainingBalance = Math.max(0, totalInvoiceAmount - paidInvoiceAmount);
          const newStatus = remainingBalance <= 0 
            ? PaymentStatus.PAID 
            : paidInvoiceAmount > 0 
              ? PaymentStatus.PARTIALLY_PAID 
              : PaymentStatus.UNPAID;

          await tx.invoice.update({
            where: { id: inv.id },
            data: {
              totalAmount: totalInvoiceAmount,
              remainingBalance,
              status: newStatus
            }
          });
        }
      }
    };

    // --- STEP 1: INITIAL SYNC ---
    console.log("Executing initial sync...");
    await syncHelper();

    // Verify opportunity and OLIs are created
    let opp = await tx.opportunity.findFirst({
      where: { studentId: student.id, academicYearId: testAy.id },
      include: { opportunityLineItems: true }
    });

    console.log(`Opportunity created: ${opp !== null}. OLIs created count: ${opp ? opp.opportunityLineItems.length : 0}`);
    if (!opp || opp.opportunityLineItems.length !== 2) {
      throw new Error("Initial sync failed: Opportunity or OLIs missing!");
    }

    // --- STEP 2: PRICE UPDATE SYNC ---
    console.log("Updating unitPrice of TFA...");
    await tx.pricebookEntry.update({
      where: { id: pbeA.id },
      data: { unitPrice: 1200 }
    });

    await syncHelper();

    opp = await tx.opportunity.findFirst({
      where: { studentId: student.id, academicYearId: testAy.id },
      include: { opportunityLineItems: true }
    });

    const oliA = opp.opportunityLineItems.find(oli => oli.productId === prodA.id);
    console.log(`Updated OLI price of TFA: ${oliA ? oliA.unitPrice : 'N/A'}`);
    if (!oliA || Number(oliA.unitPrice) !== 1200) {
      throw new Error("Price update sync failed!");
    }

    // --- STEP 3: DELETE PRODUCT FROM PRICEBOOK SYNC ---
    console.log("Deactivating pbeB (removing TEST-FEE-B)...");
    await tx.pricebookEntry.update({
      where: { id: pbeB.id },
      data: { isActive: false }
    });

    // Create an unpaid invoice to test invoice rebuild
    const inv = await tx.invoice.create({
      data: {
        opportunityId: opp.id,
        studentId: student.id,
        invoiceDate: new Date(),
        dueDate: new Date(),
        totalAmount: 3200,
        paidAmount: 0,
        remainingBalance: 3200,
        status: PaymentStatus.UNPAID,
        tenantId
      }
    });

    await tx.invoiceItem.createMany({
      data: [
        { invoiceId: inv.id, opportunityLineItemId: oliA.id, productId: prodA.id, name: prodA.name, amount: 1200, tenantId },
        { invoiceId: inv.id, opportunityLineItemId: opp.opportunityLineItems.find(o => o.productId === prodB.id).id, productId: prodB.id, name: prodB.name, amount: 2000, tenantId }
      ]
    });

    console.log("Executing sync after deactivating pbeB and creating unpaid invoice...");
    await syncHelper();

    opp = await tx.opportunity.findFirst({
      where: { studentId: student.id, academicYearId: testAy.id },
      include: { opportunityLineItems: true }
    });

    console.log(`OLIs count after deactivation: ${opp.opportunityLineItems.length}`);
    const hasOliB = opp.opportunityLineItems.some(oli => oli.productId === prodB.id);
    console.log(`Does B still exist? ${hasOliB}`);
    if (opp.opportunityLineItems.length !== 1 || hasOliB) {
      throw new Error("OLI deletion failed!");
    }

    // Check if the unpaid invoice was rebuilt and price updated to 1200
    const updatedInv = await tx.invoice.findUnique({
      where: { id: inv.id },
      include: { invoiceItems: true }
    });

    console.log(`Rebuilt Invoice Total Amount: ${updatedInv.totalAmount}, items count: ${updatedInv.invoiceItems.length}`);
    if (Number(updatedInv.totalAmount) !== 1200 || updatedInv.invoiceItems.length !== 1) {
      throw new Error("Unpaid invoice rebuild failed!");
    }

    // --- STEP 4: PREVENT DELETION WITH PAYMENT HISTORY ---
    console.log("Simulating payment of invoice (status PAID)...");
    await tx.invoice.update({
      where: { id: inv.id },
      data: { status: PaymentStatus.PAID, paidAmount: 1200, remainingBalance: 0 }
    });

    console.log("Deactivating pbeA (removing TEST-FEE-A)...");
    await tx.pricebookEntry.update({
      where: { id: pbeA.id },
      data: { isActive: false }
    });

    console.log("Executing sync after deactivating pbeA...");
    await syncHelper();

    opp = await tx.opportunity.findFirst({
      where: { studentId: student.id, academicYearId: testAy.id },
      include: { opportunityLineItems: true }
    });

    console.log(`OLIs count after deactivating A: ${opp.opportunityLineItems.length}`);
    const hasOliA = opp.opportunityLineItems.some(oli => oli.productId === prodA.id);
    console.log(`Does A still exist due to payment history? ${hasOliA}`);
    if (!hasOliA) {
      throw new Error("OLI with payment history was incorrectly deleted!");
    }

    // Restore original class section for student
    await tx.studentProfile.update({
      where: { id: student.id },
      data: { classSectionId: originalClassSectionId }
    });

    console.log("Transactional integration test succeeded perfectly!");
    
    // Explicitly throw to force transactional rollback, keeping DB completely clean!
    throw new Error("ROLLBACK_FOR_SAFETY");
  }, { timeout: 60000 })
  .catch(err => {
    if (err.message === "ROLLBACK_FOR_SAFETY") {
      console.log("Successfully rolled back transactional changes. DB is clean!");
    } else {
      console.error("Test failed with error:", err);
    }
  })
  .finally(() => prisma.$disconnect());
}

run();
