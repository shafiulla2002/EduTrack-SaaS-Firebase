import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { LibraryService } from './library.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('library')
export class LibraryController {
  constructor(private libraryService: LibraryService) {}

  @Post('books')
  async createBook(@Body() data: any) {
    return this.libraryService.addBook(data);
  }

  @Get('books')
  async getBooks() {
    return this.libraryService.getBooks();
  }

  @Post('borrow')
  async borrow(
    @Body('barcode') barcode: string,
    @Body('borrowerId') borrowerId: string,
    @Body('daysToBorrow') daysToBorrow?: number,
  ) {
    return this.libraryService.borrowBook(barcode, borrowerId, daysToBorrow);
  }

  @Post('return')
  async returnBook(
    @Body('barcode') barcode: string,
    @Body('finePaid') finePaid?: number,
  ) {
    return this.libraryService.returnBook(barcode, finePaid);
  }

  @Get('borrow-logs')
  async getLogs() {
    return this.libraryService.getBorrowLogs();
  }
}
