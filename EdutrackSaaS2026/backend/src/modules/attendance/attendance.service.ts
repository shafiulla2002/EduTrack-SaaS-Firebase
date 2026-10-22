import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AttendanceStatus } from '@prisma/client';
import { randomUUID } from 'crypto';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    tenantId: string,
    data: { studentId: string; date: string; status: AttendanceStatus },
  ) {
    const student = await this.prisma.studentProfile.findFirst({
      where: { id: data.studentId, User: { tenantId } },
    });
    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    if (!student.classSectionId) {
      throw new NotFoundException('Student is not assigned to any class section');
    }

    const dateObj = new Date(data.date);
    dateObj.setHours(0, 0, 0, 0);

    let session = await this.prisma.attendanceSession.findFirst({
      where: {
        tenantId,
        date: dateObj,
        classSectionId: student.classSectionId,
      },
    });

    if (!session) {
      const staff = await this.prisma.staffProfile.findFirst({
        where: { User: { tenantId } },
      });
      if (!staff) {
        throw new NotFoundException('No staff profile found to take attendance');
      }

      session = await this.prisma.attendanceSession.create({
        data: {
          id: randomUUID(),
          tenantId,
          date: dateObj,
          classSectionId: student.classSectionId,
          takenById: staff.id,
        },
      });
    }

    return this.prisma.attendance.create({
      data: {
        id: randomUUID(),
        tenantId,
        attendanceSessionId: session.id,
        studentId: data.studentId,
        status: data.status,
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.attendance.findMany({
      where: { tenantId },
    });
  }

  async findOne(id: string, tenantId: string) {
    return this.prisma.attendance.findFirst({
      where: { id, tenantId },
    });
  }

  async findByStudent(studentId: string, tenantId: string) {
    return this.prisma.attendance.findMany({
      where: { studentId, tenantId },
    });
  }
}
