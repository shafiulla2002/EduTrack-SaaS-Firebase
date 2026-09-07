import { Module } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [ExpensesService, PrismaService],
  controllers: [ExpensesController],
  exports: [ExpensesService],
})
export class ExpensesModule {}
