import { Injectable, BadRequestException, ConflictException, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TenantContext } from '../tenants/tenant.context';
import { Role, PaymentStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { StorageService } from '../common/storage.service';
import { BillingService } from '../billing/billing.service';

@Injectable()
export class StudentsService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
    private billingService: BillingService,
  ) {}

  async onModuleInit() {
    try {
      // Find all students with missing or invalid roll numbers
      const students = await this.prisma.studentProfile.findMany({
        where: {
          OR: [
            { rollNo: null },
            { rollNo: '' },
            { rollNo: 'N/A' },
            { rollNo: 'null' }
          ]
        },
        include: {
          classSection: true
        }
      });

      if (students.length === 0) return;

      console.log(`[RollNo Bootstrapper] Auto-assigning roll numbers for ${students.length} students...`);

      // Group students by ClassSection
      const groups: Record<string, typeof students> = {};
      for (const s of students) {
        if (!s.classSectionId) continue;
        if (!groups[s.classSectionId]) {
          groups[s.classSectionId] = [];
        }
        groups[s.classSectionId].push(s);
      }

      for (const [classSectionId, list] of Object.entries(groups)) {
        // Get all current valid roll numbers for this class section
        const existing = await this.prisma.studentProfile.findMany({
          where: {
            classSectionId,
            NOT: [
              { rollNo: null },
              { rollNo: '' },
              { rollNo: 'N/A' },
              { rollNo: 'null' }
            ]
          },
          select: { rollNo: true }
        });

        const parsedInts = existing
          .map(s => parseInt(s.rollNo || '', 10))
          .filter(val => !isNaN(val));

        let currentNext = parsedInts.length > 0 ? Math.max(...parsedInts) + 1 : 1;

        for (const student of list) {
          await this.prisma.studentProfile.update({
            where: { id: student.id },
            data: { rollNo: String(currentNext) }
          });
          currentNext++;
        }
      }
      console.log('[RollNo Bootstrapper] Successfully completed roll number auto-generation bootup hook.');
    } catch (err) {
      console.error('[RollNo Bootstrapper] Failed to run roll number bootstrapping hook:', err);
    }
  }

  private getTenantId(): string {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No active school tenant context found');
    }
    return tenantId;
  }

  async createStudent(data: any) {
    const tenantId = this.getTenantId();

    // ── Email: generate unique fallback if not provided ───────────────────────
    let emailLower: string;
    if (data.email && data.email.trim()) {
      emailLower = data.email.toLowerCase().trim();
    } else {
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const firstName = (data.firstName || data.name || 'student').toLowerCase().replace(/\s+/g, '');
      const lastName = (data.lastName || '').toLowerCase().replace(/\s+/g, '');
      emailLower = `${firstName}${lastName ? '.' + lastName : ''}.${randomSuffix}@noemail.local`;
    }

    // ── Email uniqueness check (globally unique field in DB) ──────────────────
    const existing = await this.prisma.user.findUnique({
      where: { email: emailLower },
    });
    if (existing) {
      throw new ConflictException('A user with this email is already registered in the system');
    }

    // ── Phone: prefix with tenantId to avoid cross-tenant uniqueness issues ───
    let normalizedPhone: string | null = null;
    if (data.phone && String(data.phone).trim()) {
      const digitsOnly = String(data.phone).replace(/\D/g, '').slice(-10);
      if (digitsOnly.length >= 10) {
        normalizedPhone = `${tenantId.substring(0, 8)}-${digitsOnly}`;
      }
    }

    const defaultPassword = data.password || 'Welcome@123';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    return this.prisma.$transaction(async (tx) => {
      let classSectionId = data.classSectionId;
      let matchedClassId = null;
      let matchedAcademicYearId = null;

      if (!classSectionId && data.selectedClass && data.selectedSection && data.academicYear) {
        const ay = await tx.academicYear.findFirst({
          where: { name: data.academicYear, tenantId }
        });
        if (ay) {
          matchedAcademicYearId = ay.id;
          const cls = await tx.class.findFirst({
            where: { name: data.selectedClass, academicYearId: ay.id, tenantId }
          });
          if (cls) {
            matchedClassId = cls.id;
            const sec = await tx.section.findFirst({
              where: { name: data.selectedSection, tenantId }
            });
            if (sec) {
              let cs = await tx.classSection.findFirst({
                where: { classId: cls.id, sectionId: sec.id, tenantId }
              });
              if (!cs) {
                cs = await tx.classSection.create({
                  data: {
                    classId: cls.id,
                    sectionId: sec.id,
                    tenantId,
                    strength: 0
                  }
                });
              }
              if (cs) {
                classSectionId = cs.id;
              }
            }
          }
        }
      } else if (classSectionId) {
        const cs = await tx.classSection.findUnique({
          where: { id: classSectionId },
          include: { class: true }
        });
        if (cs) {
          matchedClassId = cs.classId;
          matchedAcademicYearId = cs.class.academicYearId;
        }
      }

      const user = await tx.user.create({
        data: {
          email: emailLower,
          name: `${data.firstName} ${data.lastName}`,
          passwordHash,
          role: Role.STUDENT,
          phone: normalizedPhone,
          tenantId,
        },
      });

      let finalRollNo = data.rollNo ? String(data.rollNo).trim() : '';
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
      if (data.profilePhotoUrl && data.profilePhotoUrl.startsWith('data:')) {
        profilePhotoUrl = await this.storageService.uploadImage(data.profilePhotoUrl, tenantId, user.id, `student-${user.id}`);
      }

      const profile = await tx.studentProfile.create({
        data: {
          userId: user.id,
          rollNo: finalRollNo || null,
          fatherName: data.fatherName,
          motherName: data.motherName,
          aadharNo: data.aadharNo,
          classSectionId: classSectionId || null,
          profilePhotoUrl,
          tenantId,
        },
      });

      // Automated Invoice Generation during Onboarding
      const feeItems = data.feeItems || [];
      if (feeItems.length > 0) {
        const concessionVal = Number(data.concessionAmount) || 0;
        
        const processedItems = [...feeItems];
        if (concessionVal > 0) {
          processedItems.push({
            name: 'Discount Concession',
            amount: -concessionVal,
          });
        }

        const totalAmount = processedItems.reduce((sum, item) => sum + Number(item.amount), 0);

        const invoice = await tx.invoice.create({
          data: {
            studentId: profile.id,
            invoiceDate: new Date(),
            dueDate: new Date(new Date().setDate(new Date().getDate() + 30)),
            totalAmount,
            paidAmount: 0,
            remainingBalance: totalAmount,
            status: PaymentStatus.UNPAID,
            description: `Admission Fees Invoice for Academic Year ${data.academicYear || '2026-2027'}`,
            tenantId,
          },
        });

        await tx.invoiceItem.createMany({
          data: processedItems.map(item => ({
            invoiceId: invoice.id,
            name: item.name,
            amount: item.amount,
            tenantId,
          })),
        });
      }

      // Automatically sync student ledger with Price Book if class & academic year are resolved
      if (matchedClassId && matchedAcademicYearId) {
        await this.billingService.syncPriceBookToStudents(matchedClassId, matchedAcademicYearId, tx);
      }

      return { user, profile };
    });
  }

  async getStudentsBillingInfoBatch(studentIds: string[], tenantId: string, academicYearId?: string) {
    if (studentIds.length === 0) return {};

    // 1. Fetch all opportunities for all matching students
    const allOpps = await this.prisma.opportunity.findMany({
      where: {
        studentId: { in: studentIds },
        tenantId,
      },
      include: {
        academicYear: true,
        opportunityLineItems: {
          include: { product: true }
        },
        invoices: {
          where: {
            tenantId,
            status: { not: 'VOIDED' }
          },
          include: { invoiceItems: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 2. Fetch all standalone/orphan invoices for these students
    const allOrphanInvoices = await this.prisma.invoice.findMany({
      where: {
        studentId: { in: studentIds },
        tenantId,
        opportunityId: null,
        status: { in: ['UNPAID', 'PARTIALLY_PAID'] }
      }
    });

    // Map to group opportunities by studentId
    const oppsByStudent = new Map<string, typeof allOpps>();
    for (const opp of allOpps) {
      if (!oppsByStudent.has(opp.studentId)) {
        oppsByStudent.set(opp.studentId, []);
      }
      oppsByStudent.get(opp.studentId).push(opp);
    }

    // Map to group orphan invoices by studentId
    const orphansByStudent = new Map<string, typeof allOrphanInvoices>();
    for (const inv of allOrphanInvoices) {
      if (!orphansByStudent.has(inv.studentId)) {
        orphansByStudent.set(inv.studentId, []);
      }
      orphansByStudent.get(inv.studentId).push(inv);
    }

    const billingMap: Record<string, any> = {};
    const activeProductsCache = new Map<string, any[]>();
    const getActiveProductsCached = async (classId: string, ayId?: string) => {
      const cacheKey = `${classId}-${ayId || 'default'}`;
      if (activeProductsCache.has(cacheKey)) {
        return activeProductsCache.get(cacheKey);
      }
      const products = await this.billingService.getActiveProducts(classId, ayId);
      activeProductsCache.set(cacheKey, products);
      return products;
    };

    for (const studentId of studentIds) {
      const studentOpps = oppsByStudent.get(studentId) || [];
      const studentOrphans = orphansByStudent.get(studentId) || [];

      // Find open/active opportunity
      let openOpp: any = null;
      if (academicYearId) {
        openOpp = studentOpps.find(opp => opp.academicYearId === academicYearId);
      } else {
        openOpp = studentOpps.find(opp => !['Closed Won', 'Closed Lost'].includes(opp.stageName));
      }

      // Fallback to the latest opportunity overall if not found
      if (!openOpp) {
        openOpp = studentOpps[0] || null; // studentOpps is already ordered by createdAt desc
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

        // Fallback: If no line items, compute from class pricebook
        if (totalFee === 0 && openOpp.classId) {
          const pricebookProducts = await getActiveProductsCached(
            openOpp.classId,
            openOpp.academicYearId || undefined,
          );
          totalFee = pricebookProducts.reduce((sum, p) => sum + p.unitPrice, 0);
        }
      }

      // Determine currentYearStart
      let currentYearStart = new Date(0);
      if (academicYearId) {
        const cy = openOpp?.academicYearId === academicYearId ? openOpp.academicYear : allOpps.find(opp => opp.academicYearId === academicYearId)?.academicYear;
        if (cy) {
          currentYearStart = cy.startDate;
        } else {
          const academicYearRecord = await this.prisma.academicYear.findUnique({
            where: { id: academicYearId }
          });
          if (academicYearRecord) {
            currentYearStart = academicYearRecord.startDate;
          }
        }
      } else if (openOpp && openOpp.academicYear) {
        currentYearStart = openOpp.academicYear.startDate;
      }

      // Previous opportunities (lt currentYearStart)
      const prevOpps = studentOpps.filter(opp => opp.academicYear && new Date(opp.academicYear.startDate) < currentYearStart);

      const prevYearDuesMap = new Map<string, number>();
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

      // Standalone invoices before currentYearStart
      const prevOrphanInvoices = studentOrphans.filter(inv => new Date(inv.invoiceDate) < currentYearStart);
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

      billingMap[studentId] = {
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

    return billingMap;
  }

  async searchStudents(
    searchTerm?: string,
    classId?: string,
    sectionId?: string,
    academicYearId?: string,
    page?: number,
    limit?: number,
  ) {
    const tenantId = this.getTenantId();

    const where: any = {
      tenantId,
      user: {
        isActive: true
      },
      ...(searchTerm ? {
        OR: [
          { rollNo: { contains: searchTerm, mode: 'insensitive' } },
          {
            user: {
              OR: [
                { name: { contains: searchTerm, mode: 'insensitive' } },
                { email: { contains: searchTerm, mode: 'insensitive' } },
                { phone: { contains: searchTerm, mode: 'insensitive' } },
              ]
            }
          }
        ]
      } : {}),
      ...(classId || sectionId ? {
        classSection: {
          classId: classId || undefined,
          sectionId: sectionId || undefined,
        }
      } : {})
    };

    if (academicYearId) {
      if (where.classSection) {
        where.classSection.class = {
          academicYearId
        };
      } else {
        where.classSection = {
          class: {
            academicYearId
          }
        };
      }
    }

    const isPaginated = page !== undefined && limit !== undefined;
    const skip = isPaginated ? (page - 1) * limit : undefined;
    const take = isPaginated ? limit : undefined;

    const total = isPaginated
      ? await this.prisma.studentProfile.count({ where })
      : 0;

    const students = await this.prisma.studentProfile.findMany({
      where,
      select: {
        id: true,
        rollNo: true,
        fatherName: true,
        motherName: true,
        aadharNo: true,
        profilePhotoUrl: true,
        classSectionId: true,
        tenantId: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        },
        classSection: {
          select: {
            id: true,
            classId: true,
            sectionId: true,
            class: {
              select: {
                id: true,
                name: true,
                academicYearId: true,
              }
            },
            section: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        }
      },
      orderBy: {
        user: {
          name: 'asc'
        }
      },
      skip,
      take,
    });

    const studentIds = students.map(s => s.id);
    const billingMap = await this.getStudentsBillingInfoBatch(studentIds, tenantId, academicYearId);

    const data = students.map(s => {
      const billingInfo = billingMap[s.id] || {
        paidAmount: 0,
        balanceDue: 0,
        totalFees: 0,
        pendingPercentage: 0,
        paidPercentage: 100,
        financialStatus: 'Fully Paid (100%)',
        feeSummary: null
      };

      return {
        ...s,
        paidAmount: billingInfo.paidAmount,
        balanceDue: billingInfo.totalPendingBalance,
        totalFees: billingInfo.totalFees,
        pendingPercentage: billingInfo.pendingPercentage,
        paidPercentage: billingInfo.paidPercentage,
        financialStatus: billingInfo.financialStatus,
        feeSummary: billingInfo.feeSummary
      };
    });

    if (isPaginated) {
      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    }

    return data;
  }

  async getStudentDetails(studentId: string, academicYearId?: string) {
    const tenantId = this.getTenantId();

    const profile = await this.prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: {
        user: true,
        classSection: {
          include: {
            class: true,
            section: true,
          }
        },
        parentProfile: {
          include: {
            user: true,
          }
        },
        invoices: {
          where: { tenantId },
          include: { 
            invoiceItems: true,
            opportunity: {
              include: {
                academicYear: true
              }
            }
          },
          orderBy: { invoiceDate: 'desc' }
        },
        opportunities: {
          where: {
            tenantId,
          },
          include: {
            opportunityLineItems: {
              include: { product: true }
            }
          }
        },
        examMarks: {
          where: { tenantId },
          include: { exam: true, subject: true },
          orderBy: { exam: { date: 'desc' } }
        },
        attendances: {
          where: { tenantId },
          include: { attendanceSession: true },
          orderBy: { attendanceSession: { date: 'desc' } },
          take: 50,
        }
      }
    });

    if (!profile || profile.user.tenantId !== tenantId) {
      throw new NotFoundException('Student profile not found');
    }

    const billingInfo = await this.billingService.getStudentById(studentId, academicYearId);

    const selectedYear = academicYearId || profile.classSection?.class.academicYearId;
    const refOpp = profile.opportunities.find(opp => opp.academicYearId === selectedYear);

    let unpaidFees = [];
    if (refOpp) {
      unpaidFees = await this.billingService.getUnpaidFees(refOpp.id);
    }

    return {
      ...profile,
      paidAmount: billingInfo.paidAmount,
      balanceDue: billingInfo.totalPendingBalance,
      totalFees: billingInfo.totalFees,
      pendingPercentage: billingInfo.pendingPercentage,
      paidPercentage: billingInfo.paidPercentage,
      financialStatus: billingInfo.financialStatus,
      feeSummary: billingInfo.feeSummary,
      feeItems: unpaidFees
    };
  }

  // ── CSV BULK IMPORT FRAMEWORK ───────────────────────────────────────────────

  async importStudentsBulk(studentRows: any[]) {
    const tenantId = this.getTenantId();
    let successCount = 0;
    const errors: string[] = [];

    // Cache lists to resolve names to primary keys
    let ays = await this.prisma.academicYear.findMany({ where: { tenantId } });
    if (ays.length === 0) {
      const defaultYear = await this.prisma.academicYear.create({
        data: {
          name: '2026-2027',
          startDate: new Date('2026-06-01'),
          endDate: new Date('2027-04-30'),
          isActive: true,
          tenantId,
        },
      });
      ays = [defaultYear];
    }
    const activeYear = ays.find(ay => ay.isActive) || ays[0];
    const classes = await this.prisma.class.findMany({ where: { tenantId } });
    const sections = await this.prisma.section.findMany({ where: { tenantId } });
    const classSections = await this.prisma.classSection.findMany({
      where: { tenantId },
      include: { class: true, section: true }
    });

    const defaultPassword = 'Welcome@123';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    const affectedClasses = new Map<string, string>(); // classId -> academicYearId
    const affectedClassSectionIds = new Set<string>();

    // In-memory caches for the duration of this import batch to eliminate redundant queries
    const priceBookCache = new Map<string, { classPriceBook: any; pbes: any[] }>();
    const rollNoTracker = new Map<string, { nextRoll: number; existingRolls: Set<string> }>();

    // Concurrent transaction promises - all DB writes run in parallel for speed
    const txPromises: Promise<void>[] = [];

    for (let i = 0; i < studentRows.length; i++) {
      const row = studentRows[i];
      try {
        let firstName = (row['First Name'] || row['firstName'] || row['Name'] || row['Student Name'] || row['name'] || '').toString().trim();
        let lastName = (row['Last Name'] || row['lastName'] || '').toString().trim();

        // If only a single full name was provided in firstName and lastName is empty, split it
        if (firstName && !lastName && firstName.includes(' ')) {
          const parts = firstName.split(/\s+/);
          firstName = parts[0];
          lastName = parts.slice(1).join(' ');
        }

        const rawEmail = (row['Email'] || row['email'] || '').toString().trim();
        const phone = (row['Phone'] || row['phone'] || '').toString().trim();
        const className = (row['Class'] || row['class'] || row['Grade'] || row['grade'] || '').toString().trim();
        const sectionName = (row['Section'] || row['section'] || 'A').toString().trim();
        const rollNo = row['Roll No'] || row['rollNo'];
        const fatherName = (row['Father Name'] || row['fatherName'] || '').toString().trim() || null;
        const motherName = (row['Mother Name'] || row['motherName'] || '').toString().trim() || null;
        const aadharNo = (row['Aadhar No'] || row['aadharNo'] || '').toString().trim() || null;
        const ayStr = (row['Academic Year'] || row['academicYear'] || '').toString().trim();

        if (!className) {
          errors.push(`Row ${i + 1}: Missing mandatory field (Class)`);
          continue;
        }

        if (!firstName && !lastName) {
          errors.push(`Row ${i + 1}: Missing student name`);
          continue;
        }

        // Email: if provided, validate uniqueness. If not provided, generate fallback unique email
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

        const matchedAY = ays.find(ay => ay.name.toLowerCase() === (ayStr || '').toLowerCase().trim()) || activeYear;

        // Resolve class name
        let matchedClass = classes.find(c => c.name.toLowerCase() === className.toLowerCase().trim());
        if (!matchedClass && matchedAY) {
          matchedClass = await this.prisma.class.create({
            data: {
              name: className.trim(),
              academicYearId: matchedAY.id,
              tenantId
            }
          });
          classes.push(matchedClass);
        }

        if (!matchedClass) {
          errors.push(`Row ${i + 1}: Class "${className}" could not be resolved or created (No active academic year defined)`);
          continue;
        }

        // Resolve section name
        let matchedSection = sections.find(s => s.name.toLowerCase() === sectionName.toLowerCase().trim());
        if (!matchedSection) {
          matchedSection = await this.prisma.section.create({
            data: {
              name: sectionName.trim(),
              tenantId
            }
          });
          sections.push(matchedSection);
        }

        // Resolve classSection mapping
        let matchedClassSection = classSections.find(
          cs => cs.classId === matchedClass.id && cs.sectionId === matchedSection.id
        );

        if (!matchedClassSection) {
          matchedClassSection = await this.prisma.classSection.create({
            data: {
              classId: matchedClass.id,
              sectionId: matchedSection.id,
              tenantId,
              strength: 0
            },
            include: { class: true, section: true }
          });
          classSections.push(matchedClassSection);
        }

        affectedClasses.set(matchedClass.id, matchedAY.id);
        affectedClassSectionIds.add(matchedClassSection.id);

        let finalPhone: string | null = null;
        if (phone) {
          const digitsOnly = phone.replace(/\D/g, '').slice(-10);
          if (digitsOnly.length >= 10) {
            finalPhone = `${tenantId.substring(0, 8)}-${digitsOnly}`;
          }
        }

        // Resolve pricebook from in-memory batch cache or fetch once
        const pbCacheKey = `${matchedClass.id}:${matchedAY?.id || ''}`;
        let pbInfo = priceBookCache.get(pbCacheKey);
        if (!pbInfo) {
          const priceBookName = matchedClass.name.replace('-', ' ');
          const priceBookNameAlt = matchedClass.name.replace(' ', '-');

          const classPriceBook = await this.prisma.pricebook.findFirst({
            where: {
              tenantId,
              classId: matchedClass.id,
              academicYearId: matchedAY?.id || undefined,
              isActive: true
            },
          }) || await this.prisma.pricebook.findFirst({
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
            pbes = await this.prisma.pricebookEntry.findMany({
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
          pbInfo = { classPriceBook, pbes };
          priceBookCache.set(pbCacheKey, pbInfo);
        }

        // Resolve roll number from tracker or initial DB fetch once per section
        let rollInfo = rollNoTracker.get(matchedClassSection.id);
        if (!rollInfo) {
          const existingInCS = await this.prisma.studentProfile.findMany({
            where: { classSectionId: matchedClassSection.id, tenantId },
            select: { rollNo: true }
          });
          const existingRolls = new Set(existingInCS.map(s => s.rollNo?.trim()).filter(Boolean) as string[]);
          const parsedInts = existingInCS
            .map(s => parseInt(s.rollNo || '', 10))
            .filter(val => !isNaN(val));
          const nextRoll = parsedInts.length > 0 ? Math.max(...parsedInts) + 1 : 1;
          rollInfo = { nextRoll, existingRolls };
          rollNoTracker.set(matchedClassSection.id, rollInfo);
        }

        let finalRollNo = rollNo ? String(rollNo).trim() : '';
        if (!finalRollNo || rollInfo.existingRolls.has(finalRollNo)) {
          finalRollNo = String(rollInfo.nextRoll);
          rollInfo.nextRoll++;
        }
        rollInfo.existingRolls.add(finalRollNo);

        // Perform user creation transaction with 30s timeout and fast execution
        // Defer transaction to concurrent execution array
        txPromises.push((async () => {
          try {
            await this.prisma.$transaction(async (tx) => {
              const user = await tx.user.create({
                data: {
                  email: emailLower,
                  name: `${firstName || ''} ${lastName}`.trim(),
                  passwordHash,
                  role: Role.STUDENT,
                  phone: finalPhone,
                  tenantId,
                }
              });

              const profile = await tx.studentProfile.create({
                data: {
                  userId: user.id,
                  rollNo: finalRollNo || null,
                  fatherName,
                  motherName,
                  aadharNo: aadharNo ? String(aadharNo) : null,
                  classSectionId: matchedClassSection.id,
                  tenantId,
                }
              });

              if (pbInfo.classPriceBook && pbInfo.pbes.length > 0) {
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

                const olis = pbInfo.pbes.map((pbe: any) => ({
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
        })());
      } catch (err: any) {
        errors.push(`Row ${i + 1} Error: ${err.message}`);
      }
    }

    // Await all concurrent transactions
    await Promise.all(txPromises);


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
        await this.billingService.syncPriceBookToStudents(classId, ayId);
      } catch (e) {
        console.warn(`Post-import pricebook sync skipped for class ${classId}:`, e);
      }
    }

    return {
      totalRows: studentRows.length,
      successCount,
      errors,
    };
  }

  async getPromotionCandidates(sourceYearId: string, className?: string, sectionName?: string) {
    const tenantId = this.getTenantId();

    const students = await this.prisma.studentProfile.findMany({
      where: {
        user: { tenantId, isActive: true },
        classSection: {
          class: {
            academicYearId: sourceYearId,
            name: className && className !== 'ALL' ? className : undefined,
          },
          section: {
            name: sectionName ? sectionName : undefined,
          }
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        },
        classSection: {
          include: {
            class: true,
            section: true,
          }
        },
        invoices: {
          where: { tenantId },
          select: {
            totalAmount: true,
            paidAmount: true,
            remainingBalance: true,
            status: true,
          }
        }
      },
      orderBy: {
        user: { name: 'asc' }
      }
    });

    return Promise.all(students.map(async s => {
      const billingInfo = await this.billingService.getStudentById(s.id);

      return {
        id: s.id,
        name: s.user.name,
        email: s.user.email,
        rollNo: s.rollNo || '',
        class: s.classSection?.class.name || '',
        section: s.classSection?.section.name || '',
        fatherName: s.fatherName || '',
        motherName: s.motherName || '',
        aadharNo: s.aadharNo || '',
        phone: s.user.phone || '',
        balanceDue: billingInfo.totalPendingBalance,
        paidAmount: billingInfo.paidAmount,
        totalFees: billingInfo.totalFees,
        pendingPercentage: billingInfo.pendingPercentage,
        paidPercentage: billingInfo.paidPercentage,
        financialStatus: billingInfo.financialStatus,
        parentEmail: '',
        profilePhotoUrl: s.profilePhotoUrl || null,
      };
    }));
  }

  async promoteStudents(payload: {
    studentIds: string[];
    sourceYearId: string;
    targetYearId: string;
    targetClassName: string;
    targetSectionName?: string;
  }) {
    try {
      const tenantId = this.getTenantId();
      const { studentIds, sourceYearId, targetYearId, targetClassName, targetSectionName } = payload;

      if (!studentIds || studentIds.length === 0) {
        throw new BadRequestException('No students selected for promotion');
      }

      const isBulkGlobal = targetClassName === 'ALL';

      const sourceYear = await this.prisma.academicYear.findFirst({
        where: { id: sourceYearId, tenantId }
      });
      const targetYear = await this.prisma.academicYear.findFirst({
        where: { id: targetYearId, tenantId }
      });
      if (!sourceYear || !targetYear) {
        throw new NotFoundException('Source or Target Academic Year not found');
      }

      const classes = await this.prisma.class.findMany({
        where: { academicYearId: targetYearId, tenantId }
      });
      const sections = await this.prisma.section.findMany({
        where: { tenantId }
      });
      const classSections = await this.prisma.classSection.findMany({
        where: { tenantId },
        include: { class: true, section: true }
      });

      // 1. Fetch all student billing balances OUTSIDE the transaction first to prevent NestJS/Prisma deadlocks/timeouts.
      const studentBillingMap = new Map<string, number>();
      for (const studentId of studentIds) {
        const billingInfo = await this.billingService.getStudentById(studentId);
        studentBillingMap.set(studentId, billingInfo.totalPendingBalance);
      }

      return await this.prisma.$transaction(async (tx) => {
        const promotedCount = studentIds.length;
        let studentsWithCarriedForwardDues = 0;
        let totalCarriedForwardAmount = 0;
        const studentOutstandingBalances = [];
        const targetClassYearPairs = new Map<string, { classId: string; targetYearId: string }>();

        for (const studentId of studentIds) {
          const profile = await tx.studentProfile.findFirst({
            where: { id: studentId, user: { tenantId } },
            include: {
              user: true,
              classSection: {
                include: { class: true, section: true }
              }
            }
          });

          if (!profile) continue;

          const currentClassName = profile.classSection?.class.name;
          const currentSectionName = profile.classSection?.section.name;

          const resolvedClassName = isBulkGlobal 
            ? getNextClass(currentClassName)
            : targetClassName;

          if (!resolvedClassName) continue;

          let targetClass = classes.find(
            c => c.name.toLowerCase() === resolvedClassName.toLowerCase()
          );
          if (!targetClass) {
            const existingTargetClass = await tx.class.findFirst({
              where: {
                name: resolvedClassName,
                academicYearId: targetYearId,
                tenantId
              }
            });
            if (existingTargetClass) {
              targetClass = existingTargetClass;
            } else {
              targetClass = await tx.class.create({
                data: {
                  name: resolvedClassName,
                  academicYearId: targetYearId,
                  tenantId,
                  isActive: true
                }
              });
            }
            classes.push(targetClass);
          }

          const pairKey = `${targetClass.id}-${targetYearId}`;
          if (!targetClassYearPairs.has(pairKey)) {
            targetClassYearPairs.set(pairKey, { classId: targetClass.id, targetYearId });
          }

          const resolvedSectionName = targetSectionName || currentSectionName || 'Section A';
          const targetSection = sections.find(
            s => s.name.toLowerCase() === resolvedSectionName.toLowerCase()
          );
          if (!targetSection) {
            throw new BadRequestException(`Section "${resolvedSectionName}" not found`);
          }

          let targetClassSection = classSections.find(
            cs => cs.classId === targetClass.id && cs.sectionId === targetSection.id
          );

          if (!targetClassSection) {
            const existingClassSection = await tx.classSection.findFirst({
              where: { classId: targetClass.id, sectionId: targetSection.id, tenantId },
              include: { class: true, section: true }
            });
            if (existingClassSection) {
              targetClassSection = existingClassSection;
            } else {
              targetClassSection = await tx.classSection.create({
                data: {
                  classId: targetClass.id,
                  sectionId: targetSection.id,
                  tenantId,
                  strength: 0
                },
                include: { class: true, section: true }
              });
            }
            classSections.push(targetClassSection);
          }

          const existingInCS = await tx.studentProfile.findMany({
            where: { classSectionId: targetClassSection.id, tenantId },
            select: { rollNo: true }
          });
          const parsedInts = existingInCS
            .map(s => parseInt(s.rollNo || '', 10))
            .filter(val => !isNaN(val));
          const nextRoll = parsedInts.length > 0 ? Math.max(...parsedInts) + 1 : 1;

          await tx.studentProfile.update({
            where: { id: studentId },
            data: { 
              classSectionId: targetClassSection.id,
              rollNo: String(nextRoll)
            }
          });

          // ── Use the pre-fetched billing balance as the single source of truth.
          const carriedForwardDue = studentBillingMap.get(studentId) || 0;

          if (carriedForwardDue > 0) {
            studentsWithCarriedForwardDues++;
            totalCarriedForwardAmount += carriedForwardDue;
          }

          // ── Resolve the real target-year pricebook for this class (single source of truth).
          // Fall back: try by classId + academicYearId first, then by name pattern.
          let targetPricebook = await tx.pricebook.findFirst({
            where: { tenantId, classId: targetClass.id, academicYearId: targetYearId, isActive: true }
          });
          if (!targetPricebook) {
            const priceBookName = resolvedClassName.replace('-', ' ');
            const priceBookNameAlt = resolvedClassName.replace(' ', '-');
            targetPricebook = await tx.pricebook.findFirst({
              where: {
                tenantId,
                isActive: true,
                academicYearId: targetYearId,
                OR: [
                  { name: { equals: priceBookName, mode: 'insensitive' } },
                  { name: { equals: priceBookNameAlt, mode: 'insensitive' } },
                  { name: { startsWith: priceBookName, mode: 'insensitive' } },
                  { name: { startsWith: priceBookNameAlt, mode: 'insensitive' } },
                ],
              }
            });
          }

          // Fetch active pricebook entries (excluding PREV_DUES meta-products)
          const pbes = targetPricebook
            ? await tx.pricebookEntry.findMany({
                where: {
                  tenantId,
                  isActive: true,
                  pricebookId: targetPricebook.id,
                  product: {
                    isActive: true,
                    productCode: { not: 'PREV_DUES' },
                    name: { not: { contains: 'Previous' } },
                  },
                },
                include: { product: true },
              })
            : [];

          // ── 1. Create target-year Opportunity
          const oppName = `${profile.user.name} - Promotion to ${resolvedClassName} - ${targetYear.name}`;
          const newOpportunity = await tx.opportunity.create({
            data: {
              name: oppName,
              studentId,
              stageName: 'Prospecting',
              closeDate: new Date(new Date().setDate(new Date().getDate() + 30)),
              classId: targetClass.id,
              sectionId: targetClassSection.sectionId,
              academicYearId: targetYearId,
              totalPaidAmount: 0,
              tenantId
            }
          });

          // ── 2. Attach real fee products from pricebook as OpportunityLineItems
          if (pbes.length > 0) {
            await tx.opportunityLineItem.createMany({
              data: pbes.map(pbe => ({
                opportunityId: newOpportunity.id,
                pricebookEntryId: pbe.id,
                productId: pbe.productId,
                quantity: 1,
                unitPrice: pbe.unitPrice,
                discount: 0,
                tenantId,
              }))
            });
          }

          // ── 3. Create a single UNPAID Invoice for the target-year fees (if pricebook entries exist).
          //       Previous-year balances are NOT duplicated — they stay on historical invoices and are
          //       surfaced virtually by BillingService.getUnpaidFees as "Previous Year Balance Brought Forward".
          if (pbes.length > 0) {
            const totalAmount = pbes.reduce((sum, pbe) => sum + Number(pbe.unitPrice), 0);
            const newInvoice = await tx.invoice.create({
              data: {
                opportunityId: newOpportunity.id,
                studentId,
                invoiceDate: new Date(),
                dueDate: new Date(new Date().setDate(new Date().getDate() + 30)),
                totalAmount,
                paidAmount: 0,
                remainingBalance: totalAmount,
                status: PaymentStatus.UNPAID,
                description: `Fees Invoice for ${resolvedClassName} — ${targetYear.name}`,
                tenantId
              }
            });

            await tx.invoiceItem.createMany({
              data: pbes.map(pbe => ({
                invoiceId: newInvoice.id,
                name: pbe.product.name,
                amount: Number(pbe.unitPrice),
                tenantId,
              }))
            });
          }

          studentOutstandingBalances.push({
            name: profile.user.name,
            rollNo: profile.rollNo || 'N/A',
            class: currentClassName || resolvedClassName,
            targetClass: resolvedClassName,
            carriedForwardAmount: carriedForwardDue,
            newYearFees: pbes.reduce((sum, pbe) => sum + Number(pbe.unitPrice), 0),
            totalOutstanding: carriedForwardDue + pbes.reduce((sum, pbe) => sum + Number(pbe.unitPrice), 0),
          });

          await tx.activityLog.create({
            data: {
              userId: profile.userId,
              action: 'RECORD_UPDATE',
              entityName: 'StudentProfile',
              entityId: studentId,
              details: `Promoted from ${currentClassName || '—'} (${currentSectionName || '—'}) to ${resolvedClassName} (${resolvedSectionName})`,
              tenantId
            }
          });
        }

        // Run Price Book synchronization for all target class-year cohorts
        for (const pair of targetClassYearPairs.values()) {
          await this.billingService.syncPriceBookToStudents(pair.classId, pair.targetYearId, tx);
        }

        return {
          success: true,
          promotedCount,
          studentsWithCarriedForwardDues,
          totalCarriedForwardAmount,
          studentOutstandingBalances
        };
      }, { timeout: 30000 });
    } catch (err: any) {
      console.error('Promotion transaction error:', err);
      throw new BadRequestException(`Promotion failed: ${err.message || err}`);
    }
  }

  // (constructor is defined once at the top of the class)

  async validatePromotion(payload: { studentIds: string[]; sourceYearId: string }) {
    try {
      const tenantId = this.getTenantId();
      const { studentIds, sourceYearId } = payload;

      if (!studentIds || studentIds.length === 0) {
        throw new BadRequestException('No students selected for validation');
      }

      // Fetch student profile details for display (name, class, section, rollNo)
      const profiles = await this.prisma.studentProfile.findMany({
        where: { id: { in: studentIds }, tenantId },
        include: {
          user: { select: { name: true } },
          classSection: { include: { class: true, section: true } },
        }
      });
      const profileMap = new Map(profiles.map(p => [p.id, p]));

      // Resolve source year name for display
      const sourceAcademicYear = await this.prisma.academicYear.findFirst({
        where: { id: sourceYearId, tenantId },
        select: { name: true }
      });
      const sourceYearName = sourceAcademicYear?.name || '';

      // ── Use BillingService as the single source of truth for each student's pending balance.
      // getStudentById already accounts for discounts, partial payments, and split invoices.
      let totalOutstandingDue = 0;
      let totalCarriedForwardAmount = 0;
      let studentsWithDue = 0;
      const dueList = [] as any[];

      for (const sid of studentIds) {
        const details = await this.billingService.getStudentById(sid);
        const pending = details.totalPendingBalance;
        const prevYearDue = details.feeSummary?.previousYears?.reduce(
          (sum: number, yr: any) => sum + yr.outstandingBalance, 0
        ) || 0;

        if (pending > 0) {
          studentsWithDue++;
          totalOutstandingDue += pending;
          totalCarriedForwardAmount += prevYearDue;
        }

        const profile = profileMap.get(sid);
        dueList.push({
          studentId: sid,
          name: profile?.user?.name || 'Unknown',
          rollNo: profile?.rollNo || '—',
          class: profile?.classSection?.class?.name || '—',
          section: profile?.classSection?.section?.name || '—',
          sourceYear: sourceYearName,
          pendingDue: pending,
          previousYearDue: prevYearDue,
        });
      }

      const totalSelected = studentIds.length;
      const studentsWithoutDue = totalSelected - studentsWithDue;

      return {
        totalSelected,
        studentsWithPendingDue: studentsWithDue,
        studentsWithNoDue: studentsWithoutDue,
        totalOutstandingDue,
        totalCarriedForwardAmount,
        dueList,
      };
    } catch (err: any) {
      console.error('Error validating promotion:', err);
      throw new BadRequestException(`Validation failed: ${err.message || err}`);
    }
  }

  async getParents() {
    const tenantId = this.getTenantId();
    return this.prisma.parentProfile.findMany({
      where: {
        user: { tenantId }
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true }
        },
        students: {
          include: {
            user: { select: { name: true } }
          }
        }
      },
      orderBy: {
        user: { name: 'asc' }
      }
    });
  }

  async deleteStudent(studentId: string) {
    const tenantId = this.getTenantId();

    const profile = await this.prisma.studentProfile.findUnique({
        where: { id: studentId },
        include: { user: true },
    });
    if (!profile || profile.user.tenantId !== tenantId) {
        throw new NotFoundException('Student profile not found');
    }

    // Delete profile photo if exists
    if (profile.profilePhotoUrl) {
        await this.storageService.deleteImage(profile.profilePhotoUrl);
    }

    await this.prisma.user.delete({
        where: { id: profile.userId },
    });

    return { success: true };
  }

  // Update student details (name, email, phone, profile fields)
  async updateStudent(studentId: string, data: any) {
    const tenantId = this.getTenantId();
    await this.prisma.$transaction(async (tx) => {
      const profile = await tx.studentProfile.findUnique({
        where: { id: studentId },
        include: { user: true },
      });
      if (!profile || profile.user.tenantId !== tenantId) {
        throw new NotFoundException('Student profile not found');
      }

      // Prepare user updates
      const userUpdates: any = {};
      if (data.name) {
        userUpdates.name = data.name.trim();
      } else if (data.firstName || data.lastName) {
        const name = `${data.firstName || ''} ${data.lastName || ''}`.trim();
        userUpdates.name = name;
      }
      
      if (data.email) {
        const emailLower = data.email.toLowerCase().trim();
        const emailExists = await tx.user.findFirst({
          where: {
            email: emailLower,
            id: { not: profile.userId }
          }
        });
        if (emailExists) {
          throw new ConflictException('Email address is already in use by another user');
        }
        userUpdates.email = emailLower;
      }

      if (data.phone) {
        const normalizedPhone = data.phone.replace(/\D/g, '').slice(-10);
        if (normalizedPhone) {
          userUpdates.phone = normalizedPhone;
        }
      }

      if (Object.keys(userUpdates).length) {
        await tx.user.update({ where: { id: profile.userId }, data: userUpdates });
      }

      // Prepare student profile updates
      const profileUpdates: any = {};
      if (data.fatherName !== undefined) profileUpdates.fatherName = data.fatherName;
      if (data.motherName !== undefined) profileUpdates.motherName = data.motherName;
      if (data.aadharNo !== undefined) profileUpdates.aadharNo = data.aadharNo;
      if (data.rollNo !== undefined) profileUpdates.rollNo = data.rollNo;
      if (data.classSectionId !== undefined) profileUpdates.classSectionId = data.classSectionId;

      if (data.profilePhotoUrl !== undefined) {
        if (data.profilePhotoUrl === null || data.profilePhotoUrl === '') {
          // Remove existing photo if any
          if (profile.profilePhotoUrl) {
            await this.storageService.deleteImage(profile.profilePhotoUrl);
          }
          profileUpdates.profilePhotoUrl = null;
        } else if (data.profilePhotoUrl.startsWith('data:')) {
          // Delete old photo before uploading new one
          if (profile.profilePhotoUrl) {
            await this.storageService.deleteImage(profile.profilePhotoUrl);
          }
          profileUpdates.profilePhotoUrl = await this.storageService.uploadImage(data.profilePhotoUrl, tenantId, profile.userId, `student-${profile.userId}`);
        }
      }

      if (Object.keys(profileUpdates).length) {
        await tx.studentProfile.update({ where: { id: studentId }, data: profileUpdates });
      }
    });

    // Return refreshed details after transaction commits and releases locks
    return this.getStudentDetails(studentId);
  }

  async bulkDeleteStudents(studentIds: string[], actorUserId: string) {
    const tenantId = this.getTenantId();

    // Verify all students belong to the active tenant
    const profiles = await this.prisma.studentProfile.findMany({
      where: {
        id: { in: studentIds },
        tenantId
      },
      select: {
        id: true,
        userId: true
      }
    });

    const userIds = profiles.map(p => p.userId);

    if (userIds.length === 0) {
      return { success: true, count: 0 };
    }

    // Strictly verify count matches. If any requested studentId is missing or belongs to another tenant, fail the transaction.
    if (profiles.length !== studentIds.length) {
      throw new BadRequestException('One or more selected students do not exist or belong to another tenant.');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        // Delete all matching User records (which triggers DB-level cascades to all student-dependent records)
        await tx.user.deleteMany({
          where: {
            id: { in: userIds },
            tenantId
          }
        });

        // Record the bulk deletion in the ActivityLog (Audit Log)
        await tx.activityLog.create({
          data: {
            userId: actorUserId,
            action: 'RECORD_DELETE',
            entityName: 'StudentProfile',
            entityId: 'BULK_DELETE',
            details: JSON.stringify({
              deletedCount: userIds.length,
              studentIds: studentIds,
              timestamp: new Date().toISOString(),
            }),
            tenantId
          }
        });
      });

      return { success: true, count: userIds.length };
    } catch (err: any) {
      console.error('Prisma transaction failed during bulk delete:', err);
      throw new BadRequestException(`Failed to delete students transactionally: ${err.message}`);
    }
  }

  // ── STUDENT LIFECYCLE MANAGEMENT ───────────────────────────────────────────

  async updateStudentLifecycleStatus(actorUserId: string, payload: {
    studentId: string;
    status: string; // LEFT, TRANSFERRED, WITHDRAWN, GRADUATED
    reason?: string;
    effectiveDate?: string;
    lastClassName?: string;
    lastSectionName?: string;
    academicYearId?: string;
    notes?: string;
  }) {
    const tenantId = this.getTenantId();
    const { studentId, status, reason, effectiveDate, lastClassName, lastSectionName, academicYearId, notes } = payload;

    const student = await this.prisma.studentProfile.findFirst({
      where: { id: studentId, tenantId },
      include: {
        user: true,
        classSection: {
          include: {
            class: true,
            section: true,
          }
        }
      }
    });

    if (!student) {
      throw new NotFoundException('Student profile not found.');
    }

    const currentClass = lastClassName || student.classSection?.class.name || '—';
    const currentSection = lastSectionName || student.classSection?.section.name || '—';
    const resolvedYearId = academicYearId || student.classSection?.class.academicYearId || null;
    const resolvedEffectiveDate = effectiveDate ? new Date(effectiveDate) : new Date();

    const remarksPayload = {
      status,
      reason: reason || status,
      effectiveDate: resolvedEffectiveDate.toISOString(),
      lastClass: currentClass,
      lastSection: currentSection,
      academicYearId: resolvedYearId,
      notes: notes || '',
    };

    // Update user and student profile
    await this.prisma.user.update({
      where: { id: student.userId },
      data: { isActive: false }
    });

    await this.prisma.studentProfile.update({
      where: { id: studentId },
      data: { classSectionId: null }
    });

    // Record in StatusHistory
    await this.prisma.statusHistory.create({
      data: {
        entityType: 'STUDENT_LIFECYCLE',
        entityId: studentId,
        previousStatus: 'ACTIVE',
        currentStatus: status,
        remarks: JSON.stringify(remarksPayload),
        updatedById: actorUserId,
        tenantId,
      }
    });

    // Record audit ActivityLog
    await this.prisma.activityLog.create({
      data: {
        userId: student.userId,
        action: 'RECORD_UPDATE',
        entityName: 'StudentLifecycle',
        entityId: studentId,
        details: `Student marked as ${status} from ${currentClass} - ${currentSection}. Reason: ${reason || status}. Notes: ${notes || 'None'}`,
        tenantId,
      }
    });

    return {
      success: true,
      message: `Student successfully updated to status: ${status}.`,
      studentId,
      status,
    };
  }

  async bulkUpdateStudentLifecycleStatus(actorUserId: string, payload: {
    studentIds: string[];
    status: string;
    reason?: string;
    effectiveDate?: string;
    academicYearId?: string;
    notes?: string;
  }) {
    const { studentIds, status, reason, effectiveDate, academicYearId, notes } = payload;
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      throw new BadRequestException('No students provided for lifecycle update.');
    }

    let successCount = 0;
    const errors: string[] = [];

    for (const studentId of studentIds) {
      try {
        await this.updateStudentLifecycleStatus(actorUserId, {
          studentId,
          status,
          reason,
          effectiveDate,
          academicYearId,
          notes,
        });
        successCount++;
      } catch (err: any) {
        errors.push(`Failed for student ${studentId}: ${err.message}`);
      }
    }

    return {
      success: true,
      totalRequested: studentIds.length,
      successCount,
      errors,
    };
  }

  async getHistoricalStudents(filters: {
    status?: string;
    search?: string;
    academicYearId?: string;
    className?: string;
    sectionName?: string;
  }) {
    const tenantId = this.getTenantId();
    const { status, search, academicYearId, className, sectionName } = filters;

    // Fetch all student profiles for tenant
    const profiles = await this.prisma.studentProfile.findMany({
      where: {
        tenantId,
        ...(search ? {
          OR: [
            { rollNo: { contains: search, mode: 'insensitive' } },
            { fatherName: { contains: search, mode: 'insensitive' } },
            { motherName: { contains: search, mode: 'insensitive' } },
            {
              user: {
                OR: [
                  { name: { contains: search, mode: 'insensitive' } },
                  { email: { contains: search, mode: 'insensitive' } },
                  { phone: { contains: search, mode: 'insensitive' } },
                ]
              }
            }
          ]
        } : {})
      },
      include: {
        user: true,
        classSection: {
          include: {
            class: true,
            section: true,
          }
        },
        parentProfile: {
          include: {
            user: true,
          }
        }
      },
      orderBy: { user: { name: 'asc' } },
    });

    // Fetch all lifecycle StatusHistory records for this tenant
    const statusHistories = await this.prisma.statusHistory.findMany({
      where: {
        tenantId,
        entityType: 'STUDENT_LIFECYCLE',
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group status histories by studentId (latest first)
    const historiesByStudent = new Map<string, any[]>();
    for (const sh of statusHistories) {
      if (!historiesByStudent.has(sh.entityId)) {
        historiesByStudent.set(sh.entityId, []);
      }
      historiesByStudent.get(sh.entityId).push(sh);
    }

    // Map each profile to its lifecycle representation
    const results = profiles.map((p) => {
      const studentHistoryList = historiesByStudent.get(p.id) || [];
      const latestHistory = studentHistoryList[0] || null;

      let parsedRemarks: any = {};
      if (latestHistory?.remarks) {
        try {
          parsedRemarks = JSON.parse(latestHistory.remarks);
        } catch {
          parsedRemarks = { notes: latestHistory.remarks };
        }
      }

      // Determine current lifecycle state
      let lifecycleStatus = 'ACTIVE';
      if (!p.user.isActive) {
        lifecycleStatus = latestHistory?.currentStatus || 'LEFT';
      } else if (latestHistory?.currentStatus === 'ACTIVE') {
        lifecycleStatus = 'ACTIVE';
      }

      const lastClass = parsedRemarks.lastClass || p.classSection?.class.name || '—';
      const lastSection = parsedRemarks.lastSection || p.classSection?.section.name || '—';
      const effectiveDate = parsedRemarks.effectiveDate || latestHistory?.createdAt || p.user.updatedAt;

      // Clean phone
      let parentPhone = p.fatherPhone || p.motherPhone || p.parentProfile?.user?.phone || 'N/A';
      if (parentPhone && parentPhone.includes('-')) {
        const parts = parentPhone.split('-');
        const lastPart = parts[parts.length - 1];
        if (/^\d{7,15}$/.test(lastPart)) parentPhone = lastPart;
      }

      return {
        id: p.id,
        userId: p.userId,
        name: p.user.name,
        email: p.user.email,
        phone: p.user.phone,
        rollNo: p.rollNo || '—',
        avatarUrl: p.user.avatarUrl || p.profilePhotoUrl || null,
        fatherName: p.fatherName || '—',
        motherName: p.motherName || '—',
        parentPhone,
        isActive: p.user.isActive,
        lifecycleStatus,
        lastClass,
        lastSection,
        effectiveDate,
        reason: parsedRemarks.reason || latestHistory?.remarks || '—',
        notes: parsedRemarks.notes || '',
        historyCount: studentHistoryList.length,
      };
    });

    // Filter by lifecycleStatus if requested
    let filtered = results;
    if (status && status !== 'ALL') {
      filtered = filtered.filter(r => r.lifecycleStatus.toUpperCase() === status.toUpperCase());
    }

    if (className && className !== 'ALL') {
      filtered = filtered.filter(r => r.lastClass.toLowerCase() === className.toLowerCase());
    }

    if (sectionName && sectionName !== 'ALL') {
      filtered = filtered.filter(r => r.lastSection.toLowerCase() === sectionName.toLowerCase());
    }

    return filtered;
  }

  async reEnrollStudent(actorUserId: string, payload: {
    studentId: string;
    targetYearId: string;
    targetClassId: string;
    targetSectionId: string;
    rollNo?: string;
    notes?: string;
  }) {
    const tenantId = this.getTenantId();
    const { studentId, targetYearId, targetClassId, targetSectionId, rollNo, notes } = payload;

    const student = await this.prisma.studentProfile.findFirst({
      where: { id: studentId, tenantId },
      include: { user: true }
    });

    if (!student) {
      throw new NotFoundException('Student profile not found.');
    }

    // Verify or find ClassSection
    let classSection = await this.prisma.classSection.findFirst({
      where: {
        classId: targetClassId,
        sectionId: targetSectionId,
        tenantId,
      },
      include: { class: true, section: true }
    });

    if (!classSection) {
      classSection = await this.prisma.classSection.create({
        data: {
          classId: targetClassId,
          sectionId: targetSectionId,
          tenantId,
        },
        include: { class: true, section: true }
      });
    }

    // Resolve roll number if not provided
    let resolvedRollNo = rollNo;
    if (!resolvedRollNo) {
      const existingInCS = await this.prisma.studentProfile.findMany({
        where: { classSectionId: classSection.id, tenantId },
        select: { rollNo: true }
      });
      const parsedInts = existingInCS
        .map(s => parseInt(s.rollNo || '', 10))
        .filter(val => !isNaN(val));
      resolvedRollNo = String(parsedInts.length > 0 ? Math.max(...parsedInts) + 1 : 1);
    }

    // Re-activate user and attach studentProfile
    await this.prisma.user.update({
      where: { id: student.userId },
      data: { isActive: true }
    });

    await this.prisma.studentProfile.update({
      where: { id: studentId },
      data: {
        classSectionId: classSection.id,
        rollNo: resolvedRollNo,
      }
    });

    // Record in StatusHistory
    await this.prisma.statusHistory.create({
      data: {
        entityType: 'STUDENT_LIFECYCLE',
        entityId: studentId,
        previousStatus: 'FORMER',
        currentStatus: 'ACTIVE',
        remarks: JSON.stringify({
          action: 'RE_ENROLL',
          targetClass: classSection.class.name,
          targetSection: classSection.section.name,
          academicYearId: targetYearId,
          reEnrolledAt: new Date().toISOString(),
          notes: notes || 'Student re-enrolled into school',
        }),
        updatedById: actorUserId,
        tenantId,
      }
    });

    // Audit log
    await this.prisma.activityLog.create({
      data: {
        userId: student.userId,
        action: 'RECORD_UPDATE',
        entityName: 'StudentLifecycle',
        entityId: studentId,
        details: `Student re-enrolled into ${classSection.class.name} - ${classSection.section.name} (Roll: ${resolvedRollNo})`,
        tenantId,
      }
    });

    return {
      success: true,
      message: `Student re-enrolled successfully into ${classSection.class.name} - ${classSection.section.name}.`,
      studentId,
      rollNo: resolvedRollNo,
    };
  }

  async getCompleteStudentHistory(studentId: string) {
    const tenantId = this.getTenantId();

    const student = await this.prisma.studentProfile.findFirst({
      where: { id: studentId, tenantId },
      include: {
        user: true,
        classSection: {
          include: {
            class: true,
            section: true,
          }
        },
        parentProfile: {
          include: {
            user: true,
          }
        },
        invoices: {
          where: { tenantId },
          include: {
            invoiceItems: true,
            opportunity: {
              include: { academicYear: true }
            }
          },
          orderBy: { invoiceDate: 'desc' }
        },
        opportunities: {
          where: { tenantId },
          include: {
            academicYear: true,
            opportunityLineItems: {
              include: { product: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        examMarks: {
          where: { tenantId },
          include: {
            exam: true,
            subject: true,
          },
          orderBy: { exam: { date: 'desc' } }
        },
        attendances: {
          where: { tenantId },
          include: {
            attendanceSession: true,
          },
          orderBy: { attendanceSession: { date: 'desc' } },
          take: 100,
        }
      }
    });

    if (!student) {
      throw new NotFoundException('Student record not found.');
    }

    // 1. Fetch Lifecycle StatusHistory
    const statusHistories = await this.prisma.statusHistory.findMany({
      where: {
        tenantId,
        entityType: 'STUDENT_LIFECYCLE',
        entityId: studentId,
      },
      include: {
        updatedBy: {
          select: { name: true, email: true, role: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 2. Fetch ActivityLogs (Promotions, updates)
    const activityLogs = await this.prisma.activityLog.findMany({
      where: {
        tenantId,
        OR: [
          { entityId: studentId },
          { userId: student.userId }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // 3. Fetch Homework Submissions
    const homeworkSubmissions = await this.prisma.activityLog.findMany({
      where: {
        tenantId,
        action: 'SUBMIT_ASSIGNMENT',
        entityName: 'Homework',
      },
      orderBy: { createdAt: 'desc' },
    });

    const studentHomeworks = homeworkSubmissions
      .filter((log) => {
        try {
          const detail = JSON.parse(log.details || '{}');
          return detail.studentId === studentId;
        } catch {
          return false;
        }
      })
      .map((log) => {
        let detail: any = {};
        try {
          detail = JSON.parse(log.details || '{}');
        } catch {}
        return {
          id: log.id,
          homeworkId: log.entityId,
          fileName: detail.fileName || 'Attachment',
          fileUrl: detail.fileUrl || '',
          submittedAt: log.createdAt,
        };
      });

    // 4. Attendance Aggregates
    const allAttendance = await this.prisma.attendance.findMany({
      where: { studentId, tenantId },
      select: { status: true }
    });
    const totalSessions = allAttendance.length;
    const presentSessions = allAttendance.filter(a => a.status === 'PRESENT').length;
    const absentSessions = allAttendance.filter(a => a.status === 'ABSENT').length;
    const attendancePercentage = totalSessions > 0 ? Math.round((presentSessions / totalSessions) * 100) : 100;

    // 5. Complaints
    const complaints = await this.prisma.complaint.findMany({
      where: {
        tenantId,
        OR: [
          { submittedById: student.userId },
          ...(student.parentProfile?.userId ? [{ submittedById: student.parentProfile.userId }] : []),
          ...(student.classSectionId ? [{ classSectionId: student.classSectionId }] : [])
        ]
      },
      include: {
        submittedBy: { select: { name: true, role: true } },
        academicYear: { select: { name: true } }
      },
      orderBy: { id: 'desc' },
      take: 20,
    });

    // Parse status history remarks
    const parsedHistories = statusHistories.map((sh) => {
      let parsed: any = {};
      try {
        parsed = JSON.parse(sh.remarks || '{}');
      } catch {
        parsed = { notes: sh.remarks };
      }
      return {
        id: sh.id,
        currentStatus: sh.currentStatus,
        previousStatus: sh.previousStatus,
        date: sh.createdAt,
        updatedBy: sh.updatedBy?.name || 'Administrator',
        details: parsed,
      };
    });

    return {
      profile: {
        id: student.id,
        userId: student.userId,
        name: student.user.name,
        email: student.user.email,
        phone: student.user.phone,
        rollNo: student.rollNo || '—',
        avatarUrl: student.user.avatarUrl || student.profilePhotoUrl || null,
        fatherName: student.fatherName || '—',
        motherName: student.motherName || '—',
        aadharNo: student.aadharNo || '—',
        fatherPhone: student.fatherPhone || '—',
        motherPhone: student.motherPhone || '—',
        guardianPhone: student.guardianPhone || '—',
        isActive: student.user.isActive,
        currentClass: student.classSection ? `${student.classSection.class.name} - ${student.classSection.section.name}` : 'Not Enrolled (Former/Inactive)',
        parentName: student.parentProfile?.user?.name || student.fatherName || '—',
      },
      lifecycleHistories: parsedHistories,
      activityLogs: activityLogs.map(l => ({
        id: l.id,
        action: l.action,
        entityName: l.entityName,
        details: l.details,
        date: l.createdAt,
      })),
      academicHistory: student.opportunities.map(opp => ({
        id: opp.id,
        academicYear: opp.academicYear?.name || '—',
        stage: opp.stageName,
        date: opp.createdAt,
        totalFees: opp.opportunityLineItems.reduce((s, i) => s + (Number(i.unitPrice) * Number(i.quantity)), 0),
      })),
      attendance: {
        totalSessions,
        presentSessions,
        absentSessions,
        attendancePercentage,
        recentRecords: student.attendances.map(a => ({
          id: a.id,
          date: a.attendanceSession.date,
          status: a.status,
          reason: a.reason,
        }))
      },
      examMarks: student.examMarks.map(em => ({
        id: em.id,
        examName: em.exam.name,
        examDate: em.exam.date,
        subjectName: em.subject.name,
        subjectType: em.subjectType || 'Theory',
        marksObtained: Number(em.marksObtained),
        remarks: em.remarks || '—',
      })),
      homeworkSubmissions: studentHomeworks,
      feeInvoices: student.invoices.map(inv => ({
        id: inv.id,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate,
        totalAmount: Number(inv.totalAmount),
        paidAmount: Number(inv.paidAmount),
        remainingBalance: Number(inv.remainingBalance),
        status: inv.status,
        academicYear: inv.opportunity?.academicYear?.name || '—',
        items: inv.invoiceItems.map(item => ({
          id: item.id,
          name: item.name,
          amount: Number(item.amount),
        }))
      })),
      complaints: complaints.map(c => ({
        id: c.id,
        title: c.title,
        description: c.description,
        status: c.status,
        category: c.category,
        adminReply: c.adminReply,
        academicYear: c.academicYear?.name || '—',
      }))
    };
  }
}

function getNextClass(currentClass: string): string {
  const CLASS_ORDER = [
    'Nursery', 'LKG', 'UKG',
    'Class-1', 'Class-2', 'Class-3', 'Class-4', 'Class-5', 'Class-6', 'Class-7', 'Class-8', 'Class-9', 'Class-10',
    'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'
  ];
  if (!currentClass) return '';
  const normalized = currentClass.trim().replace(/\s+/g, ' ');
  const normalizedWithDash = currentClass.trim().replace(/\s+/g, '-');
  
  let idx = CLASS_ORDER.findIndex(c => c.toLowerCase() === normalized.toLowerCase() || c.toLowerCase() === normalizedWithDash.toLowerCase());
  if (idx >= 0 && idx < CLASS_ORDER.length - 1) {
    const currentIsGrade = normalized.toLowerCase().startsWith('grade');
    const nextClass = CLASS_ORDER[idx + 1];
    const nextIsGrade = nextClass.toLowerCase().startsWith('grade');
    if (currentIsGrade === nextIsGrade) {
      return nextClass;
    }
  }
  
  const salesforceOrder = [
    'Nursery', 'LKG', 'UKG',
    'Class-1', 'Class-2', 'Class-3', 'Class-4', 'Class-5', 'Class-6', 'Class-7', 'Class-8', 'Class-9', 'Class-10'
  ];
  const gradeOrder = [
    'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'
  ];
  
  let salesforceIdx = salesforceOrder.findIndex(c => c.toLowerCase() === normalizedWithDash.toLowerCase() || c.toLowerCase() === normalized.toLowerCase());
  if (salesforceIdx >= 0 && salesforceIdx < salesforceOrder.length - 1) {
    return salesforceOrder[salesforceIdx + 1];
  }
  
  let gradeIdx = gradeOrder.findIndex(c => c.toLowerCase() === normalized.toLowerCase() || c.toLowerCase() === normalizedWithDash.toLowerCase());
  if (gradeIdx >= 0 && gradeIdx < gradeOrder.length - 1) {
    return gradeOrder[gradeIdx + 1];
  }
  
  return '';
}

