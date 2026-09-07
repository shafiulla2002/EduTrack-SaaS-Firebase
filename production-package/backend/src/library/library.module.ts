import { Module } from '@nestjs/common';
import { LibraryService } from './library.service';
import { LibraryController } from './library.controller';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [LibraryService, PrismaService],
  controllers: [LibraryController],
  exports: [LibraryService],
})
export class LibraryModule {}
