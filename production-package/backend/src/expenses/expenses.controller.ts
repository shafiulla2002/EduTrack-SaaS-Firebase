import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExpenseStatus } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private expensesService: ExpensesService) {}

  @Post()
  async create(@Body() data: any) {
    return this.expensesService.createExpense(data);
  }

  @Get()
  async getAll(
    @Query('category') category?: string,
    @Query('status') status?: ExpenseStatus,
  ) {
    return this.expensesService.getExpenses(category, status);
  }

  @Get('summary')
  async getSummary() {
    return this.expensesService.getExpenseSummary();
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.expensesService.deleteExpense(id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    return this.expensesService.updateExpense(id, data);
  }
}
