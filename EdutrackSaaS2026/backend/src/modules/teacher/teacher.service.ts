import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { randomUUID } from 'crypto';

@Injectable()
export class TeacherService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, data: { userId: string; department?: string }) {
    return this.prisma.staffProfile.create({
      data: {
        id: randomUUID(),
        userId: data.userId,
        employeeId: '', 
        designation: data.department,
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.staffProfile.findMany({
      where: { User: { tenantId } },
      include: { User: true },
    });
  }

  async findOne(id: string, tenantId: string) {
    return this.prisma.staffProfile.findFirst({
      where: { id, User: { tenantId } },
      include: { User: true },
    });
  }

  async update(id: string, tenantId: string, data: { department?: string }) {
    return this.prisma.staffProfile.update({
      where: { id },
      data: {
        designation: data.department,
      },
    });
  }

  async remove(id: string, tenantId: string) {
    return this.prisma.staffProfile.delete({ where: { id } });
  }
}


