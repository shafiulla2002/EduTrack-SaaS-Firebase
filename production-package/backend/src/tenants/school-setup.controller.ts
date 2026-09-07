import { Controller, Put, Body, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('school-setup')
export class SchoolSetupController {
  constructor(private prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard)
  @Put()
  async updateSetup(@Req() req: any, @Body() body: any) {
    const tenantId = req.user.tenantId;

    // Filter incoming payload fields to match schema
    const allowedFields = [
      'schoolName',
      'schoolType',
      'adminName',
      'mobileNumber',
      'email',
      'address',
      'academicYear',
      'principalName',
      'country',
      'state',
      'district',
      'city',
      'postalCode',
      'schoolLogo',
    ];

    const updateData: any = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (body.subdomain) {
      const cleanSubdomain = String(body.subdomain).trim().toLowerCase().replace(/[^a-z0-9\-]/g, '');
      if (!cleanSubdomain) {
        throw new BadRequestException('Subdomain must contain alphanumeric characters or hyphens');
      }
      const existing = await this.prisma.tenant.findFirst({
        where: {
          subDomain: cleanSubdomain,
          NOT: { id: tenantId }
        }
      });
      if (existing) {
        throw new BadRequestException('This school subdomain is already in use.');
      }
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { subDomain: cleanSubdomain }
      });
    }

    const setup = await this.prisma.schoolSetup.upsert({
      where: { tenantId },
      update: updateData,
      create: {
        tenantId,
        schoolName: updateData.schoolName || '',
        schoolType: updateData.schoolType || 'School',
        adminName: updateData.adminName || '',
        mobileNumber: updateData.mobileNumber || '',
        email: updateData.email || '',
        address: updateData.address || '',
        academicYear: updateData.academicYear || '',
        ...updateData,
      },
    });

    // Check if the setup is fully completed (all 13 profile fields are filled)
    const checkFields = [
      setup.schoolName, setup.schoolType, setup.adminName, setup.mobileNumber,
      setup.email, setup.address, setup.academicYear, setup.principalName,
      setup.country, setup.state, setup.district, setup.city, setup.postalCode
    ];

    const isCompleted = checkFields.every((val) => val && String(val).trim() !== '');

    if (isCompleted) {
      await this.prisma.schoolSetup.update({
        where: { tenantId },
        data: { isCompleted: true },
      });
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { setupCompleted: true },
      });
    } else {
      // In case they removed a field, reset status
      await this.prisma.schoolSetup.update({
        where: { tenantId },
        data: { isCompleted: false },
      });
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { setupCompleted: false },
      });
    }

    // Sync profile changes to matching fields in the Tenant database entry to avoid re-entry
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: setup.schoolName,
        address: setup.address,
        email: setup.email,
        phone: setup.mobileNumber,
        logoUrl: setup.schoolLogo,
        subtitle: setup.schoolType,
      },
    });

    // Sync admin name and avatar to User table for SCHOOL_ADMIN
    if (setup.adminName) {
      await this.prisma.user.updateMany({
        where: {
          tenantId,
          role: 'SCHOOL_ADMIN',
        },
        data: {
          name: setup.adminName,
        },
      });
    }
    if (body.adminAvatarUrl !== undefined) {
      await this.prisma.user.updateMany({
        where: {
          tenantId,
          role: 'SCHOOL_ADMIN',
        },
        data: {
          avatarUrl: body.adminAvatarUrl,
        },
      });
    }

    return {
      success: true,
      message: 'School setup updated successfully',
      setup,
    };
  }
}
