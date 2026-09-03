import { Injectable, BadRequestException, NotFoundException, ConflictException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TenantContext } from '../tenants/tenant.context';
import { PaymentStatus, PaymentMethod, Role, ExpenseStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { StorageService } from '../common/storage.service';

@Injectable()
export class BillingService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
  ) {}

  private getTenantId(): string {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No active school tenant context found');
    }
    return tenantId;
  }

  // Public accessor so controller can capture tenantId within request scope for async calls
  getTenantIdPublic(): string {
    return this.getTenantId();
  }

  // ── OPPORTUNITY SERVICE LOGIC (Centralized trigger logic from Apex) ─────────

  async recalculatePaidAmount(oppId: string, tx?: any): Promise<number> {
    const tenantId = this.getTenantId();
    const db = tx || this.prisma;

    // Fetch all non-cancelled (not VOIDED) invoice items for this opportunity
    const invoiceItems = await db.invoiceItem.findMany({
      where: {
        tenantId,
        invoice: {
          opportunityId: oppId,
          status: { not: PaymentStatus.VOIDED },
        },
      },
    });

    const totalPaid = invoiceItems.reduce((sum, item) => sum + Number(item.amount), 0);

    await db.opportunity.update({
      where: { id: oppId },
      data: {
        totalPaidAmount: totalPaid,
      },
    });

    return totalPaid;
  }

  // ── ACTIVE PRODUCTS (Pricebook Entries) ────────────────────────────────────

  async getActiveProducts(classId: string, academicYearId?: string) {
    const tenantId = this.getTenantId();

    if (!classId) {
      return [];
    }

    // Get the class record so we know the class name for fallback lookups
    const classRecord = await this.prisma.class.findFirst({
      where: { id: classId, tenantId },
    });
    const className = classRecord?.name || '';

    let classPriceBook: any = null;

    // ── TIER 1: Exact match by classId + academicYearId ─────────────────────
    if (academicYearId) {
      classPriceBook = await this.prisma.pricebook.findFirst({
        where: { tenantId, classId, academicYearId, isActive: true },
      });
    } else {
      classPriceBook = await this.prisma.pricebook.findFirst({
        where: { tenantId, classId, isActive: true },
        orderBy: { academicYearId: 'desc' },
      });
    }

    // ── TIER 2: Find pricebook for same class name in the same academic year ─
    // This handles the case where promotion created a NEW class entity (different ID)
    // but the pricebook was linked to an OLDER class entity with the same name.
    if (!classPriceBook && className && academicYearId) {
      // Find all classes with the same name in the target academic year
      const siblingsClasses = await this.prisma.class.findMany({
        where: {
          tenantId,
          name: { equals: className, mode: 'insensitive' },
          isActive: true,
        },
        select: { id: true },
      });
      const siblingIds = siblingsClasses.map(c => c.id).filter(id => id !== classId);

      if (siblingIds.length > 0) {
        // Look for a pricebook linked to any of these classes for this academic year
        classPriceBook = await this.prisma.pricebook.findFirst({
          where: {
            tenantId,
            classId: { in: siblingIds },
            academicYearId,
            isActive: true,
          },
        });
      }
    }

    // ── TIER 3: Name-based pricebook lookup ──────────────────────────────────
    // As a last resort, find pricebooks whose name contains the class name
    if (!classPriceBook && className) {
      const normalizedName = className.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
      const hyphenName = className.replace(/\s+/g, '-');

      classPriceBook = await this.prisma.pricebook.findFirst({
        where: {
          tenantId,
          isActive: true,
          ...(academicYearId ? { academicYearId } : {}),
          OR: [
            { name: { startsWith: normalizedName, mode: 'insensitive' } },
            { name: { startsWith: hyphenName, mode: 'insensitive' } },
            { name: { equals: normalizedName, mode: 'insensitive' } },
            { name: { equals: hyphenName, mode: 'insensitive' } },
          ],
        },
        orderBy: { academicYearId: 'desc' },
      });
    }

    if (!classPriceBook) {
      return [];
    }

    const entries = await this.prisma.pricebookEntry.findMany({
      where: {
        tenantId,
        isActive: true,
        pricebookId: classPriceBook.id,
        pricebook: { isActive: true },
        product: {
          isActive: true,
          productCode: { not: 'PREV_DUES' },
          name: { not: { contains: 'Previous' } },
        },
      },
      include: {
        product: true,
      },
      orderBy: { product: { name: 'asc' } },
      take: 1000,
    });

    return (entries as any[]).map(entry => ({
      id: entry.id,
      product2Id: entry.productId,
      productName: entry.product.name,
      productDescription: entry.product.description || '',
      unitPrice: Number(entry.unitPrice),
      pricebook2Id: entry.pricebookId,
    }));
  }

  // ── CREATE ADMISSION (Opportunities & Concessions) ─────────────────────────

  async createAdmission(studentData: any, selectedPricebookEntryIds: string[], concessionAmount: number) {
    const tenantId = this.getTenantId();



    // ── Email handling: generate a unique fallback if no email provided ──────
    let emailLower: string;
    if (studentData.email && studentData.email.trim()) {
      emailLower = studentData.email.toLowerCase().trim();
    } else {
      // Generate a unique, tenant-scoped email so no crash on empty email
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const firstName = (studentData.firstName || 'student').toLowerCase().replace(/\s+/g, '');
      const lastName = (studentData.lastName || '').toLowerCase().replace(/\s+/g, '');
      emailLower = `${firstName}${lastName ? '.' + lastName : ''}.${randomSuffix}@noemail.local`;
    }

    // ── Email uniqueness check (globally unique field in DB) ────────────────
    const existingUser = await this.prisma.user.findUnique({
      where: { email: emailLower },
    });
    if (existingUser) {
      throw new ConflictException('A user with this email is already registered in the system');
    }

    const defaultPassword = studentData.password || 'Welcome@123';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    // ── Phone: make globally unique by prefixing with short tenantId ─────────
    // This allows the same phone number to exist across different schools.
    let normalizedPhone: string | null = null;
    if (studentData.phone && studentData.phone.trim()) {
      const digitsOnly = studentData.phone.replace(/\D/g, '').slice(-10);
      if (digitsOnly.length >= 10) {
        // Store as tenantId[:8]-phone to avoid cross-tenant unique constraint violations
        normalizedPhone = `${tenantId.substring(0, 8)}-${digitsOnly}`;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // Resolve classSection
      let classSectionId = null;
      if (studentData.selectedClass && studentData.selectedSection) {
        let classSec = await tx.classSection.findFirst({
          where: {
            classId: studentData.selectedClass,
            sectionId: studentData.selectedSection,
            tenantId,
          },
        });
        if (!classSec) {
          classSec = await tx.classSection.create({
            data: {
              classId: studentData.selectedClass,
              sectionId: studentData.selectedSection,
              tenantId,
              strength: 0,
            },
          });
        }
        if (classSec) {
          classSectionId = classSec.id;
        }
      }

      // Create student user
      const user = await tx.user.create({
        data: {
          email: emailLower,
          name: `${studentData.firstName} ${studentData.lastName}`,
          passwordHash,
          role: Role.STUDENT,
          phone: normalizedPhone,
          tenantId,
        },
      });

      // Auto-generate roll number if not provided
      let finalRollNo = studentData.rollNo ? String(studentData.rollNo).trim() : '';
      if (classSectionId) {
        const existingStudents = await tx.studentProfile.findMany({
          where: { classSectionId, tenantId },
          select: { rollNo: true }
        });
        const rollNumbersSet = new Set(existingStudents.map(s => s.rollNo?.trim()).filter(Boolean));

        if (!finalRollNo || rollNumbersSet.has(finalRollNo)) {
          const parsedInts = existingStudents
            .map(s => parseInt(s.rollNo || '', 10))
            .filter(val => !isNaN(val));
          const nextRoll = parsedInts.length > 0 ? Math.max(...parsedInts) + 1 : 1;
          finalRollNo = String(nextRoll);
        }
      }

      let profilePhotoUrl: string | null = null;
      if (studentData.profilePhotoUrl && studentData.profilePhotoUrl.startsWith('data:')) {
        profilePhotoUrl = await this.storageService.uploadImage(studentData.profilePhotoUrl, tenantId, user.id, `student-${user.id}`);
      }

      // Create student profile
      const profile = await tx.studentProfile.create({
        data: {
          userId: user.id,
          rollNo: finalRollNo || null,
          fatherName: studentData.fatherName || null,
          motherName: studentData.motherName || null,
          aadharNo: studentData.aadharNo || null,
          classSectionId,
          profilePhotoUrl,
          tenantId,
        },
      });

      let academicYearName = '';
      if (studentData.academicYear) {
        const ay = await tx.academicYear.findUnique({
          where: { id: studentData.academicYear },
        });
        if (ay) academicYearName = ay.name;
      }

      // Create Opportunity (Admissions Opportunity)
      const opp = await tx.opportunity.create({
        data: {
          name: `${studentData.firstName} ${studentData.lastName} - Admission ${academicYearName}`.trim(),
          studentId: profile.id,
          stageName: 'Prospecting',
          closeDate: new Date(new Date().setDate(new Date().getDate() + 30)),
          classId: studentData.selectedClass || null,
          sectionId: studentData.selectedSection || null,
          academicYearId: studentData.academicYear || null,
          totalPaidAmount: 0,
          tenantId,
        },
      });

      if (selectedPricebookEntryIds && selectedPricebookEntryIds.length > 0) {
        // Fetch pricebook entries
        const pbes = await tx.pricebookEntry.findMany({
          where: {
            id: { in: selectedPricebookEntryIds },
            tenantId,
          },
        });

        const totalAmount = pbes.reduce((sum, pbe) => sum + Number(pbe.unitPrice), 0);

        let discountPercent = 0;
        if (totalAmount > 0 && concessionAmount > 0) {
          discountPercent = (concessionAmount / totalAmount) * 100;
          if (discountPercent > 100) {
            discountPercent = 100;
          }
        }

        const olis = pbes.map(pbe => ({
          opportunityId: opp.id,
          pricebookEntryId: pbe.id,
          productId: pbe.productId,
          quantity: 1,
          unitPrice: pbe.unitPrice,
          discount: discountPercent,
          tenantId,
        }));

        await tx.opportunityLineItem.createMany({
          data: olis,
        });
      }

      return {
        success: true,
        opportunityId: opp.id,
        accountId: profile.id,
      };
    }, { timeout: 90000 });
  }

  // ── OPTIONS RETRIEVAL ──────────────────────────────────────────────────────

  async getAcademicYearOptions() {
    const tenantId = this.getTenantId();
    const ays = await this.prisma.academicYear.findMany({
      where: { tenantId, isActive: true },
      orderBy: { startDate: 'asc' },
    });
    return ays.map(ay => ({ label: ay.name, value: ay.id }));
  }

  async getClassOptions() {
    const tenantId = this.getTenantId();
    const classes = await this.prisma.class.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });
    return classes.map(c => ({ label: c.name, value: c.id }));
  }

  async getSectionOptions(classId?: string) {
    const tenantId = this.getTenantId();
    const sections = await this.prisma.section.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });
    return sections.map(s => ({ label: s.name, value: s.id }));
  }

  // ── STUDENT SEARCH WITH PENDING BALANCE CALCULATIONS ─────────────────────────

  // ── STUDENT SEARCH WITH PENDING BALANCE CALCULATIONS ─────────────────────────

  async searchStudents(searchTerm: string) {
    const tenantId = this.getTenantId();

    const students = await this.prisma.studentProfile.findMany({
      where: {
        user: {
          tenantId,
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { phone: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
      },
      include: {
        user: true,
        classSection: {
          include: {
            class: true,
            section: true,
          },
        },
        opportunities: {
          where: {
            stageName: { notIn: ['Closed Won', 'Closed Lost'] }, // Opportunity is open
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            opportunityLineItems: {
              include: { product: true }
            },
            invoices: {
              where: {
                tenantId,
                status: { not: PaymentStatus.VOIDED }
              },
              include: { invoiceItems: true }
            }
          }
        },
      },
      take: 20,
    });

    const studentIds = students.map(s => s.id);
    const unpaidInvoices = await this.prisma.invoice.findMany({
      where: {
        studentId: { in: studentIds },
        tenantId,
        status: { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIALLY_PAID] }
      },
      include: {
        opportunity: {
          include: {
            academicYear: true
          }
        }
      }
    });

    const results = [];
    for (const student of students) {
      const openOpp = student.opportunities[0];
      let totalFee = 0;
      let totalPaid = 0;

      if (openOpp) {
        totalFee = openOpp.opportunityLineItems.reduce((sum, oli) => {
          const itemTotal = Number(oli.unitPrice) * Number(oli.quantity);
          const itemDiscount = (itemTotal * Number(oli.discount)) / 100;
          return sum + (itemTotal - itemDiscount);
        }, 0);

        totalPaid = openOpp.invoices.reduce((sum, inv) => sum + Number(inv.paidAmount), 0);
      }

      // Calculate previous years unpaid balances
      let currentYearStart = new Date(0);
      if (openOpp && openOpp.academicYearId) {
        const cy = await this.prisma.academicYear.findFirst({
          where: { id: openOpp.academicYearId, tenantId }
        });
        if (cy) currentYearStart = cy.startDate;
      }

      const studentPrevUnpaid = unpaidInvoices.filter(inv => {
        if (inv.studentId !== student.id) return false;
        if (inv.opportunity?.academicYearId) {
          if (inv.opportunity.academicYearId === openOpp?.academicYearId) return false;
          return new Date(inv.opportunity.academicYear.startDate) < currentYearStart;
        }
        return new Date(inv.invoiceDate) < currentYearStart;
      });

      const totalPreviousYearDue = studentPrevUnpaid.reduce((sum, inv) => sum + Number(inv.remainingBalance), 0);

      results.push({
        account: {
          id: student.id,
          name: student.user.name,
          rollNo: student.rollNo,
          phone: student.user.phone,
          profilePhotoUrl: student.profilePhotoUrl,
          class: student.classSection?.class.name || '',
          section: student.classSection?.section.name || '',
          classId: student.classSection?.classId || '',
          sectionId: student.classSection?.sectionId || '',
          opportunities: openOpp ? [{ id: openOpp.id, academicYearId: openOpp.academicYearId }] : [],
        },
        totalPendingBalance: Math.max(0, totalFee - totalPaid) + totalPreviousYearDue,
        totalPaidAmount: totalPaid,
      });
    }

    return results;
  }

  async getStudentById(studentId: string, academicYearId?: string) {
    const tenantId = this.getTenantId();

    let oppFilter: any = {
      tenantId,
    };
    if (academicYearId) {
      oppFilter.academicYearId = academicYearId;
    } else {
      oppFilter.stageName = { notIn: ['Closed Won', 'Closed Lost'] };
    }

    const student = await this.prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: {
        user: true,
        classSection: {
          include: {
            class: true,
            section: true,
          },
        },
        opportunities: {
          where: oppFilter,
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            academicYear: true,
            opportunityLineItems: {
              include: { product: true }
            },
            invoices: {
              where: {
                tenantId,
                status: { not: PaymentStatus.VOIDED }
              },
              include: { invoiceItems: true }
            }
          }
        },
      },
    });

    if (!student || student.user.tenantId !== tenantId) {
      throw new NotFoundException('Student not found.');
    }

    // Fallback if no active opportunity matches the filter
    let openOpp = student.opportunities[0];
    if (!openOpp && !academicYearId) {
      // Fallback to the latest opportunity overall
      const latestOpp = await this.prisma.opportunity.findFirst({
        where: { studentId, tenantId },
        orderBy: { createdAt: 'desc' },
        include: {
          academicYear: true,
          opportunityLineItems: {
            include: { product: true }
          },
          invoices: {
            where: {
              tenantId,
              status: { not: PaymentStatus.VOIDED }
            },
            include: { invoiceItems: true }
          }
        }
      });
      if (latestOpp) {
        openOpp = latestOpp;
      }
    }

    let totalFee = 0;
    let totalPaid = 0;

    if (openOpp) {
      totalFee = openOpp.opportunityLineItems.reduce((sum, oli) => {
        const itemTotal = Number(oli.unitPrice) * Number(oli.quantity);
        const itemDiscount = (itemTotal * Number(oli.discount)) / 100;
        return sum + (itemTotal - itemDiscount);
      }, 0);

      totalPaid = openOpp.invoices.reduce((sum, inv) => sum + Number(inv.paidAmount), 0);

      // ── FALLBACK: If the opportunity has no line items (e.g. promotion without a matching pricebook),
      //    compute the fee total from the class pricebook so the summary cards show correct numbers.
      if (totalFee === 0 && openOpp.classId) {
        const pricebookProducts = await this.getActiveProducts(
          openOpp.classId,
          openOpp.academicYearId || undefined,
        );
        totalFee = pricebookProducts.reduce((sum, p) => sum + p.unitPrice, 0);
      }
    }


    // Determine currentYearStart for previous years calculation
    let currentYearStart = new Date(0);
    if (academicYearId) {
      const cy = await this.prisma.academicYear.findUnique({
        where: { id: academicYearId }
      });
      if (cy) {
        currentYearStart = cy.startDate;
      }
    } else if (openOpp && openOpp.academicYear) {
      currentYearStart = openOpp.academicYear.startDate;
    }

    // Retrieve all opportunities starting BEFORE currentYearStart
    const prevOpps = await this.prisma.opportunity.findMany({
      where: {
        studentId,
        tenantId,
        academicYear: {
          startDate: {
            lt: currentYearStart
          }
        }
      },
      include: {
        academicYear: true,
        opportunityLineItems: true,
        invoices: {
          where: {
            tenantId,
            status: { not: PaymentStatus.VOIDED }
          }
        }
      }
    });

    const prevYearDuesMap = new Map<string, number>();

    // 1. Calculate dues from preceding opportunities
    for (const opp of prevOpps) {
      const yearName = opp.academicYear?.name || 'Previous Years';
      const oppFee = opp.opportunityLineItems.reduce((sum, oli) => {
        const itemTotal = Number(oli.unitPrice) * Number(oli.quantity);
        const itemDiscount = (itemTotal * Number(oli.discount)) / 100;
        return sum + (itemTotal - itemDiscount);
      }, 0);
      const oppPaid = opp.invoices.reduce((sum, inv) => sum + Number(inv.paidAmount), 0);
      const balance = Math.max(0, oppFee - oppPaid);
      if (balance > 0) {
        prevYearDuesMap.set(yearName, (prevYearDuesMap.get(yearName) || 0) + balance);
      }
    }

    // 2. Retrieve standalone invoices starting BEFORE currentYearStart (where opportunityId === null)
    const prevOrphanInvoices = await this.prisma.invoice.findMany({
      where: {
        studentId,
        tenantId,
        opportunityId: null,
        invoiceDate: {
          lt: currentYearStart
        },
        status: {
          in: [PaymentStatus.UNPAID, PaymentStatus.PARTIALLY_PAID]
        }
      }
    });

    for (const inv of prevOrphanInvoices) {
      const yearName = 'Previous Years';
      const balance = Number(inv.remainingBalance);
      if (balance > 0) {
        prevYearDuesMap.set(yearName, (prevYearDuesMap.get(yearName) || 0) + balance);
      }
    }

    const previousYears = Array.from(prevYearDuesMap.entries()).map(([academicYearName, outstandingBalance]) => ({
      academicYearName,
      outstandingBalance
    }));

    const totalPreviousYearDue = previousYears.reduce((sum, item) => sum + item.outstandingBalance, 0);
    const currentYearPending = Math.max(0, totalFee - totalPaid);
    const grandTotalBalanceDue = currentYearPending + totalPreviousYearDue;
    const totalFees = totalPaid + grandTotalBalanceDue;

    const pendingPercentage = totalFees > 0
      ? Math.round((grandTotalBalanceDue / totalFees) * 100)
      : 0;

    const paidPercentage = totalFees > 0
      ? Math.round((totalPaid / totalFees) * 100)
      : 100;

    const financialStatus = grandTotalBalanceDue > 0
      ? `Pending Due (${pendingPercentage}%)`
      : 'Fully Paid (100%)';

    const feeSummary = {
      currentYear: {
        feeProductsAmount: totalFee,
        paidAmount: totalPaid,
        pendingAmount: currentYearPending
      },
      previousYears,
      overall: {
        totalCurrentYearDue: currentYearPending,
        totalPreviousYearDue,
        grandTotalBalanceDue
      }
    };

    return {
      account: {
        id: student.id,
        name: student.user.name,
        rollNo: student.rollNo,
        phone: student.user.phone,
        profilePhotoUrl: student.profilePhotoUrl,
        fatherName: student.fatherName,
        motherName: student.motherName,
        aadharNo: student.aadharNo,
        class: student.classSection?.class.name || '',
        section: student.classSection?.section.name || '',
        classId: student.classSection?.classId || '',
        sectionId: student.classSection?.sectionId || '',
        opportunities: openOpp ? [{ id: openOpp.id, academicYearId: openOpp.academicYearId }] : [],
      },
      totalFees,
      paidAmount: totalPaid,
      currentYearPending,
      previousYearPending: totalPreviousYearDue,
      totalPendingBalance: grandTotalBalanceDue,
      pendingPercentage,
      paidPercentage,
      financialStatus,
      totalPaidAmount: totalPaid,
      feeSummary
    };
  }

  // ── UNPAID FEES LISTING ────────────────────────────────────────────────────

  async getUnpaidFees(opportunityId: string) {
    const tenantId = this.getTenantId();

    const opportunity = await this.prisma.opportunity.findUnique({
      where: { id: opportunityId },
      include: { academicYear: true }
    });
    if (!opportunity) {
      throw new NotFoundException('Opportunity not found');
    }

    // Map Opportunity Line Item paid amounts from all non-voided invoices
    const invoiceItems = await this.prisma.invoiceItem.findMany({
      where: {
        tenantId,
        invoice: {
          opportunityId,
          status: { not: PaymentStatus.VOIDED },
        },
      },
    });

    const oliPaidMap = new Map<string, number>();
    for (const item of invoiceItems) {
      if (item.opportunityLineItemId) {
        const cur = oliPaidMap.get(item.opportunityLineItemId) || 0;
        oliPaidMap.set(item.opportunityLineItemId, cur + Number(item.amount));
      }
    }

    // Also build a name-based paid map from invoice items that have no linked OLI
    // (e.g. invoices created during promotion without OLI references)
    const namePaidMap = new Map<string, number>();
    for (const item of invoiceItems) {
      if (!item.opportunityLineItemId && item.name) {
        const cur = namePaidMap.get(item.name.toLowerCase()) || 0;
        namePaidMap.set(item.name.toLowerCase(), cur + Number(item.amount));
      }
    }

    // Fetch opportunity line items
    let olis = await this.prisma.opportunityLineItem.findMany({
      where: { opportunityId, tenantId },
      include: { product: true },
    });

    // ── FALLBACK: If this opportunity has no OLIs (e.g. promotion when pricebook
    //    lookup failed), auto-create them from the class pricebook so the admin can collect fees.
    if (olis.length === 0 && opportunity.classId) {
      const pricebookProducts = await this.getActiveProducts(
        opportunity.classId,
        opportunity.academicYearId || undefined,
      );

      if (pricebookProducts.length > 0) {
        await this.prisma.opportunityLineItem.createMany({
          data: pricebookProducts.map(p => ({
            opportunityId,
            pricebookEntryId: p.id,
            productId: p.product2Id,
            quantity: 1,
            unitPrice: p.unitPrice,
            discount: 0,
            tenantId,
          })),
        });

        olis = await this.prisma.opportunityLineItem.findMany({
          where: { opportunityId, tenantId },
          include: { product: true },
        });
      }
    }

    const result: any[] = olis.map(oli => {
      const totalAmount = Number(oli.unitPrice) * Number(oli.quantity);
      const discountPercent = Number(oli.discount);
      const discountAmount = (totalAmount * discountPercent) / 100;
      const netAmount = totalAmount - discountAmount;
      // Check both OLI-linked payments and name-based payments (from promotion invoices)
      const paidByOli = oliPaidMap.get(oli.id) || 0;
      const paidByName = namePaidMap.get(oli.product.name.toLowerCase()) || 0;
      const paidAmount = Math.max(paidByOli, paidByName);
      const balanceDue = netAmount - paidAmount;

      return {
        oliId: oli.id,
        productName: oli.product.name,
        totalAmount,
        netAmount,
        paidAmount,
        balanceDue: Math.max(0, balanceDue),
        productId: oli.productId,
        discountPercent,
        discountAmount,
      };
    });

    // Check if there are unpaid/partially paid invoices from previous years
    const studentInfo = await this.getStudentById(opportunity.studentId, opportunity.academicYearId);
    const prevBalanceDue = studentInfo.feeSummary.overall.totalPreviousYearDue;

    if (prevBalanceDue > 0) {
      result.unshift({
        oliId: 'PREV_YEAR_DUE_CF',
        productName: 'Previous Year Balance Brought Forward',
        totalAmount: prevBalanceDue,
        netAmount: prevBalanceDue,
        paidAmount: 0,
        balanceDue: prevBalanceDue,
        productId: null,
        discountPercent: 0,
        discountAmount: 0,
      });
    }

    return result;
  }

  // ── CREATE INVOICE & REGISTER PAYMENT (Trigger Flow) ───────────────────────

  async createInvoice(
    opportunityId: string,
    studentId: string,
    selectedItems: { oliId: string; productId: string; amount: number }[],
    paymentMethod: string,
    bankDetails?: any,
  ) {
    const tenantId = this.getTenantId();

    if (!selectedItems || selectedItems.length === 0) {
      throw new BadRequestException('No fee items selected for payment.');
    }

    const totalAmount = selectedItems.reduce((sum, item) => sum + Number(item.amount), 0);
    if (totalAmount <= 0) {
      throw new BadRequestException('The total payment amount must be greater than zero.');
    }

    // Map string payment method to Prisma enum
    let method: PaymentMethod = PaymentMethod.CASH;
    if (paymentMethod === 'GPAY_UPI' || paymentMethod === 'PHONEPE_UPI' || paymentMethod === 'UPI') {
      method = PaymentMethod.UPI;
    } else if (paymentMethod === 'NET_BANKING' || paymentMethod === 'BANK_TRANSFER') {
      method = PaymentMethod.BANK_TRANSFER;
    } else if (paymentMethod === 'CARD') {
      method = PaymentMethod.CARD;
    }

    return this.prisma.$transaction(async (tx) => {
      const opportunity = await tx.opportunity.findUnique({
        where: { id: opportunityId },
        include: { academicYear: true }
      });
      if (!opportunity) {
        throw new NotFoundException('Opportunity not found');
      }

      // Create Invoice
      const invoice = await tx.invoice.create({
        data: {
          opportunityId,
          studentId,
          status: PaymentStatus.PAID,
          invoiceDate: new Date(),
          dueDate: new Date(),
          totalAmount,
          paidAmount: totalAmount,
          remainingBalance: 0,
          paymentMethod: method,
          bankName: bankDetails?.bankName || null,
          bankIFSC: bankDetails?.bankIfsc || null,
          bankAccountNumber: bankDetails?.bankAccountNumber || null,
          bankBranch: bankDetails?.bankBranch || null,
          tenantId,
        },
      });

      // Create Invoice Items
      const invoiceItemsToCreate = [];
      for (const item of selectedItems) {
        if (item.oliId === 'PREV_YEAR_DUE_CF') {
          // Carry Forward payment: Apply to original previous year's invoices
          let amountToApply = Number(item.amount);

          const prevInvoicesToPay = await tx.invoice.findMany({
            where: {
              studentId,
              tenantId,
              invoiceDate: {
                lt: opportunity.academicYear?.startDate || new Date()
              },
              status: {
                in: [PaymentStatus.UNPAID, PaymentStatus.PARTIALLY_PAID]
              }
            },
            orderBy: {
              invoiceDate: 'asc'
            }
          });

          for (const oldInv of prevInvoicesToPay) {
            if (amountToApply <= 0) break;
            const currentRemaining = Number(oldInv.remainingBalance);
            if (currentRemaining <= 0) continue;

            const paymentForThis = Math.min(amountToApply, currentRemaining);
            const newPaidAmount = Number(oldInv.paidAmount) + paymentForThis;
            const newRemaining = currentRemaining - paymentForThis;
            const newStatus = newRemaining <= 0 ? PaymentStatus.PAID : PaymentStatus.PARTIALLY_PAID;

            await tx.invoice.update({
              where: { id: oldInv.id },
              data: {
                paidAmount: newPaidAmount,
                remainingBalance: newRemaining,
                status: newStatus
              }
            });

            amountToApply -= paymentForThis;
          }

          invoiceItemsToCreate.push({
            invoiceId: invoice.id,
            opportunityLineItemId: null,
            productId: null,
            name: 'Previous Year Balance Brought Forward Payment',
            amount: item.amount,
            tenantId,
          });
        } else {
          // Fetch product name
          const p = await tx.product.findUnique({ where: { id: item.productId } });
          const name = p ? p.name : 'School Fee Item';

          invoiceItemsToCreate.push({
            invoiceId: invoice.id,
            opportunityLineItemId: item.oliId,
            productId: item.productId,
            name,
            amount: item.amount,
            tenantId,
          });
        }
      }

      await tx.invoiceItem.createMany({
        data: invoiceItemsToCreate,
      });

      // Recalculate Opportunity paid amount (Equivalent to Apex triggers)
      await this.recalculatePaidAmount(opportunityId, tx);

      return invoice.id;
    }, { timeout: 30000 });
  }

  // ── RECENT INVOICES ────────────────────────────────────────────────────────

  async getRecentInvoices(studentId?: string) {
    const tenantId = this.getTenantId();

    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        status: { not: PaymentStatus.VOIDED },
        ...(studentId ? { studentId } : {}),
      },
      include: {
        student: {
          include: {
            user: true,
          },
        },
      },
      orderBy: { invoiceDate: 'desc' },
      take: 10,
    });

    return (invoices as any[]).map(inv => ({
      id: inv.id,
      name: inv.student.user.name,
      rollNo: inv.student.rollNo || '',
      dateStr: inv.invoiceDate.toISOString().split('T')[0],
      status: inv.status === PaymentStatus.VOIDED ? 'Cancelled' : 'Paid',
      totalAmount: Number(inv.totalAmount),
      paymentMethod: inv.paymentMethod || 'CASH',
    }));
  }

  // ── VOID INVOICE ───────────────────────────────────────────────────────────

  async voidInvoice(invoiceId: string) {
    const tenantId = this.getTenantId();

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice || invoice.tenantId !== tenantId) {
      throw new NotFoundException('Invoice not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: PaymentStatus.VOIDED,
          remainingBalance: invoice.totalAmount,
          paidAmount: 0,
        },
      });

      if (invoice.opportunityId) {
        await this.recalculatePaidAmount(invoice.opportunityId, tx);
      }

      return updatedInvoice;
    }, { timeout: 30000 });
  }

  // ── CONCESSION MANAGEMENT ──────────────────────────────────────────────────

  async updateLineItemDiscount(oliId: string, discountPercent: number) {
    const tenantId = this.getTenantId();

    const oli = await this.prisma.opportunityLineItem.findUnique({
      where: { id: oliId },
    });

    if (!oli || oli.tenantId !== tenantId) {
      throw new NotFoundException('Fee line item not found.');
    }

    return this.prisma.opportunityLineItem.update({
      where: { id: oliId },
      data: { discount: discountPercent },
    });
  }

  async updateBulkLineItemDiscounts(oliIds: string[], discountPercent: number) {
    const tenantId = this.getTenantId();

    return this.prisma.opportunityLineItem.updateMany({
      where: {
        id: { in: oliIds },
        tenantId,
      },
      data: { discount: discountPercent },
    });
  }

  // ── PDF RECEIPT / TEMPLATE DATA RESOLUTION ─────────────────────────────────

  async getInvoicePDFData(invoiceId: string) {
    const tenantId = this.getTenantId();

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        student: {
          include: {
            user: true,
            classSection: {
              include: {
                class: true,
                section: true,
              },
            },
          },
        },
        opportunity: {
          include: {
            academicYear: true,
          },
        },
        invoiceItems: true,
      },
    });

    if (!invoice || invoice.tenantId !== tenantId) {
      throw new NotFoundException('Invoice receipt not found.');
    }

    // Fetch School/Tenant settings
    const school = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    // Calculate remaining balance for student
    const studentInvoices = await this.prisma.invoice.findMany({
      where: { studentId: invoice.studentId, tenantId },
      select: { remainingBalance: true }
    });
    const totalRemainingBalance = studentInvoices.reduce((sum, inv) => sum + Number(inv.remainingBalance || 0), 0);
    const parentPhone = invoice.student.fatherPhone || invoice.student.motherPhone || invoice.student.user?.phone || '';

    return {
      schoolName: school?.name || 'Vikas Senior Secondary School',
      schoolAddress: school?.address || 'School Campus Address',
      schoolPhone: school?.phone || '+91 999 999 9999',
      schoolLogo: school?.logoUrl || '',
      schoolSubtitle: school?.subtitle || 'Inspiring Excellence, Nurturing Values',
      invoiceNo: `INV-2026-${invoice.student.rollNo?.slice(-3) || invoice.id.slice(-3)}`,
      invoiceDate: invoice.invoiceDate.toISOString().split('T')[0],
      academicYear: invoice.opportunity?.academicYear?.name || '2026-2027',
      admissionRef: invoice.opportunity?.name || `ADMISSION-REF-${invoice.student.rollNo || ''}`,
      studentName: invoice.student.user.name,
      fatherName: invoice.student.fatherName || '',
      motherName: invoice.student.motherName || '',
      className: invoice.student.classSection?.class.name || '',
      sectionName: invoice.student.classSection?.section.name || '',
      studentDob: '', // Dob can be added to user/student profile if needed
      addressVillage: school?.address || '',
      totalAmount: Number(invoice.totalAmount),
      remainingBalance: totalRemainingBalance,
      invoiceRemainingBalance: Number(invoice.remainingBalance || 0),
      parentPhone,
      items: invoice.invoiceItems.map(item => ({
        particulars: item.name,
        amount: Number(item.amount),
      })),
    };
  }

  async generateReceiptPdfStream(data: any, res: any) {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ size: 'A4', margin: 40 });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=SchoolFeeReceipt_${data.studentName.replace(/\s+/g, '_')}_${data.invoiceNo}.pdf`,
    });

    doc.pipe(res);

    // 1. Draw Header Background Rect (Dark Blue #1a365d)
    doc.rect(0, 0, 595.28, 120).fill('#1a365d');

    // 2. Draw Orange Divider Line (#ed8936)
    doc.rect(0, 120, 595.28, 6).fill('#ed8936');

    // 3. Logo Drawing
    let logoDrawn = false;
    if (data.schoolLogo) {
      try {
        const https = require('https');
        const http = require('http');
        const client = data.schoolLogo.startsWith('https') ? https : http;

        const logoBuffer = await new Promise<Buffer>((resolve, reject) => {
          client.get(data.schoolLogo, (logoRes) => {
            const chunks = [];
            logoRes.on('data', (chunk) => chunks.push(chunk));
            logoRes.on('end', () => resolve(Buffer.concat(chunks)));
            logoRes.on('error', (err) => reject(err));
          }).on('error', (err) => reject(err));
        });

        doc.image(logoBuffer, 40, 25, { width: 70, height: 70 });
        logoDrawn = true;
      } catch (err) {
        console.error('Failed to fetch school logo image for PDF:', err);
      }
    }

    if (!logoDrawn) {
      // White circle placeholder
      doc.fillColor('#ffffff');
      doc.circle(75, 60, 30).fill();
      doc.fillColor('#1a365d');
      doc.fontSize(16).font('Helvetica-Bold').text('ET', 60, 52, { width: 30, align: 'center' });
    }

    // 4. Header Text
    doc.fillColor('#ffffff');
    doc.fontSize(18).font('Helvetica-Bold').text(data.schoolName.toUpperCase(), 130, 32, { width: 425 });
    doc.fontSize(9).font('Helvetica-Oblique').fillColor('#cbd5e1').text(data.schoolSubtitle || 'Inspiring Excellence, Nurturing Values', 130, 57, { width: 425 });
    doc.fontSize(8).font('Helvetica').fillColor('#cbd5e1').text(data.schoolAddress || '', 130, 72, { width: 425 });
    if (data.schoolPhone) {
      doc.text(`Phone: ${data.schoolPhone}`, 130, 85);
    }

    // 5. Title
    doc.fillColor('#1a365d');
    doc.fontSize(16).font('Helvetica-Bold').text('OFFICIAL FEE RECEIPT', 40, 150, { align: 'center' });

    // 6. Metadata grid details
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#4a5568');

    // Left Column
    doc.text('Receipt No:', 40, 185);
    doc.font('Helvetica-Bold').fillColor('#1a202c').text(data.invoiceNo, 120, 185);

    doc.font('Helvetica-Bold').fillColor('#4a5568').text('Receipt Date:', 40, 202);
    doc.font('Helvetica').fillColor('#2d3748').text(data.invoiceDate, 120, 202);

    // Right Column
    doc.font('Helvetica-Bold').fillColor('#4a5568').text('Academic Year:', 340, 185);
    doc.font('Helvetica').fillColor('#2d3748').text(data.academicYear, 440, 185);

    doc.font('Helvetica-Bold').fillColor('#4a5568').text('Admission Ref:', 340, 202);
    doc.font('Helvetica').fillColor('#2d3748').text(data.admissionRef, 440, 202);

    // 7. Gray background card for student details
    doc.roundedRect(40, 230, 515.28, 90, 6).fill('#f7fafc').stroke('#e2e8f0');

    // Col 1
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#718096').text('STUDENT NAME', 55, 245);
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#1a365d').text(data.studentName, 55, 258);

    doc.fontSize(8).font('Helvetica-Bold').fillColor('#718096').text("PARENT'S DETAILS", 55, 282);
    doc.fontSize(9).font('Helvetica').fillColor('#2d3748').text(`Father: ${data.fatherName || 'N/A'}  |  Mother: ${data.motherName || 'N/A'}`, 55, 295);

    // Col 2
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#718096').text('CLASS & SECTION', 350, 245);
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1a365d').text(`${data.className} - ${data.sectionName}`, 350, 258);

    doc.fontSize(8).font('Helvetica-Bold').fillColor('#718096').text('ROLL NUMBER', 470, 245);
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1a365d').text(data.rollNo || 'N/A', 470, 258);

    // 8. Particulars Table
    doc.rect(40, 340, 515.28, 22).fill('#ebf8ff');
    doc.fillColor('#1a365d').fontSize(9).font('Helvetica-Bold');
    doc.text('Sl. No', 50, 347);
    doc.text('Particulars Description', 100, 347);
    doc.text('Amount Paid', 460, 347, { width: 85, align: 'right' });

    let y = 362;
    doc.fontSize(9).font('Helvetica').fillColor('#2d3748');
    data.items.forEach((item, index) => {
      doc.lineCap('butt').moveTo(40, y).lineTo(555.28, y).stroke('#edf2f7');

      doc.text(String(index + 1), 50, y + 8);
      doc.font('Helvetica-Bold').text(item.particulars, 100, y + 8);
      doc.font('Helvetica-Bold').text(`Rs. ${item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 460, y + 8, { width: 85, align: 'right' });
      y += 26;
    });

    doc.lineCap('butt').moveTo(40, y).lineTo(555.28, y).stroke('#edf2f7');

    y += 15;

    // 9. Grand Total Banner
    doc.rect(340, y, 215.28, 36).fill('#1a365d');
    doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold').text('GRAND TOTAL PAID', 355, y + 13);
    doc.fontSize(12).font('Helvetica-Bold').text(`Rs. ${data.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 460, y + 12, { width: 85, align: 'right' });

    // Payment method info
    doc.fillColor('#718096').fontSize(8).font('Helvetica').text(`Payment Mode: ${data.paymentMethod || 'UPI'}`, 40, y + 10);
    doc.text(`Transaction ID: ${data.transactionId || 'N/A'}`, 40, y + 22);

    // Disclaimer
    doc.fillColor('#a0aec0').fontSize(7).text('This is a computer generated fee receipt. No physical signature is required. For verification query, contact the accounting department.', 40, 780, { width: 515.28, align: 'center' });

    doc.end();
  }

  // ── BULK IMPORT STUDENTS ───────────────────────────────────────────────────

  async importStudentsBulk(studentDataList: any[]) {
    const tenantId = this.getTenantId();
    let successCount = 0;
    const errors: string[] = [];

    // Pre-cache classes, sections, academic years
    const ays = await this.prisma.academicYear.findMany({ where: { tenantId } });
    const classes = await this.prisma.class.findMany({ where: { tenantId } });
    const sections = await this.prisma.section.findMany({ where: { tenantId } });
    const classSections = await this.prisma.classSection.findMany({
      where: { tenantId },
      include: { class: true, section: true },
    });

    const defaultPassword = 'Welcome@123';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    const affectedClasses = new Map<string, string>(); // classId -> academicYearId
    const affectedClassSectionIds = new Set<string>();

    for (let i = 0; i < studentDataList.length; i++) {
      const data = studentDataList[i];
      try {
        let firstName = (data['First Name'] || data['firstName'] || data['Name'] || data['Student Name'] || data['name'] || '').toString().trim();
        let lastName = (data['Last Name'] || data['lastName'] || '').toString().trim();

        if (firstName && !lastName && firstName.includes(' ')) {
          const parts = firstName.split(/\s+/);
          firstName = parts[0];
          lastName = parts.slice(1).join(' ');
        }

        const rawEmail = (data['Email'] || data['email'] || '').toString().trim();
        const phone = (data['Phone'] || data['phone'] || '').toString().trim();
        const classStr = (data['Class'] || data['class'] || data['Grade'] || data['grade'] || '').toString().trim();
        const sectionStr = (data['Section'] || data['section'] || 'A').toString().trim();
        const ayStr = (data['Academic Year'] || data['academicYear'] || '').toString().trim();

        if (!classStr) {
          errors.push(`Row ${i + 1}: Missing mandatory field (Class)`);
          continue;
        }

        if (!firstName && !lastName) {
          errors.push(`Row ${i + 1}: Missing student name`);
          continue;
        }

        const matchedClass = classes.find(c => c.name.toLowerCase() === classStr.toLowerCase().trim());
        const matchedSection = sections.find(s => s.name.toLowerCase() === sectionStr.toLowerCase().trim());

        if (!matchedClass || !matchedSection) {
          errors.push(`Row ${i + 1}: Class "${classStr}" or Section "${sectionStr}" not found`);
          continue;
        }

        const matchedCS = classSections.find(cs => cs.classId === matchedClass.id && cs.sectionId === matchedSection.id);
        if (!matchedCS) {
          errors.push(`Row ${i + 1}: Junction mapping between Class and Section not found`);
          continue;
        }

        const matchedAY = ays.find(ay => ay.name.toLowerCase() === (ayStr || '').toLowerCase().trim()) || ays.find(ay => ay.isActive);

        let emailLower: string;
        if (rawEmail) {
          emailLower = rawEmail.toLowerCase().trim();
          const existingUser = await this.prisma.user.findUnique({ where: { email: emailLower } });
          if (existingUser) {
            errors.push(`Row ${i + 1}: Email "${rawEmail}" is already registered`);
            continue;
          }
        } else {
          const randomSuffix = Math.random().toString(36).substring(2, 8) + Date.now().toString().slice(-4);
          const cleanFirst = (firstName || 'student').toLowerCase().replace(/[^a-z0-9]/g, '');
          const cleanLast = (lastName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          emailLower = `${cleanFirst}${cleanLast ? '.' + cleanLast : ''}.${randomSuffix}@noemail.local`;
        }

        if (matchedAY) {
          affectedClasses.set(matchedClass.id, matchedAY.id);
        }
        affectedClassSectionIds.add(matchedCS.id);

        let finalPhone: string | null = null;
        if (phone) {
          const digitsOnly = phone.replace(/\D/g, '').slice(-10);
          if (digitsOnly.length >= 10) {
            finalPhone = `${tenantId.substring(0, 8)}-${digitsOnly}`;
          }
        }

        await this.prisma.$transaction(async (tx) => {
          // Create User
          const user = await tx.user.create({
            data: {
              email: emailLower,
              name: `${firstName || ''} ${lastName}`.trim(),
              passwordHash,
              role: Role.STUDENT,
              phone: finalPhone,
              tenantId,
            },
          });

          // Create StudentProfile
          const profile = await tx.studentProfile.create({
            data: {
              userId: user.id,
              rollNo: data['Roll No'] || data['rollNo'] || null,
              fatherName: data['Father Name'] || data['fatherName'] || null,
              motherName: data['Mother Name'] || data['motherName'] || null,
              aadharNo: data['Aadhar No'] || data['aadharNo'] || null,
              classSectionId: matchedCS.id,
              tenantId,
            },
          });

          // Resolve class pricebook & entries (optional)
          const priceBookName = matchedClass.name.replace('-', ' ');
          const priceBookNameAlt = matchedClass.name.replace(' ', '-');

          const classPriceBook = await tx.pricebook.findFirst({
            where: {
              tenantId,
              classId: matchedClass.id,
              academicYearId: matchedAY?.id || undefined,
              isActive: true
            },
          }) || await tx.pricebook.findFirst({
            where: {
              tenantId,
              isActive: true,
              OR: [
                { name: { equals: priceBookName, mode: 'insensitive' } },
                { name: { equals: priceBookNameAlt, mode: 'insensitive' } },
              ],
            },
          });

          let pbes: any[] = [];
          if (classPriceBook) {
            pbes = await tx.pricebookEntry.findMany({
              where: {
                tenantId,
                isActive: true,
                pricebookId: classPriceBook.id,
                pricebook: { isActive: true },
                product: {
                  isActive: true,
                  productCode: { not: 'PREV_DUES' },
                  name: { not: { contains: 'Previous' } },
                },
              },
            });
          }

          if (classPriceBook && pbes.length > 0) {
            // Create Opportunity
            const opp = await tx.opportunity.create({
              data: {
                name: `${firstName || ''} ${lastName} - Admission ${matchedAY?.name || ''}`.trim(),
                studentId: profile.id,
                stageName: 'Prospecting',
                closeDate: new Date(new Date().setDate(new Date().getDate() + 30)),
                classId: matchedClass.id,
                sectionId: matchedSection.id,
                academicYearId: matchedAY?.id || null,
                totalPaidAmount: 0,
                tenantId,
              },
            });

            const olis = pbes.map(pbe => ({
              opportunityId: opp.id,
              pricebookEntryId: pbe.id,
              productId: pbe.productId,
              quantity: 1,
              unitPrice: pbe.unitPrice,
              discount: 0,
              tenantId,
            }));

            await tx.opportunityLineItem.createMany({
              data: olis,
            });
          }
        }, { timeout: 30000 });

        successCount++;
      } catch (err: any) {
        errors.push(`Row ${i + 1} Error: ${err.message}`);
      }
    }

    // Post-import sync: update section strengths
    for (const csId of affectedClassSectionIds) {
      try {
        const count = await this.prisma.studentProfile.count({
          where: { classSectionId: csId, tenantId }
        });
        await this.prisma.classSection.update({
          where: { id: csId },
          data: { strength: count }
        });
      } catch (e) {
        console.warn(`Failed to update strength for class section ${csId}:`, e);
      }
    }

    // Post-import sync: sync pricebook once per affected class outside per-student transactions
    for (const [classId, ayId] of affectedClasses.entries()) {
      try {
        await this.syncPriceBookToStudents(classId, ayId);
      } catch (e) {
        console.warn(`Post-import pricebook sync skipped for class ${classId}:`, e);
      }
    }

    return {
      totalRows: studentDataList.length,
      successCount,
      errors,
    };
  }

  // ── PRODUCT MANAGEMENT ─────────────────────────────────────────────────────

  async createFeeProducts(productNames: string[]) {
    const tenantId = this.getTenantId();
    const created = [];

    const generateProductCode = (name: string) => {
      const clean = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      return `${clean.slice(0, 10)}_${Date.now().toString().slice(-4)}`;
    };

    for (const name of productNames) {
      if (!name || name.trim() === '') continue;
      const cleanName = name.trim();

      // Check if product with same name already exists for this tenant
      const existing = await this.prisma.product.findFirst({
        where: {
          tenantId,
          name: { equals: cleanName, mode: 'insensitive' },
          isActive: true,
        },
      });

      if (!existing) {
        const prod = await this.prisma.product.create({
          data: {
            name: cleanName,
            productCode: generateProductCode(cleanName),
            tenantId,
            isActive: true,
          },
        });
        created.push(prod);
      } else {
        created.push(existing);
      }
    }
    return created;
  }

  async getAllFeeProducts() {
    const tenantId = this.getTenantId();
    return this.prisma.product.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  // ── PRICEBOOK UPSERT & LOADING ─────────────────────────────────────────────

  async getPriceBook(classId: string, academicYearId: string) {
    const tenantId = this.getTenantId();
    
    if (!classId || !academicYearId) {
      throw new BadRequestException('classId and academicYearId are required');
    }

    // Try to find pricebook by classId and academicYearId
    const pricebook = await this.prisma.pricebook.findFirst({
      where: {
        tenantId,
        classId,
        academicYearId,
        isActive: true,
      },
      include: {
        pricebookEntries: {
          where: { isActive: true },
          include: { product: true },
        },
      },
    });

    if (pricebook) {
      return {
        id: pricebook.id,
        name: pricebook.name,
        isActive: pricebook.isActive,
        academicYearId: pricebook.academicYearId,
        classId: pricebook.classId,
        entries: pricebook.pricebookEntries.map(e => ({
          productId: e.productId,
          productName: e.product.name,
          unitPrice: Number(e.unitPrice),
          isActive: e.isActive,
        })),
      };
    }
    return null;
  }

  async savePriceBook(
    classId: string,
    academicYearId: string,
    priceItems: { productId: string; price: number; selected: boolean }[],
  ) {
    const tenantId = this.getTenantId();

    if (!classId || !academicYearId) {
      throw new BadRequestException('classId and academicYearId are required');
    }

    const classRecord = await this.prisma.class.findFirst({
      where: { id: classId, tenantId },
    });
    const ayRecord = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, tenantId },
    });

    if (!classRecord || !ayRecord) {
      throw new BadRequestException('Class or Academic Year not found');
    }

    const pricebookName = `${classRecord.name} - ${ayRecord.name}`;

    // Stage 1: Commit pricebook upsert + entries in a short, focused transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Upsert the pricebook record
      const pricebook = await tx.pricebook.upsert({
        where: {
          tenantId_classId_academicYearId: {
            tenantId,
            classId,
            academicYearId,
          },
        },
        create: {
          tenantId,
          classId,
          academicYearId,
          name: pricebookName,
          isActive: true,
        },
        update: {
          name: pricebookName,
          isActive: true,
        },
      });

      // Handle entries
      for (const item of priceItems) {
        const existingEntry = await tx.pricebookEntry.findFirst({
          where: {
            tenantId,
            pricebookId: pricebook.id,
            productId: item.productId,
          },
        });

        if (existingEntry) {
          await tx.pricebookEntry.update({
            where: { id: existingEntry.id },
            data: {
              unitPrice: item.price,
              isActive: item.selected && item.price > 0,
            },
          });
        } else if (item.selected && item.price > 0) {
          await tx.pricebookEntry.create({
            data: {
              tenantId,
              pricebookId: pricebook.id,
              productId: item.productId,
              unitPrice: item.price,
              isActive: true,
            },
          });
        }
      }

      // Return the updated pricebook inside the transaction while we still have it
      const finalPb = await tx.pricebook.findUnique({
        where: { id: pricebook.id },
        include: {
          pricebookEntries: {
            where: { isActive: true },
            include: { product: true },
          },
        },
      });

      return {
        id: finalPb.id,
        name: finalPb.name,
        isActive: finalPb.isActive,
        academicYearId: finalPb.academicYearId,
        classId: finalPb.classId,
        entries: finalPb.pricebookEntries.map(e => ({
          productId: e.productId,
          productName: e.product.name,
          unitPrice: Number(e.unitPrice),
          isActive: e.isActive,
        })),
      };
    }, { timeout: 15000 });

    // Stage 2: Synchronize all students OUTSIDE the transaction (can be large for big classes)
    // tenantId captured NOW while still in the request async context (AsyncLocalStorage will be gone after response)
    // Run asynchronously so the API response returns immediately; errors are logged not thrown
    this.syncPriceBookToStudents(classId, academicYearId, undefined, tenantId).catch((err) => {
      console.error(`[savePriceBook] Background sync failed for class ${classId}:`, err?.message || err);
    });

    return result;
  }


  async syncPriceBookToStudents(classId: string, academicYearId: string, tx?: any, explicitTenantId?: string) {
    const tenantId = explicitTenantId || this.getTenantId();
    const db = tx || this.prisma;

    // 1. Find the active pricebook for the class and academic year
    const pricebook = await db.pricebook.findFirst({
      where: { tenantId, classId, academicYearId, isActive: true },
      include: {
        pricebookEntries: {
          where: { isActive: true },
          include: { product: true }
        }
      }
    });

    if (!pricebook) {
      return;
    }

    const activeEntries = pricebook.pricebookEntries.filter(e => e.product.isActive);

    // 2. Fetch academic year and class details once
    const ay = await db.academicYear.findUnique({ where: { id: academicYearId } });
    const classRecord = await db.class.findUnique({ where: { id: classId } });

    // 3. Find all student profiles currently enrolled in this class
    const students = await db.studentProfile.findMany({
      where: {
        tenantId,
        classSection: { classId },
        user: { isActive: true }
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

    // 4. Process students in concurrent batches of 50 for fast execution
    const CHUNK_SIZE = 50;
    for (let c = 0; c < students.length; c += CHUNK_SIZE) {
      const studentChunk = students.slice(c, c + CHUNK_SIZE);
      await Promise.all(studentChunk.map(async (student) => {
        try {
          // Find or create Opportunity for this student for this academic year
          let opp = student.opportunities[0];
          if (!opp) {
            const sectionId = student.classSection?.sectionId || null;
            const oppName = `${student.user.name} - Admission ${ay?.name || ''}`.trim();
            opp = await db.opportunity.create({
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

          // A. Update or create line items for active pricebook entries
          for (const entry of activeEntries) {
            const existingOli = currentOlis.find(oli => oli.productId === entry.productId);

            if (existingOli) {
              if (Number(existingOli.unitPrice) !== Number(entry.unitPrice)) {
                await db.opportunityLineItem.update({
                  where: { id: existingOli.id },
                  data: { unitPrice: entry.unitPrice }
                });
              }
            } else {
              await db.opportunityLineItem.create({
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

          // B. Remove line items that are no longer in Price Book (if no payment history)
          for (const oli of currentOlis) {
            if (oli.product.productCode === 'PREV_DUES' || oli.product.name.includes('Previous Year')) {
              continue;
            }

            const inPricebook = activeEntries.some(e => e.productId === oli.productId);
            if (!inPricebook) {
              const invoiceItems = await db.invoiceItem.findMany({
                where: {
                  opportunityLineItemId: oli.id,
                  tenantId,
                  invoice: {
                    status: { in: [PaymentStatus.PAID, PaymentStatus.PARTIALLY_PAID] }
                  }
                }
              });

              if (invoiceItems.length === 0) {
                await db.opportunityLineItem.delete({
                  where: { id: oli.id }
                });
              }
            }
          }

          // C. Recalculate pending/unpaid invoices for this opportunity
          const unpaidInvoices = await db.invoice.findMany({
            where: {
              opportunityId: opp.id,
              studentId: student.id,
              tenantId,
              status: { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIALLY_PAID] }
            },
            include: {
              invoiceItems: true
            }
          });

          for (const inv of unpaidInvoices) {
            const updatedOlis = await db.opportunityLineItem.findMany({
              where: { opportunityId: opp.id, tenantId },
              include: { product: true }
            });

            await db.invoiceItem.deleteMany({
              where: { invoiceId: inv.id }
            });

            const newInvoiceItems = updatedOlis.map(oli => {
              const totalAmount = Number(oli.unitPrice) * Number(oli.quantity);
              const discountPercent = Number(oli.discount);
              const discountAmount = (totalAmount * discountPercent) / 100;
              const netAmount = totalAmount - discountAmount;

              return {
                invoiceId: inv.id,
                opportunityLineItemId: oli.id,
                productId: oli.productId,
                name: oli.product.name,
                amount: netAmount,
                tenantId
              };
            });

            await db.invoiceItem.createMany({
              data: newInvoiceItems
            });

            const totalInvoiceAmount = newInvoiceItems.reduce((sum, item) => sum + item.amount, 0);
            const paidInvoiceAmount = Number(inv.paidAmount);
            const remainingBalance = Math.max(0, totalInvoiceAmount - paidInvoiceAmount);
            const newStatus = remainingBalance <= 0 
              ? PaymentStatus.PAID 
              : paidInvoiceAmount > 0 
                ? PaymentStatus.PARTIALLY_PAID 
                : PaymentStatus.UNPAID;

            await db.invoice.update({
              where: { id: inv.id },
              data: {
                totalAmount: totalInvoiceAmount,
                remainingBalance,
                status: newStatus
              }
            });
          }

          await this.recalculatePaidAmount(opp.id, db);
        } catch (studentErr) {
          console.warn(`[syncPriceBookToStudents] Error syncing student ${student.id}:`, studentErr);
        }
      }));
    }
  }

  async checkCorrespondentAccess(userId: string, tenantId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return false;
    return user.role === 'SUPER_ADMIN' || user.role === 'SCHOOL_ADMIN';
  }

  async getFinancialCommandCenterData(tenantId: string, filters: any) {
    // 1. Fetch active academic year
    const activeYear = await this.prisma.academicYear.findFirst({
      where: { tenantId, isActive: true },
    });

    // 2. Fetch all classes and sections for mapping
    const allClasses = await this.prisma.class.findMany({ where: { tenantId } });
    const allSections = await this.prisma.section.findMany({ where: { tenantId } });
    const classMap = new Map(allClasses.map(c => [c.id, c.name]));
    const sectionMap = new Map(allSections.map(s => [s.id, s.name]));

    // 3. Resolve Date Filter for query parameters
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (filters.startDate && filters.endDate) {
      startDate = new Date(filters.startDate);
      endDate = new Date(filters.endDate);
    } else if (filters.month) {
      const year = new Date().getFullYear();
      startDate = new Date(year, filters.month - 1, 1);
      endDate = new Date(year, filters.month, 0, 23, 59, 59, 999);
    } else if (filters.academicYearId) {
      const ay = await this.prisma.academicYear.findUnique({ where: { id: filters.academicYearId } });
      if (ay) {
        startDate = ay.startDate;
        endDate = ay.endDate;
      }
    } else if (activeYear) {
      startDate = activeYear.startDate;
      endDate = activeYear.endDate;
    }

    // Build Invoices query filter
    const invoiceWhere: any = {
      tenantId,
      status: { not: PaymentStatus.VOIDED },
    };
    if (startDate && endDate) {
      invoiceWhere.invoiceDate = { gte: startDate, lte: endDate };
    }
    if (filters.studentId) {
      invoiceWhere.studentId = filters.studentId;
    }
    if (filters.paymentMethod) {
      let method: PaymentMethod = PaymentMethod.CASH;
      if (filters.paymentMethod === 'GPAY_UPI' || filters.paymentMethod === 'PHONEPE_UPI' || filters.paymentMethod === 'UPI') {
        method = PaymentMethod.UPI;
      } else if (filters.paymentMethod === 'NET_BANKING' || filters.paymentMethod === 'BANK_TRANSFER') {
        method = PaymentMethod.BANK_TRANSFER;
      } else if (filters.paymentMethod === 'CARD') {
        method = PaymentMethod.CARD;
      }
      invoiceWhere.paymentMethod = method;
    }
    if (filters.classId || filters.sectionId) {
      invoiceWhere.student = {
        classSection: {
          ...(filters.classId ? { classId: filters.classId } : {}),
          ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
        }
      };
    }
    if (filters.feeCategory) {
      invoiceWhere.invoiceItems = {
        some: { productId: filters.feeCategory }
      };
    }

    // Build Expenses query filter
    const expenseWhere: any = {
      tenantId,
      status: { in: [ExpenseStatus.PAID, ExpenseStatus.APPROVED] },
    };
    if (startDate && endDate) {
      expenseWhere.date = { gte: startDate, lte: endDate };
    }
    if (filters.expenseCategory) {
      expenseWhere.category = filters.expenseCategory;
    }

    // 4. Fetch Live Data for filtered range
    const filteredInvoices = await this.prisma.invoice.findMany({
      where: invoiceWhere,
      include: {
        invoiceItems: true,
        student: {
          include: { user: true }
        }
      }
    });

    const filteredExpenses = await this.prisma.expense.findMany({
      where: expenseWhere
    });

    // Compute basic totals
    const totalCollectedFiltered = filteredInvoices.reduce((sum, inv) => sum + Number(inv.paidAmount), 0);
    const totalExpensesFiltered = filteredExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

    // ── FINANCIAL SUMMARY CARDS (Time-based calculations) ──
    const now = new Date();
    
    // Revenue calculations (time-based)
    const allTimeInvoices = await this.prisma.invoice.findMany({
      where: { tenantId, status: { not: PaymentStatus.VOIDED } }
    });
    
    const revenueAllTime = allTimeInvoices.reduce((sum, inv) => sum + Number(inv.paidAmount), 0);

    // Filter sub-ranges
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + (startOfWeek.getDay() === 0 ? -6 : 1));
    
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    
    const last30DaysLimit = new Date(startOfToday);
    last30DaysLimit.setDate(last30DaysLimit.getDate() - 30);

    let revenueToday = 0;
    let revenueYesterday = 0;
    let revenueThisWeek = 0;
    let revenueCurrentMonth = 0;
    let revenuePrevMonth = 0;
    let revenueLast30Days = 0;
    let revenueAcademicYear = 0;

    let paidInvoicesCountCurrentMonth = 0;
    let paidInvoicesCountPrevMonth = 0;

    for (const inv of allTimeInvoices) {
      const amt = Number(inv.paidAmount);
      const date = new Date(inv.invoiceDate);
      const isPaid = inv.status === PaymentStatus.PAID || inv.status === PaymentStatus.PARTIALLY_PAID;

      if (date >= startOfToday) revenueToday += amt;
      if (date >= startOfYesterday && date < startOfToday) revenueYesterday += amt;
      if (date >= startOfWeek) revenueThisWeek += amt;
      
      if (date >= startOfMonth) {
        revenueCurrentMonth += amt;
        if (isPaid && amt > 0) paidInvoicesCountCurrentMonth++;
      }
      if (date >= startOfPrevMonth && date <= endOfPrevMonth) {
        revenuePrevMonth += amt;
        if (isPaid && amt > 0) paidInvoicesCountPrevMonth++;
      }
      if (date >= last30DaysLimit) revenueLast30Days += amt;
      
      if (activeYear && date >= activeYear.startDate && date <= activeYear.endDate) {
        revenueAcademicYear += amt;
      }
    }

    // Expense calculations (time-based)
    const allTimeExpensesList = await this.prisma.expense.findMany({
      where: { tenantId, status: { in: [ExpenseStatus.PAID, ExpenseStatus.APPROVED] } }
    });
    
    const expensesAllTime = allTimeExpensesList.reduce((sum, exp) => sum + Number(exp.amount), 0);

    let expensesToday = 0;
    let expensesThisWeek = 0;
    let expensesCurrentMonth = 0;
    let expensesPrevMonth = 0;
    let expensesAcademicYear = 0;

    for (const exp of allTimeExpensesList) {
      const amt = Number(exp.amount);
      const date = new Date(exp.date);

      if (date >= startOfToday) expensesToday += amt;
      if (date >= startOfWeek) expensesThisWeek += amt;
      if (date >= startOfMonth) expensesCurrentMonth += amt;
      if (date >= startOfPrevMonth && date <= endOfPrevMonth) expensesPrevMonth += amt;
      
      if (activeYear && date >= activeYear.startDate && date <= activeYear.endDate) {
        expensesAcademicYear += amt;
      }
    }

    // ── PENDING FEES & OUTSTANDING (Live calculations) ──
    const studentProfiles = await this.prisma.studentProfile.findMany({
      where: { tenantId },
      include: {
        user: true,
        classSection: true,
      }
    });

    const activeOpps = await this.prisma.opportunity.findMany({
      where: {
        tenantId,
        academicYearId: filters.academicYearId || activeYear?.id || undefined,
      },
      include: {
        opportunityLineItems: {
          include: { product: true }
        },
        invoices: {
          where: { status: { not: PaymentStatus.VOIDED } }
        }
      }
    });

    // Helper map to quickly find pricing totals by class
    const classBaseFeeMap = new Map<string, number>();

    // Calculate pending dues at student/opportunity level
    let totalPendingAmount = 0;
    const pendingStudentsSet = new Set<string>();
    const studentDues = [];

    // Grouping accumulators
    const classPending = new Map<string, { pending: number; collected: number; studentCount: number }>();
    const sectionPending = new Map<string, { pending: number; collected: number; studentCount: number }>();
    const categoryPending = new Map<string, { pending: number; collected: number }>();

    // Initialize maps with existing classes/sections
    for (const c of allClasses) {
      classPending.set(c.id, { pending: 0, collected: 0, studentCount: 0 });
    }
    for (const s of allSections) {
      sectionPending.set(s.id, { pending: 0, collected: 0, studentCount: 0 });
    }

    for (const opp of activeOpps) {
      let netFee = opp.opportunityLineItems.reduce((sum, oli) => {
        const itemTotal = Number(oli.unitPrice) * Number(oli.quantity);
        const itemDiscount = (itemTotal * Number(oli.discount)) / 100;
        return sum + (itemTotal - itemDiscount);
      }, 0);

      // Fallback to pricebook if opportunity has no items
      if (netFee === 0 && opp.classId) {
        let pbTotal = classBaseFeeMap.get(opp.classId);
        if (pbTotal === undefined) {
          const pricebookProducts = await this.prisma.pricebookEntry.findMany({
            where: {
              tenantId,
              isActive: true,
              pricebook: { classId: opp.classId, isActive: true },
              product: { isActive: true }
            }
          });
          pbTotal = pricebookProducts.reduce((sum, p) => sum + Number(p.unitPrice), 0);
          classBaseFeeMap.set(opp.classId, pbTotal);
        }
        netFee = pbTotal;
      }

      const paid = opp.invoices.reduce((sum, inv) => sum + Number(inv.paidAmount), 0);
      const pending = Math.max(0, netFee - paid);

      if (pending > 0) {
        totalPendingAmount += pending;
        pendingStudentsSet.add(opp.studentId);
      }

      // Add dues details for insights
      const studentProfile = studentProfiles.find(sp => sp.id === opp.studentId);
      studentDues.push({
        studentId: opp.studentId,
        studentName: studentProfile?.user.name || 'Unknown Student',
        rollNo: studentProfile?.rollNo || '',
        className: studentProfile?.classSection ? classMap.get(studentProfile.classSection.classId) : '',
        sectionName: studentProfile?.classSection ? sectionMap.get(studentProfile.classSection.sectionId) : '',
        totalFee: netFee,
        paid,
        pending,
        closeDate: opp.closeDate,
      });

      // Accumulate class/section summaries
      if (opp.classId) {
        const cur = classPending.get(opp.classId) || { pending: 0, collected: 0, studentCount: 0 };
        classPending.set(opp.classId, {
          pending: cur.pending + pending,
          collected: cur.collected + paid,
          studentCount: cur.studentCount + 1
        });
      }
      if (opp.sectionId) {
        const cur = sectionPending.get(opp.sectionId) || { pending: 0, collected: 0, studentCount: 0 };
        sectionPending.set(opp.sectionId, {
          pending: cur.pending + pending,
          collected: cur.collected + paid,
          studentCount: cur.studentCount + 1
        });
      }

      // Accumulate category details
      const paidRatio = netFee > 0 ? (paid / netFee) : 1;
      for (const oli of opp.opportunityLineItems) {
        const catName = oli.product.name;
        const itemTotal = Number(oli.unitPrice) * Number(oli.quantity);
        const itemDiscount = (itemTotal * Number(oli.discount)) / 100;
        const itemNet = itemTotal - itemDiscount;
        const itemPaid = itemNet * paidRatio;
        const itemPending = Math.max(0, itemNet - itemPaid);

        const curCat = categoryPending.get(catName) || { pending: 0, collected: 0 };
        categoryPending.set(catName, {
          pending: curCat.pending + itemPending,
          collected: curCat.collected + itemPaid
        });
      }
    }

    // Time-based pending fee deadlines
    let dueToday = 0;
    let dueThisWeek = 0;
    let dueThisMonth = 0;
    let overdueAmount = 0;

    const startOfThisWeek = new Date(startOfToday);
    startOfThisWeek.setDate(startOfThisWeek.getDate() - startOfThisWeek.getDay());
    const endOfThisWeek = new Date(startOfThisWeek);
    endOfThisWeek.setDate(endOfThisWeek.getDate() + 7);

    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    for (const due of studentDues) {
      const deadline = new Date(due.closeDate);
      if (due.pending > 0) {
        if (deadline < startOfToday) overdueAmount += due.pending;
        if (deadline.toDateString() === now.toDateString()) dueToday += due.pending;
        if (deadline >= startOfThisWeek && deadline < endOfThisWeek) dueThisWeek += due.pending;
        if (deadline >= startOfThisMonth && deadline <= endOfThisMonth) dueThisMonth += due.pending;
      }
    }

    // ── STUDENT STATISTICS (Live calculations) ──
    const totalStudentsCount = studentProfiles.length;
    const activeStudentsCount = studentProfiles.filter(sp => sp.user.isActive).length;
    
    let paidCompletelyCount = 0;
    let partiallyPaidCount = 0;
    let pendingCount = 0;

    for (const student of studentProfiles) {
      const dues = studentDues.filter(d => d.studentId === student.id);
      if (dues.length === 0) {
        paidCompletelyCount++;
        continue;
      }
      const totalPending = dues.reduce((sum, d) => sum + d.pending, 0);
      const totalPaid = dues.reduce((sum, d) => sum + d.paid, 0);

      if (totalPending === 0) {
        paidCompletelyCount++;
      } else if (totalPaid > 0) {
        partiallyPaidCount++;
      } else {
        pendingCount++;
      }
    }

    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const newAdmissionsCount = studentProfiles.filter(sp => new Date(sp.user.createdAt) >= currentMonthStart).length;
    
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthAdmissionsCount = studentProfiles.filter(sp => {
      const d = new Date(sp.user.createdAt);
      return d >= prevMonthStart && d < currentMonthStart;
    }).length;

    // Promoted Count logic - query from ActivityLog
    const promotedCount = await this.prisma.activityLog.count({
      where: {
        tenantId,
        action: 'RECORD_UPDATE',
        entityName: 'StudentProfile',
        details: { contains: 'Promoted from' },
        createdAt: startDate && endDate ? { gte: startDate, lte: endDate } : undefined
      }
    });

    // ── CASH FLOW CALCULATIONS ──
    const priorInvoicesSum = await this.prisma.invoice.aggregate({
      where: {
        tenantId,
        status: { not: PaymentStatus.VOIDED },
        invoiceDate: { lt: startDate || new Date(0) }
      },
      _sum: { paidAmount: true }
    });
    const priorExpensesSum = await this.prisma.expense.aggregate({
      where: {
        tenantId,
        status: { in: [ExpenseStatus.PAID, ExpenseStatus.APPROVED] },
        date: { lt: startDate || new Date(0) }
      },
      _sum: { amount: true }
    });
    const openingBalance = Number(priorInvoicesSum._sum.paidAmount || 0) - Number(priorExpensesSum._sum.amount || 0);
    const closingBalance = openingBalance + totalCollectedFiltered - totalExpensesFiltered;

    // Expected Income/Expenses
    const expectedIncome = totalPendingAmount;
    const pendingExpensesSum = await this.prisma.expense.aggregate({
      where: { tenantId, status: ExpenseStatus.PENDING },
      _sum: { amount: true }
    });
    const expectedExpenses = Number(pendingExpensesSum._sum.amount || 0);
    const netCashFlow = totalCollectedFiltered - totalExpensesFiltered;

    // ── YEAR-OVER-YEAR (YoY) GROWTH CARDS (Live Calculations) ──
    const computePeriodTotal = (invoices: any[], expenses: any[], start: Date, end: Date) => {
      const rev = invoices
        .filter(inv => {
          const d = new Date(inv.invoiceDate);
          return d >= start && d <= end;
        })
        .reduce((sum, inv) => sum + Number(inv.paidAmount), 0);
      const exp = expenses
        .filter(e => {
          const d = new Date(e.date);
          return d >= start && d <= end;
        })
        .reduce((sum, e) => sum + Number(e.amount), 0);
      return { revenue: rev, expense: exp, profit: rev - exp };
    };

    const currentPeriod = computePeriodTotal(allTimeInvoices, allTimeExpensesList, startOfMonth, now);
    const prevPeriod = computePeriodTotal(allTimeInvoices, allTimeExpensesList, startOfPrevMonth, endOfPrevMonth);

    // YoY growth percentage formulas
    const calcGrowth = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 1000) / 10;
    };

    const revenueGrowthMonth = calcGrowth(currentPeriod.revenue, prevPeriod.revenue);
    const expenseGrowthMonth = calcGrowth(currentPeriod.expense, prevPeriod.expense);
    const profitGrowthMonth = calcGrowth(currentPeriod.profit, prevPeriod.profit);
    const collectionGrowthMonth = calcGrowth(currentPeriod.revenue, prevPeriod.revenue);
    const studentGrowthMonth = calcGrowth(newAdmissionsCount, prevMonthAdmissionsCount);

    // ── SCHOOL HEALTH SCORE (Blended algorithm) ──
    const collectionRateVal = (revenueAcademicYear + totalPendingAmount) > 0
      ? (revenueAcademicYear / (revenueAcademicYear + totalPendingAmount)) * 100
      : 100;
    const pendingPercentageVal = 100 - collectionRateVal;

    let healthIndicator = '🟢 Excellent';
    if (collectionRateVal < 50) {
      healthIndicator = '🔴 Critical';
    } else if (collectionRateVal < 75) {
      healthIndicator = '🟠 Average';
    } else if (collectionRateVal < 90) {
      healthIndicator = '🟡 Good';
    }

    // ── CLASS OUTSTANDING RANKING (Ranked highest pending to lowest) ──
    const outstandingByClass = Array.from(classPending.entries()).map(([classId, data]) => {
      const className = classMap.get(classId) || 'Unknown Class';
      const colRate = (data.collected + data.pending) > 0 ? (data.collected / (data.collected + data.pending)) * 100 : 100;
      return {
        classId,
        className,
        totalPending: data.pending,
        studentCount: data.studentCount,
        collectionPercentage: Math.round(colRate * 10) / 10,
        collected: data.collected
      };
    }).sort((a, b) => b.totalPending - a.totalPending);

    // Outstanding by Section
    const outstandingBySection = Array.from(sectionPending.entries()).map(([sectionId, data]) => {
      const sectionName = sectionMap.get(sectionId) || 'Unknown Section';
      const colRate = (data.collected + data.pending) > 0 ? (data.collected / (data.collected + data.pending)) * 100 : 100;
      return {
        sectionId,
        sectionName,
        totalPending: data.pending,
        studentCount: data.studentCount,
        collectionPercentage: Math.round(colRate * 10) / 10,
        collected: data.collected
      };
    }).sort((a, b) => b.totalPending - a.totalPending);

    // ── CATEGORY ANALYTICS ──
    const feeCategoryAnalysis = Array.from(categoryPending.entries()).map(([catName, data]) => {
      const colRate = (data.collected + data.pending) > 0 ? (data.collected / (data.collected + data.pending)) * 100 : 100;
      return {
        categoryName: catName,
        collected: data.collected,
        pending: data.pending,
        collectionPercentage: Math.round(colRate * 10) / 10
      };
    });

    // Expense categories mapping
    const expenseCategoriesMap = new Map<string, number>();
    for (const exp of filteredExpenses) {
      const cat = exp.category;
      expenseCategoriesMap.set(cat, (expenseCategoriesMap.get(cat) || 0) + Number(exp.amount));
    }
    const expenseCategoryAnalysis = Array.from(expenseCategoriesMap.entries()).map(([catName, totalAmt]) => ({
      categoryName: catName,
      amount: totalAmt,
      percentage: totalExpensesFiltered > 0 ? Math.round((totalAmt / totalExpensesFiltered) * 100) : 0
    }));

    // Compute previous month's expenses by category to derive dynamic budget
    const prevMonthExpensesList = allTimeExpensesList.filter(e => {
      const d = new Date(e.date);
      return d >= startOfPrevMonth && d <= endOfPrevMonth;
    });

    const getPrevMonthExpenseAmount = (categoryKeyword: string) => {
      return prevMonthExpensesList
        .filter(exp => exp.category.toLowerCase().includes(categoryKeyword.toLowerCase()))
        .reduce((sum, exp) => sum + Number(exp.amount), 0);
    };

    // Calculate dynamic budget: 1.25 * (previous month's expenses) or fallback to a baseline minimum
    const budgetCategories = [
      { category: 'Salaries', budget: Math.max(Math.round(getPrevMonthExpenseAmount('salary') * 1.25), 500000) },
      { category: 'Transport', budget: Math.max(Math.round(getPrevMonthExpenseAmount('transport') * 1.25), 150000) },
      { category: 'Maintenance', budget: Math.max(Math.round(getPrevMonthExpenseAmount('maintenance') * 1.25), 80000) },
      { category: 'Events', budget: Math.max(Math.round(getPrevMonthExpenseAmount('event') * 1.25), 120000) },
      { category: 'Marketing', budget: Math.max(Math.round(getPrevMonthExpenseAmount('marketing') * 1.25), 50000) },
      { category: 'Utilities', budget: Math.max(Math.round((getPrevMonthExpenseAmount('electricity') + getPrevMonthExpenseAmount('internet') + getPrevMonthExpenseAmount('utility')) * 1.25), 60000) },
    ];

    const budgetVsActual = budgetCategories.map(b => {
      const actual = filteredExpenses
        .filter(exp => exp.category.toLowerCase().includes(b.category.toLowerCase()) || (b.category === 'Utilities' && (exp.category.toLowerCase().includes('electricity') || exp.category.toLowerCase().includes('internet'))))
        .reduce((sum, exp) => sum + Number(exp.amount), 0);
      const remaining = Math.max(0, b.budget - actual);
      const overBudget = actual > b.budget;
      return {
        category: b.category,
        budget: b.budget,
        actual,
        remaining: overBudget ? 0 : remaining,
        overBudget,
        excessAmount: overBudget ? actual - b.budget : 0
      };
    });

    // ── OUTSTANDING CHARTS & TRENDS ──
    const monthlyIncome = [];
    const monthlyExpenses = [];
    const incomeVsExpense = [];

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let i = 11; i >= 0; i--) {
      const targetMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
      const mEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0, 23, 59, 59, 999);

      const mCollection = allTimeInvoices
        .filter(inv => {
          const d = new Date(inv.invoiceDate);
          return d >= mStart && d <= mEnd;
        })
        .reduce((sum, inv) => sum + Number(inv.paidAmount), 0);

      const mExp = allTimeExpensesList
        .filter(exp => {
          const d = new Date(exp.date);
          return d >= mStart && d <= mEnd;
        })
        .reduce((sum, exp) => sum + Number(exp.amount), 0);

      const label = `${monthNames[mStart.getMonth()]} ${String(mStart.getFullYear()).slice(-2)}`;
      monthlyIncome.push({ month: label, amount: mCollection });
      monthlyExpenses.push({ month: label, amount: mExp });
      incomeVsExpense.push({
        month: label,
        income: mCollection,
        expenses: mExp,
        netProfit: mCollection - mExp
      });
    }

    // Daily Collection Trend last 30 days
    const dailyCollectionTrend = [];
    for (let i = 29; i >= 0; i--) {
      const dTarget = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dStart = new Date(dTarget.getFullYear(), dTarget.getMonth(), dTarget.getDate());
      const dEnd = new Date(dTarget.getFullYear(), dTarget.getMonth(), dTarget.getDate(), 23, 59, 59, 999);

      const dCollection = allTimeInvoices
        .filter(inv => {
          const d = new Date(inv.invoiceDate);
          return d >= dStart && d <= dEnd;
        })
        .reduce((sum, inv) => sum + Number(inv.paidAmount), 0);

      const label = `${dTarget.getDate()} ${monthNames[dTarget.getMonth()]}`;
      dailyCollectionTrend.push({ date: label, amount: dCollection });
    }

    // Payment Methods Distribution
    const methodsCounts = new Map<string, number>();
    for (const inv of filteredInvoices) {
      const m = inv.paymentMethod || 'CASH';
      methodsCounts.set(m, (methodsCounts.get(m) || 0) + Number(inv.paidAmount));
    }
    const paymentMethodsDistribution = Array.from(methodsCounts.entries()).map(([method, amount]) => ({
      method,
      amount,
      percentage: totalCollectedFiltered > 0 ? Math.round((amount / totalCollectedFiltered) * 100) : 0
    }));

    // ── EXECUTIVE INSIGHTS ──
    const highestPayingClassObj = outstandingByClass.reduce((prev, current) => (prev.collected > current.collected) ? prev : current, { className: 'None', collected: 0 });
    const highestPendingClassObj = outstandingByClass.reduce((prev, current) => (prev.totalPending > current.totalPending) ? prev : current, { className: 'None', totalPending: 0 });
    const highestRevenueMonthObj = monthlyIncome.reduce((prev, current) => (prev.amount > current.amount) ? prev : current, { month: 'None', amount: 0 });
    const highestExpenseMonthObj = monthlyExpenses.reduce((prev, current) => (prev.amount > current.amount) ? prev : current, { month: 'None', amount: 0 });
    const topExpenseCategoryObj = expenseCategoryAnalysis.reduce((prev, current) => (prev.amount > current.amount) ? prev : current, { categoryName: 'None', amount: 0 });
    const topFeeCategoryObj = feeCategoryAnalysis.reduce((prev, current) => (prev.collected > current.collected) ? prev : current, { categoryName: 'None', collected: 0 });

    const executiveInsights = {
      highestPayingClass: highestPayingClassObj.className,
      highestPendingClass: highestPendingClassObj.className,
      highestRevenueMonth: highestRevenueMonthObj.month,
      highestExpenseMonth: highestExpenseMonthObj.month,
      topExpenseCategory: topExpenseCategoryObj.categoryName,
      topFeeCategory: topFeeCategoryObj.categoryName,
      averageRevenuePerStudent: totalStudentsCount > 0 ? Math.round(revenueAcademicYear / totalStudentsCount) : 0,
      averagePendingPerStudent: totalStudentsCount > 0 ? Math.round(totalPendingAmount / totalStudentsCount) : 0,
      averageExpensePerStudent: totalStudentsCount > 0 ? Math.round(expensesAcademicYear / totalStudentsCount) : 0,
      profitPerStudent: totalStudentsCount > 0 ? Math.round((revenueAcademicYear - expensesAcademicYear) / totalStudentsCount) : 0,
    };

    // ── STUDENT & EXPENSE DETAIL INSIGHTS ──
    const topPendingStudents = [...studentDues]
      .sort((a, b) => b.pending - a.pending)
      .slice(0, 10);

    const topPayingStudents = [...studentDues]
      .sort((a, b) => b.paid - a.paid)
      .slice(0, 10);

    const recentlyClearedDues = [...studentDues]
      .filter(d => d.pending === 0 && d.paid > 0)
      .slice(0, 10);

    const studentsNearDueDate = [...studentDues]
      .filter(d => d.pending > 0)
      .sort((a, b) => new Date(a.closeDate).getTime() - new Date(b.closeDate).getTime())
      .slice(0, 10);

    // Expense Insights
    const sortedExpenses = [...filteredExpenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const highestExpenseToday = allTimeExpensesList
      .filter(exp => new Date(exp.date).toDateString() === now.toDateString())
      .reduce((max, current) => (Number(current.amount) > max ? Number(current.amount) : max), 0);
    const highestExpenseThisMonth = allTimeExpensesList
      .filter(exp => new Date(exp.date) >= startOfMonth)
      .reduce((max, current) => (Number(current.amount) > max ? Number(current.amount) : max), 0);

    const expenseInsights = {
      recentExpenses: sortedExpenses.slice(0, 10).map(e => ({
        id: e.id,
        category: e.category,
        amount: Number(e.amount),
        date: e.date.toISOString().split('T')[0],
        description: e.description || '',
      })),
      highestExpenseToday,
      highestExpenseThisMonth,
      recurringExpenses: expenseCategoryAnalysis.slice(0, 3),
      upcomingExpenseReminders: budgetVsActual.filter(b => b.overBudget).map(b => `Alert: Category ${b.category} exceeded budget by ₹${b.excessAmount.toLocaleString()}`)
    };

    // ── FINANCIAL NOTIFICATIONS ──
    const notifications = [];
    if (collectionRateVal < 75) {
      notifications.push({
        type: 'CRITICAL',
        message: `Low school fee collection rate detected at ${Math.round(collectionRateVal)}% (Target: >90%).`
      });
    }
    const highestPending = highestPendingClassObj;
    if (highestPending && highestPending.totalPending > 50000) {
      notifications.push({
        type: 'WARNING',
        message: `High pending dues in class ${highestPending.className}: total ₹${highestPending.totalPending.toLocaleString()}.`
      });
    }
    const overBudgetList = budgetVsActual.filter(b => b.overBudget);
    for (const ob of overBudgetList) {
      notifications.push({
        type: 'WARNING',
        message: `Monthly expense budget exceeded for category "${ob.category}" by ₹${ob.excessAmount.toLocaleString()}.`
      });
    }
    if (expensesToday > 50000) {
      notifications.push({
        type: 'INFO',
        message: `Large expenses logged today: total ₹${expensesToday.toLocaleString()}.`
      });
    }
    if (netCashFlow < 0) {
      notifications.push({
        type: 'CRITICAL',
        message: `Negative net cash flow of -₹${Math.abs(netCashFlow).toLocaleString()} for selected period.`
      });
    }

    // ── FINANCIAL TIMELINE & RECENT ACTIVITIES ──
    const timeline = [];

    for (const inv of filteredInvoices) {
      timeline.push({
        id: inv.id,
        type: 'PAYMENT',
        title: `Fee Collected: ${inv.student.user.name}`,
        amount: Number(inv.paidAmount),
        date: inv.invoiceDate,
        description: `Method: ${inv.paymentMethod || 'CASH'} · Reference: ${inv.id.slice(-6)}`
      });
    }

    for (const exp of filteredExpenses) {
      timeline.push({
        id: exp.id,
        type: 'EXPENSE',
        title: `Expense Logged: ${exp.category}`,
        amount: -Number(exp.amount),
        date: exp.date,
        description: `${exp.description || 'No description'} · Mode: ${exp.paymentMode}`
      });
    }

    for (const student of studentProfiles) {
      const date = new Date(student.user.createdAt);
      if (startDate && endDate && (date < startDate || date > endDate)) continue;
      timeline.push({
        id: `adm-${student.id}`,
        type: 'ADMISSION',
        title: `New Admission: ${student.user.name}`,
        amount: 0,
        date,
        description: `Enrolled in class ${student.classSection ? classMap.get(student.classSection.classId) : 'N/A'}`
      });
    }

    const promotionLogs = await this.prisma.activityLog.findMany({
      where: {
        tenantId,
        action: 'RECORD_UPDATE',
        entityName: 'StudentProfile',
        details: { contains: 'Promoted from' },
        createdAt: startDate && endDate ? { gte: startDate, lte: endDate } : undefined
      }
    });

    for (const log of promotionLogs) {
      timeline.push({
        id: `prom-${log.id}`,
        type: 'PROMOTION',
        title: `Student Promoted`,
        amount: 0,
        date: log.createdAt,
        description: log.details || ''
      });
    }

    const voidedInvoicesTimeline = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        status: PaymentStatus.VOIDED,
        invoiceDate: startDate && endDate ? { gte: startDate, lte: endDate } : undefined
      },
      include: { student: { include: { user: true } } }
    });

    for (const inv of voidedInvoicesTimeline) {
      timeline.push({
        id: `void-${inv.id}`,
        type: 'ROLLBACK',
        title: `Invoice Rollback: ${inv.student.user.name}`,
        amount: -Number(inv.totalAmount),
        date: inv.invoiceDate,
        description: `Voided Invoice Reference: ${inv.id.slice(-6)}`
      });
    }

    timeline.sort((a, b) => b.date.getTime() - a.date.getTime());

    const recentActivitiesTimeline = timeline.slice(0, 30).map(t => ({
      ...t,
      dateStr: t.date.toISOString().split('T')[0]
    }));

    const latestPayments = filteredInvoices
      .sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime())
      .slice(0, 10)
      .map(inv => ({
        id: inv.id,
        studentName: inv.student.user.name,
        amount: Number(inv.paidAmount),
        date: inv.invoiceDate.toISOString().split('T')[0],
        method: inv.paymentMethod || 'CASH'
      }));

    const latestExpenses = filteredExpenses
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10)
      .map(e => ({
        id: e.id,
        category: e.category,
        amount: Number(e.amount),
        date: e.date.toISOString().split('T')[0],
        mode: e.paymentMode
      }));

    const voidedInvoices = await this.prisma.invoice.findMany({
      where: { tenantId, status: PaymentStatus.VOIDED },
      include: { student: { include: { user: true } } },
      orderBy: { invoiceDate: 'desc' },
      take: 10
    });

    const latestRollbacks = voidedInvoices.map(v => ({
      id: v.id,
      studentName: v.student.user.name,
      amount: Number(v.totalAmount),
      date: v.invoiceDate.toISOString().split('T')[0]
    }));

    const latestAdmissions = studentProfiles
      .sort((a, b) => new Date(b.user.createdAt).getTime() - new Date(a.user.createdAt).getTime())
      .slice(0, 10)
      .map(s => ({
        id: s.id,
        name: s.user.name,
        date: s.user.createdAt.toISOString().split('T')[0],
        class: s.classSection ? classMap.get(s.classSection.classId) : 'N/A'
      }));

    const latestFeeAdjustments = activeOpps
      .flatMap(opp => opp.opportunityLineItems.filter(oli => Number(oli.discount) > 0))
      .slice(0, 10)
      .map(oli => ({
        id: oli.id,
        productName: oli.product.name,
        discountPercent: Number(oli.discount),
        unitPrice: Number(oli.unitPrice)
      }));

    return {
      activeYearName: activeYear?.name || 'Current Year',
      summary: {
        revenue: {
          allTime: revenueAllTime,
          academicYear: revenueAcademicYear,
          currentMonth: revenueCurrentMonth,
          prevMonth: revenuePrevMonth,
          today: revenueToday,
          yesterday: revenueYesterday,
          thisWeek: revenueThisWeek,
          last30Days: revenueLast30Days,
          currentMonthInvoicesCount: paidInvoicesCountCurrentMonth,
          prevMonthInvoicesCount: paidInvoicesCountPrevMonth,
        },
        pending: {
          total: totalPendingAmount,
          studentsCount: pendingStudentsSet.size,
          overdue: overdueAmount,
          dueToday,
          dueThisWeek,
          dueThisMonth,
        },
        students: {
          total: totalStudentsCount,
          active: activeStudentsCount,
          paidCompletely: paidCompletelyCount,
          partiallyPaid: partiallyPaidCount,
          pending: pendingCount,
          newAdmissions: newAdmissionsCount,
          promoted: promotedCount,
        },
        expenses: {
          allTime: expensesAllTime,
          academicYear: expensesAcademicYear,
          currentMonth: expensesCurrentMonth,
          prevMonth: expensesPrevMonth,
          today: expensesToday,
          thisWeek: expensesThisWeek,
        },
        profit: {
          grossRevenue: totalCollectedFiltered,
          totalExpenses: totalExpensesFiltered,
          netProfit: totalCollectedFiltered - totalExpensesFiltered,
          profitMargin: totalCollectedFiltered > 0 ? Math.round(((totalCollectedFiltered - totalExpensesFiltered) / totalCollectedFiltered) * 1000) / 10 : 0,
          collectionRate: Math.round(collectionRateVal * 10) / 10,
          pendingPercentage: Math.round(pendingPercentageVal * 10) / 10,
        },
        cashFlow: {
          openingBalance,
          totalIncome: totalCollectedFiltered,
          totalExpenses: totalExpensesFiltered,
          closingBalance,
          expectedIncome,
          expectedExpenses,
          netCashFlow,
        },
        healthScore: healthIndicator,
      },
      growth: {
        revenue: revenueGrowthMonth,
        expense: expenseGrowthMonth,
        profit: profitGrowthMonth,
        collection: collectionGrowthMonth,
        student: studentGrowthMonth,
      },
      charts: {
        monthlyRevenue: monthlyIncome,
        monthlyExpenses,
        incomeVsExpense,
        dailyCollectionTrend,
        paymentMethodsDistribution,
        expenseCategoryAnalysis,
        feeCategoryAnalysis,
        outstandingByClass,
        outstandingBySection,
      },
      insights: {
        executive: executiveInsights,
        topPendingStudents,
        topPayingStudents,
        recentlyClearedDues,
        studentsNearDueDate,
        expense: expenseInsights,
      },
      notifications,
      timeline: recentActivitiesTimeline,
      activities: {
        latestPayments,
        latestExpenses,
        latestRollbacks,
        latestAdmissions,
        latestFeeAdjustments,
        latestRefunds: [],
      },
      kpis: {
        feeCollectionRate: Math.round(collectionRateVal * 10) / 10,
        expenseRatio: totalCollectedFiltered > 0 ? Math.round((totalExpensesFiltered / totalCollectedFiltered) * 100) : 0,
        avgFeePerStudent: totalStudentsCount > 0 ? Math.round((totalCollectedFiltered + totalPendingAmount) / totalStudentsCount) : 0,
        avgExpensePerStudent: totalStudentsCount > 0 ? Math.round(totalExpensesFiltered / totalStudentsCount) : 0,
        profitPerStudent: totalStudentsCount > 0 ? Math.round((totalCollectedFiltered - totalExpensesFiltered) / totalStudentsCount) : 0,
        revenuePerStudent: totalStudentsCount > 0 ? Math.round(totalCollectedFiltered / totalStudentsCount) : 0,
        outstandingRatio: (totalCollectedFiltered + totalPendingAmount) > 0 ? Math.round((totalPendingAmount / (totalCollectedFiltered + totalPendingAmount)) * 100) : 0,
        netMargin: totalCollectedFiltered > 0 ? Math.round(((totalCollectedFiltered - totalExpensesFiltered) / totalCollectedFiltered) * 100) : 0,
      },
      classes: allClasses.map(c => ({ id: c.id, name: c.name })),
      sections: allSections.map(s => ({ id: s.id, name: s.name })),
      academicYears: (await this.prisma.academicYear.findMany({ where: { tenantId } })).map(y => ({ id: y.id, name: y.name })),
    };
  }
}
