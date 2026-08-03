import { Injectable, BadRequestException, NotFoundException, ConflictException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TenantContext } from '../tenants/tenant.context';
import { PaymentStatus, PaymentMethod, Role } from '@prisma/client';
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

    // Validate student subscription limits
    const sub = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId },
      include: { plan: true }
    });
    if (sub && sub.plan.studentLimit !== null) {
      const activeStudentsCount = await this.prisma.studentProfile.count({
        where: { tenantId }
      });
      if (activeStudentsCount >= sub.plan.studentLimit) {
        throw new HttpException(
          {
            error: 'quota_exceeded',
            message: `Student limit of ${sub.plan.studentLimit} reached for your subscription plan. Please upgrade to add more students.`,
          },
          HttpStatus.TOO_MANY_REQUESTS
        );
      }
    }

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

    for (let i = 0; i < studentDataList.length; i++) {
      const data = studentDataList[i];
      try {
        const firstName = data['First Name'] || data['firstName'];
        const lastName = data['Last Name'] || data['lastName'];
        const email = data['Email'] || data['email'];
        const phone = data['Phone'] || data['phone'];
        const classStr = data['Class'] || data['class'];
        const sectionStr = data['Section'] || data['section'];
        const ayStr = data['Academic Year'] || data['academicYear'];

        if (!email || !lastName || !classStr || !sectionStr) {
          errors.push(`Row ${i + 1}: Missing mandatory fields (Email, Last Name, Class, Section)`);
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

        const emailLower = email.toLowerCase().trim();
        const existingUser = await this.prisma.user.findUnique({ where: { email: emailLower } });
        if (existingUser) {
          errors.push(`Row ${i + 1}: Email "${email}" is already registered`);
          continue;
        }

        await this.prisma.$transaction(async (tx) => {
          // Create User
          const user = await tx.user.create({
            data: {
              email: emailLower,
              name: `${firstName || ''} ${lastName}`.trim(),
              passwordHash,
              role: Role.STUDENT,
              phone: phone ? String(phone) : null,
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

          // Resolve class pricebook & entries
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

          if (!classPriceBook) {
            throw new Error(`No active Price Book (fee structure) configured for class "${matchedClass.name}"`);
          }

          const pbes = await tx.pricebookEntry.findMany({
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

          if (pbes.length === 0) {
            throw new Error(`No active fee products found in the Price Book for class "${matchedClass.name}"`);
          }

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

          // Trigger sync to ensure ledger is fully initialized & recalculated
          await this.syncPriceBookToStudents(matchedClass.id, matchedAY.id, tx);
        });

        successCount++;
      } catch (err) {
        errors.push(`Row ${i + 1} Error: ${err.message}`);
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

    return this.prisma.$transaction(async (tx) => {
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

      // Return the updated pricebook
      const finalPb = await tx.pricebook.findUnique({
        where: { id: pricebook.id },
        include: {
          pricebookEntries: {
            where: { isActive: true },
            include: { product: true },
          },
        },
      });

      // Synchronize all students in this class/academic year to the updated price book
      await this.syncPriceBookToStudents(classId, academicYearId, tx);

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
    }, { timeout: 30000 });
  }

  async syncPriceBookToStudents(classId: string, academicYearId: string, tx?: any) {
    const tenantId = this.getTenantId();
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

    // 2. Find all student profiles currently enrolled in this class
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

    for (const student of students) {
      // Find or create Opportunity for this student for this academic year
      let opp = student.opportunities[0];
      if (!opp) {
        const ay = await db.academicYear.findUnique({ where: { id: academicYearId } });
        const classRecord = await db.class.findUnique({ where: { id: classId } });
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
          // Update unitPrice if it has changed
          if (Number(existingOli.unitPrice) !== Number(entry.unitPrice)) {
            await db.opportunityLineItem.update({
              where: { id: existingOli.id },
              data: { unitPrice: entry.unitPrice }
            });
          }
        } else {
          // Create new line item
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

      // B. Remove line items that are no longer assigned in the Price Book (only if they have no payment history)
      for (const oli of currentOlis) {
        // Skip meta-products
        if (oli.product.productCode === 'PREV_DUES' || oli.product.name.includes('Previous Year')) {
          continue;
        }

        const inPricebook = activeEntries.some(e => e.productId === oli.productId);
        if (!inPricebook) {
          // Check if this OLI has any non-voided payment history
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
            // Delete the line item
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
        // Fetch latest OLIs for this opportunity to rebuild invoice items
        const updatedOlis = await db.opportunityLineItem.findMany({
          where: { opportunityId: opp.id, tenantId },
          include: { product: true }
        });

        // Delete existing items for this invoice
        await db.invoiceItem.deleteMany({
          where: { invoiceId: inv.id }
        });

        // Recreate new items
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

        // Update the invoice total amount and remaining balance
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

      // Recalculate opportunity paid amount
      await this.recalculatePaidAmount(opp.id, db);
    }
  }
}
