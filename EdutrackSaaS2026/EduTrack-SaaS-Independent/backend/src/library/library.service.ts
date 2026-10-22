import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TenantContext } from '../tenants/tenant.context';
import { BookCopyStatus } from '@prisma/client';

@Injectable()
export class LibraryService {
  constructor(private prisma: PrismaService) {}

  private getTenantId(): string {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('No active school tenant context found');
    }
    return tenantId;
  }

  // ── BOOK DIRECTORY MANAGEMENT ───────────────────────────────────────────────

  async addBook(data: any) {
    const tenantId = this.getTenantId();
    const totalCopies = data.totalCopies || 1;

    return this.prisma.$transaction(async (tx) => {
      const book = await tx.book.create({
        data: {
          title: data.title,
          author: data.author,
          isbn: data.isbn || null,
          category: data.category || null,
          totalCopies,
          availableCopies: totalCopies,
          tenantId,
        },
      });

      // Pre-create BookCopy instances
      const copiesData = Array.from({ length: totalCopies }).map((_, idx) => ({
        bookId: book.id,
        barcode: `${book.isbn || 'BK'}-${book.id.substring(0, 4)}-${idx + 1}`,
        status: BookCopyStatus.AVAILABLE,
        tenantId,
      }));

      await tx.bookCopy.createMany({
        data: copiesData,
      });

      return book;
    });
  }

  async getBooks() {
    const tenantId = this.getTenantId();
    return this.prisma.book.findMany({
      where: { tenantId },
      include: {
        copies: true,
      },
      orderBy: { title: 'asc' },
    });
  }

  // ── BORROWING WORKFLOWS ─────────────────────────────────────────────────────

  async borrowBook(barcode: string, borrowerId: string, daysToBorrow = 14) {
    const tenantId = this.getTenantId();

    const copy = await this.prisma.bookCopy.findUnique({
      where: { barcode },
    });

    if (!copy || copy.tenantId !== tenantId) {
      throw new NotFoundException('Book copy barcode not found');
    }

    if (copy.status !== BookCopyStatus.AVAILABLE) {
      throw new BadRequestException(`Book copy is currently not available: status is ${copy.status}`);
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + daysToBorrow);

    return this.prisma.$transaction(async (tx) => {
      // 1. Create BookIssue log
      const issue = await tx.bookIssue.create({
        data: {
          bookCopyId: copy.id,
          borrowerId,
          dueDate,
          tenantId,
        },
      });

      // 2. Set copy status to ISSUED
      await tx.bookCopy.update({
        where: { id: copy.id },
        data: { status: BookCopyStatus.ISSUED },
      });

      // 3. Decrement available copies on Book
      await tx.book.update({
        where: { id: copy.bookId },
        data: {
          availableCopies: { decrement: 1 },
        },
      });

      return issue;
    });
  }

  async returnBook(barcode: string, fineAmountPaid = 0) {
    const tenantId = this.getTenantId();

    const copy = await this.prisma.bookCopy.findUnique({
      where: { barcode },
    });

    if (!copy || copy.tenantId !== tenantId) {
      throw new NotFoundException('Book copy barcode not found');
    }

    // Find the active issue record (returnDate is null)
    const activeIssue = await this.prisma.bookIssue.findFirst({
      where: {
        bookCopyId: copy.id,
        returnDate: null,
      },
    });

    if (!activeIssue) {
      throw new BadRequestException('No active borrow record found for this copy');
    }

    const returnDate = new Date();
    const dueDate = new Date(activeIssue.dueDate);
    let fineAmount = 0;

    // Calculate fine: e.g. 5 rupees/USD per day late
    if (returnDate > dueDate) {
      const diffTime = Math.abs(returnDate.getTime() - dueDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      fineAmount = diffDays * 5.00;
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Update the BookIssue record
      const updatedIssue = await tx.bookIssue.update({
        where: { id: activeIssue.id },
        data: {
          returnDate,
          fineAmount,
          finePaid: fineAmountPaid >= fineAmount,
        },
      });

      // 2. Set copy status to AVAILABLE
      await tx.bookCopy.update({
        where: { id: copy.id },
        data: { status: BookCopyStatus.AVAILABLE },
      });

      // 3. Increment available copies on Book
      await tx.book.update({
        where: { id: copy.bookId },
        data: {
          availableCopies: { increment: 1 },
        },
      });

      return updatedIssue;
    });
  }

  async getBorrowLogs() {
    const tenantId = this.getTenantId();
    return this.prisma.bookIssue.findMany({
      where: { tenantId },
      include: {
        bookCopy: {
          include: { book: true },
        },
        borrower: {
          select: { name: true, email: true },
        },
      },
      orderBy: { issueDate: 'desc' },
    });
  }
}
