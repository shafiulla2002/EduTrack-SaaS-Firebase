import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TenantContext } from '../tenants/tenant.context';
import { ExpenseStatus } from '@prisma/client';

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  private getTenantId(): string {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No active school tenant context found');
    }
    return tenantId;
  }

  async createExpense(data: any) {
    const tenantId = this.getTenantId();
    return this.prisma.expense.create({
      data: {
        amount: data.amount,
        category: data.category,
        date: new Date(data.date),
        description: data.description || null,
        paymentMode: data.paymentMode,
        status: data.status || ExpenseStatus.PENDING,
        tenantId,
      },
    });
  }

  async getExpenses(category?: string, status?: ExpenseStatus) {
    const tenantId = this.getTenantId();
    return this.prisma.expense.findMany({
      where: {
        tenantId,
        ...(category ? { category } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { date: 'desc' },
    });
  }

  async deleteExpense(id: string) {
    const tenantId = this.getTenantId();
    const expense = await this.prisma.expense.findUnique({
      where: { id },
    });

    if (!expense || expense.tenantId !== tenantId) {
      throw new NotFoundException('Expense record not found');
    }

    return this.prisma.expense.delete({
      where: { id },
    });
  }

  async updateExpense(id: string, data: any) {
    const tenantId = this.getTenantId();
    const expense = await this.prisma.expense.findUnique({
      where: { id },
    });

    if (!expense || expense.tenantId !== tenantId) {
      throw new NotFoundException('Expense record not found');
    }

    return this.prisma.expense.update({
      where: { id },
      data: {
        amount: data.amount !== undefined ? data.amount : undefined,
        category: data.category !== undefined ? data.category : undefined,
        date: data.date !== undefined ? new Date(data.date) : undefined,
        description: data.description !== undefined ? data.description : undefined,
        paymentMode: data.paymentMode !== undefined ? data.paymentMode : undefined,
        status: data.status !== undefined ? data.status : undefined,
      },
    });
  }

  async getExpenseSummary() {
    const tenantId = this.getTenantId();

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const startOfPrevMonth = new Date(startOfMonth);
    startOfPrevMonth.setMonth(startOfPrevMonth.getMonth() - 1);

    const startOfYear = new Date();
    startOfYear.setMonth(0, 1);
    startOfYear.setHours(0, 0, 0, 0);

    const expenses = await this.prisma.expense.findMany({
      where: {
        tenantId,
        date: { gte: startOfPrevMonth },
      },
    });

    let currentMonthTotal = 0;
    let prevMonthTotal = 0;
    let yearlyTotal = 0;

    const now = new Date();

    for (const exp of expenses) {
      const amt = Number(exp.amount);
      const expDate = new Date(exp.date);

      if (expDate >= startOfMonth && expDate <= now) {
        currentMonthTotal += amt;
      }
      if (expDate >= startOfPrevMonth && expDate < startOfMonth) {
        prevMonthTotal += amt;
      }
      if (expDate >= startOfYear && expDate <= now) {
        yearlyTotal += amt;
      }
    }

    return {
      currentMonth: currentMonthTotal,
      prevMonth: prevMonthTotal,
      yearly: yearlyTotal,
    };
  }
}
