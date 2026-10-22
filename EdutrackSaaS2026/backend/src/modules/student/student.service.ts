import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class StudentService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.studentProfile.findMany({
      where: { User: { tenantId } },
      include: { User: true, ClassSection: { include: { Class: true } } },
    });
  }

  async findOne(id: string, tenantId: string) {
    return this.prisma.studentProfile.findFirst({
      where: { id, User: { tenantId } },
      include: { User: true, ClassSection: { include: { Class: true } } },
    });
  }
}
