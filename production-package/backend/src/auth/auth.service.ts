import { Injectable, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import * as crypto from 'crypto';
import { FirebaseAdminService } from './firebase-admin.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  private failedAttemptsMap = new Map<string, { count: number; blockedUntil: Date }>();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private firebaseAdminService: FirebaseAdminService,
    private configService: ConfigService,
  ) {}

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (user && await bcrypt.compare(pass, user.passwordHash)) {
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user.id, role: user.role, tenantId: user.tenantId };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        tenantId: user.tenantId,
      }
    };
  }

  async sendOtp(phone: string, portal?: string): Promise<any> {
    const normalizedPhone = phone.replace(/\D/g, '').slice(-10);
    let targetTenantId: string | undefined;

    // If portal parameter is provided, validate role match before dispatching OTP
    if (portal) {
      const p = portal.toLowerCase();
      const users = await this.prisma.user.findMany({
        where: { phone: { endsWith: normalizedPhone } }
      });

      const matchingStudents = await this.prisma.studentProfile.findMany({
        where: {
          OR: [
            { user: { phone: { endsWith: normalizedPhone } } },
            { fatherPhone: { endsWith: normalizedPhone } },
            { motherPhone: { endsWith: normalizedPhone } },
            { guardianPhone: { endsWith: normalizedPhone } }
          ]
        }
      });

      const isAdmin = users.some(u => u.role === Role.SCHOOL_ADMIN || u.role === Role.SUPER_ADMIN || (u.role as string) === 'ADMIN');
      const isTeacher = users.some(u => u.role === Role.TEACHER || u.role === Role.STAFF || u.role === Role.DRIVER);
      const isParent = users.some(u => u.role === Role.PARENT) || matchingStudents.length > 0;
      const isStudent = users.some(u => u.role === Role.STUDENT);

      const userExists = users.length > 0 || matchingStudents.length > 0;

      if (p === 'admin') {
        if (!isAdmin) {
          if (userExists) {
            throw new BadRequestException('This mobile number is not authorized for the Administrator portal. Please log in through the appropriate portal.');
          }
          return {
            success: false,
            notFound: true,
            redirectToRegister: true,
            message: 'School Administrator account not found. Redirecting to School Registration page...'
          };
        }
        const matchedUser = users.find(u => u.role === Role.SCHOOL_ADMIN || u.role === Role.SUPER_ADMIN || (u.role as string) === 'ADMIN');
        if (matchedUser) targetTenantId = matchedUser.tenantId;
      } else if (p === 'teacher') {
        if (!isTeacher) {
          if (userExists) {
            throw new BadRequestException('This mobile number is not authorized for the Teacher Portal. Please log in through the appropriate portal.');
          }
          return {
            success: false,
            notFound: true,
            portal: 'teacher',
            message: 'Teacher or Driver account not found. Please contact your School Administrator to obtain portal access.'
          };
        }
        const matchedUser = users.find(u => u.role === Role.TEACHER || u.role === Role.STAFF || u.role === Role.DRIVER);
        if (matchedUser) targetTenantId = matchedUser.tenantId;
      } else if (p === 'parent') {
        if (!isParent) {
          if (userExists) {
            throw new BadRequestException('This mobile number is not authorized for the Parent Portal. Please log in through the appropriate portal.');
          }
          return {
            success: false,
            notFound: true,
            portal: 'parent',
            message: 'Parent account not found. Please contact your School Administrator to obtain Parent Portal access.'
          };
        }
        const matchedUser = users.find(u => u.role === Role.PARENT);
        if (matchedUser) {
          targetTenantId = matchedUser.tenantId;
        } else if (matchingStudents.length > 0) {
          targetTenantId = matchingStudents[0].tenantId;
        }
      } else if (p === 'student') {
        if (!isStudent) {
          if (userExists) {
            throw new BadRequestException('This mobile number is not authorized for the Student Desk. Please log in through the appropriate portal.');
          }
          return {
            success: false,
            notFound: true,
            portal: 'student',
            message: 'Student account not found. Please contact your School Administrator to obtain Student Desk access.'
          };
        }
        const matchedUser = users.find(u => u.role === Role.STUDENT);
        if (matchedUser) targetTenantId = matchedUser.tenantId;
      }
    } else {
      const user = await this.prisma.user.findFirst({
        where: { phone: { endsWith: normalizedPhone } },
        select: { tenantId: true },
      });
      if (user) targetTenantId = user.tenantId;
    }

    const isSecurityDisabled = this.configService.get<string>('DISABLE_OTP_SECURITY') === 'true';

    if (!isSecurityDisabled) {
      // Cooldown check (60 seconds)
      const lastRequest = await this.prisma.otpRequest.findFirst({
        where: { phone: normalizedPhone },
        orderBy: { createdAt: 'desc' },
      });
      if (lastRequest) {
        const now = new Date();
        const diffMs = now.getTime() - lastRequest.createdAt.getTime();
        if (diffMs < 60 * 1000) {
          const remainingSec = Math.ceil((60 * 1000 - diffMs) / 1000);
          throw new BadRequestException(`Please wait ${remainingSec} seconds before requesting a new OTP.`);
        }
      }

      // Hourly rate limit check (max 5 requests per hour)
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);
      const hourlyRequestCount = await this.prisma.otpRequest.count({
        where: {
          phone: normalizedPhone,
          createdAt: { gte: oneHourAgo },
        },
      });
      if (hourlyRequestCount >= 5) {
        throw new BadRequestException('Too many OTP requests. Maximum 5 requests per hour. Please try again later.');
      }
    }

    // Invalidate previous OTP requests by setting their expiry to the past
    await this.prisma.otpRequest.updateMany({
      where: { phone: normalizedPhone, expiresAt: { gt: new Date() } },
      data: { expiresAt: new Date(0) }
    }).catch(() => {});

    // Cleanup old expired OTP requests (older than 24 hours) to keep the table clean
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    await this.prisma.otpRequest.deleteMany({
      where: { phone: normalizedPhone, createdAt: { lt: oneDayAgo } }
    }).catch(() => {});

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    // Create tracking record for rate limiting with "FIREBASE_PENDING" placeholder
    await this.prisma.otpRequest.create({
      data: {
        phone: normalizedPhone,
        otpCode: 'FIREBASE_PENDING',
        expiresAt,
      },
    });

    // Look up if there is a registered user with this phone → return their school branding
    let schoolName: string | undefined;
    let logoUrl: string | undefined;

    try {
      if (targetTenantId) {
        const [tenant, setup] = await Promise.all([
          this.prisma.tenant.findUnique({
            where: { id: targetTenantId },
            select: { name: true, logoUrl: true },
          }),
          this.prisma.schoolSetup.findUnique({
            where: { tenantId: targetTenantId },
            select: { schoolName: true, schoolLogo: true },
          }),
        ]);

        schoolName = setup?.schoolName || tenant?.name || undefined;
        logoUrl = setup?.schoolLogo || tenant?.logoUrl || undefined;
      }
    } catch (e) {
      // Non-critical — branding lookup failure should not block OTP
    }

    return {
      success: true,
      message: 'OTP request authorized successfully',
      ...(schoolName ? { schoolName } : {}),
      ...(logoUrl ? { logoUrl } : {}),
    };
  }

  async verifyOtp(phone: string, otpCode: string, portal?: string, generateCode?: boolean): Promise<any> {
    const normalizedPhone = phone.replace(/\D/g, '').slice(-10);
    const isSecurityDisabled = this.configService.get<string>('DISABLE_OTP_SECURITY') === 'true';

    // Check brute-force block status (only if security is active)
    const blockInfo = this.failedAttemptsMap.get(normalizedPhone);
    if (!isSecurityDisabled && blockInfo && blockInfo.blockedUntil > new Date()) {
      const remainingMin = Math.ceil((blockInfo.blockedUntil.getTime() - new Date().getTime()) / 60000);
      throw new UnauthorizedException(`Too many failed attempts. This number is locked for another ${remainingMin} minutes.`);
    }

    let verifiedPhoneRaw: string;
    try {
      if (isSecurityDisabled && (otpCode === 'MOCK_FIREBASE_ID_TOKEN' || !this.firebaseAdminService.isInitialized())) {
        verifiedPhoneRaw = normalizedPhone;
      } else {
        verifiedPhoneRaw = await this.firebaseAdminService.verifyIdToken(otpCode);
      }
    } catch (error) {
      if (isSecurityDisabled) {
        verifiedPhoneRaw = normalizedPhone;
      } else {
        // Handle lockout on verification failures
        const currentAttempts = blockInfo ? blockInfo.count + 1 : 1;
        if (currentAttempts >= 5) {
          const blockedUntil = new Date();
          blockedUntil.setMinutes(blockedUntil.getMinutes() + 15);
          this.failedAttemptsMap.set(normalizedPhone, { count: currentAttempts, blockedUntil });
          throw new UnauthorizedException('Too many failed attempts. This phone number has been locked for 15 minutes.');
        } else {
          const blockedUntil = new Date(0);
          this.failedAttemptsMap.set(normalizedPhone, { count: currentAttempts, blockedUntil });
          throw error;
        }
      }
    }

    const verifiedPhone = verifiedPhoneRaw.replace(/\D/g, '').slice(-10);
    if (verifiedPhone !== normalizedPhone) {
      throw new UnauthorizedException('Phone number verification mismatch.');
    }

    if (!isSecurityDisabled) {
      const request = await this.prisma.otpRequest.findFirst({
        where: {
          phone: normalizedPhone,
          otpCode: 'FIREBASE_PENDING',
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!request) {
        throw new UnauthorizedException('No active authentication request found. Please request a new verification code.');
      }

      // Success -> clear failed attempts
      this.failedAttemptsMap.delete(normalizedPhone);

      // Clean up used OTP tracker
      await this.prisma.otpRequest.delete({
        where: { id: request.id },
      }).catch(() => {}); // ignore cleanup error if any
    } else {
      // Success under disabled security -> still clear local map to be safe
      this.failedAttemptsMap.delete(normalizedPhone);
    }

    // --- AUTO-ASSOCIATION FOR PARENTS AND STUDENTS ---
    // Search for students linked to this phone number only if Parent Portal is selected
    if (portal && portal.toLowerCase() === 'parent') {
      const matchingStudents = await this.prisma.studentProfile.findMany({
        where: {
          OR: [
            { user: { phone: { endsWith: normalizedPhone } } },
            { fatherPhone: { endsWith: normalizedPhone } },
            { motherPhone: { endsWith: normalizedPhone } },
            { guardianPhone: { endsWith: normalizedPhone } }
          ]
        },
        include: {
          user: true
        }
      });

      let parentUser = await this.prisma.user.findFirst({
        where: {
          role: Role.PARENT,
          phone: { endsWith: normalizedPhone }
        },
        include: {
          parentProfile: true
        }
      });

      if (matchingStudents.length > 0) {
        const firstStudent = matchingStudents[0];
        const tenantId = firstStudent.tenantId;

        if (!parentUser) {
          const parentName = firstStudent.fatherName || firstStudent.motherName || `Parent of ${firstStudent.user.name}`;
          const parentEmail = `parent.${normalizedPhone}@edutrack.local`;
          const passwordHash = await bcrypt.hash('Welcome@123', 10);
          const parentPhone = `${tenantId.substring(0, 8)}-${normalizedPhone}`;

          parentUser = await this.prisma.$transaction(async (tx) => {
            let existing = await tx.user.findFirst({
              where: {
                OR: [
                  { email: parentEmail },
                  { phone: parentPhone, role: Role.PARENT }
                ]
              },
              include: { parentProfile: true }
            });
            if (existing) return existing;

            const user = await tx.user.create({
              data: {
                email: parentEmail,
                name: parentName,
                passwordHash,
                role: Role.PARENT,
                phone: parentPhone,
                tenantId,
              }
            });

            const profile = await tx.parentProfile.create({
              data: {
                userId: user.id,
              }
            });

            return {
              ...user,
              parentProfile: profile
            } as any;
          });
        }

        // Link students to the parent profile
        if (parentUser && parentUser.parentProfile) {
          for (const student of matchingStudents) {
            let relationship = "Guardian";
            if (student.fatherPhone && student.fatherPhone.replace(/\D/g, '').endsWith(normalizedPhone)) {
              relationship = "Father";
            } else if (student.motherPhone && student.motherPhone.replace(/\D/g, '').endsWith(normalizedPhone)) {
              relationship = "Mother";
            }

            await this.prisma.parentStudent.upsert({
              where: {
                parentId_studentId: {
                  parentId: parentUser.parentProfile.id,
                  studentId: student.id
                }
              },
              update: {},
              create: {
                parentId: parentUser.parentProfile.id,
                studentId: student.id,
                relationship,
                isPrimary: true
              }
            }).catch(() => {});

            // Also set legacy field for backward compatibility
            if (student.parentProfileId !== parentUser.parentProfile.id) {
              await this.prisma.studentProfile.update({
                where: { id: student.id },
                data: { parentProfileId: parentUser.parentProfile.id }
              }).catch(() => {});
            }
          }
        }
      }
    }

    // Determine target role based on selected portal
    let user: any = null;

    if (portal) {
      const p = portal.toLowerCase();
      if (p === 'parent') {
        user = await this.prisma.user.findFirst({
          where: {
            phone: { endsWith: normalizedPhone },
            role: Role.PARENT
          },
        });
      } else if (p === 'student') {
        user = await this.prisma.user.findFirst({
          where: {
            phone: { endsWith: normalizedPhone },
            role: Role.STUDENT
          },
        });
      } else if (p === 'teacher') {
        user = await this.prisma.user.findFirst({
          where: {
            phone: { endsWith: normalizedPhone },
            role: { in: [Role.TEACHER, Role.STAFF, Role.DRIVER] }
          },
        });
      } else if (p === 'admin') {
        user = await this.prisma.user.findFirst({
          where: {
            phone: { endsWith: normalizedPhone },
            role: { in: [Role.SCHOOL_ADMIN, Role.SUPER_ADMIN] }
          },
        });
      }
    } else {
      // Fallback role selection when no portal param is provided
      user = await this.prisma.user.findFirst({
        where: {
          phone: { endsWith: normalizedPhone }
        },
      });
    }

    if (!user) {
      if (portal && portal.toLowerCase() !== 'admin') {
        throw new BadRequestException('Account not found for the selected portal. Please contact your School Administrator.');
      }
      return {
        registered: false,
        phone,
      };
    }

    const loginResult = await this.login(user);
    if (generateCode) {
      const codePayload = {
        type: 'auth_code',
        userId: user.id,
        tenantId: user.tenantId,
        access_token: loginResult.access_token,
        user: loginResult.user
      };
      const code = this.jwtService.sign(codePayload, { expiresIn: '30s' });
      return {
        registered: true,
        code
      };
    }

    return {
      registered: true,
      ...loginResult,
    };
  }

  private usedCodes = new Set<string>();

  async exchangeCode(code: string): Promise<any> {
    if (this.usedCodes.has(code)) {
      throw new UnauthorizedException('Authorization code has already been used.');
    }

    try {
      const payload = this.jwtService.verify(code);
      if (payload.type !== 'auth_code') {
        throw new UnauthorizedException('Invalid authorization code.');
      }

      this.usedCodes.add(code);
      setTimeout(() => {
        this.usedCodes.delete(code);
      }, 35000);

      return {
        access_token: payload.access_token,
        user: payload.user
      };
    } catch (e: any) {
      throw new UnauthorizedException(`Authorization code validation failed: ${e.message}`);
    }
  }

  async register(data: any, tenantId: string) {
    const emailLower = data.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({
      where: { email: emailLower },
    });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await this.hashPassword(data.password);
    const normalizedPhone = data.phone ? data.phone.replace(/\D/g, '').slice(-10) : data.phone;
    
    // Create user and profile extensions within a single ACID database transaction
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: emailLower,
          passwordHash,
          name: data.name,
          role: data.role,
          phone: normalizedPhone,
          tenantId,
        },
      });

      if (data.role === Role.STUDENT) {
        await tx.studentProfile.create({
          data: {
            userId: user.id,
            rollNo: data.rollNo,
            fatherName: data.fatherName,
            motherName: data.motherName,
            aadharNo: data.aadharNo,
            classSectionId: data.classSectionId,
            tenantId,
          },
        });
      } else if (
        data.role === Role.TEACHER || 
        data.role === Role.STAFF || 
        data.role === Role.SCHOOL_ADMIN
      ) {
        await tx.staffProfile.create({
          data: {
            userId: user.id,
            employeeId: data.employeeId,
            designation: data.designation,
            basicSalary: data.basicSalary,
            allowances: data.allowances,
            deductions: data.deductions,
            pfDeduction: data.pfDeduction,
            joiningDate: data.joiningDate ? new Date(data.joiningDate) : new Date(),
            status: 'Active',
            qualification: data.qualification,
            subjectsTaught: data.subjectsTaught || [],
            tenantId,
          },
        });
      } else if (data.role === Role.PARENT) {
        await tx.parentProfile.create({
          data: {
            userId: user.id,
            emergencyContact: data.emergencyContact,
          },
        });
      }

      const { passwordHash: _, ...result } = user;
      return result;
    });
  }
}
