import { Controller, Get, Post, Body, Param, Query, UseGuards, Res, Req, Headers, HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('billing')
export class BillingController {
  constructor(private billingService: BillingService) {}

  @Get('summary')
  async getSummary() {
    return this.billingService.getBillingSummary();
  }

  @Post('invoices')
  async create(
    @Body('opportunityId') opportunityId: string,
    @Body('studentId') studentId: string,
    @Body('items') items: { oliId: string; productId: string; amount: number }[],
    @Body('paymentMethod') paymentMethod: string,
    @Body('bankDetails') bankDetails?: any,
  ) {
    return this.billingService.createInvoice(opportunityId, studentId, items, paymentMethod, bankDetails);
  }

  @Get('invoices/recent')
  async getRecent(@Query('studentId') studentId?: string) {
    return this.billingService.getRecentInvoices(studentId);
  }

  @Get('invoices/:id/pdf')
  async getPdfData(@Param('id') id: string) {
    return this.billingService.getInvoicePDFData(id);
  }

  @Get('invoices/:id/pdf/download')
  async downloadInvoicePdf(@Param('id') id: string, @Res() res: any) {
    const data = await this.billingService.getInvoicePDFData(id);
    return this.billingService.generateReceiptPdfStream(data, res);
  }

  @Post('invoices/:id/void')
  async void(@Param('id') id: string) {
    return this.billingService.voidInvoice(id);
  }

  @Get('products/active')
  async getActiveProducts(
    @Query('classId') classId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.billingService.getActiveProducts(classId, academicYearId);
  }

  @Post('admissions')
  async createAdmission(
    @Body('studentData') studentData: any,
    @Body('selectedPricebookEntryIds') selectedPricebookEntryIds: string[],
    @Body('concessionAmount') concessionAmount: number,
  ) {
    return this.billingService.createAdmission(studentData, selectedPricebookEntryIds, concessionAmount);
  }

  @Get('options/years')
  async getYears(@Req() req: any) {
    return this.billingService.getAcademicYearOptions(req.user?.tenantId);
  }

  @Get('options/classes')
  async getClasses(@Req() req: any) {
    return this.billingService.getClassOptions(req.user?.tenantId);
  }

  @Get('options/sections')
  async getSections(@Req() req: any, @Query('classId') classId?: string) {
    return this.billingService.getSectionOptions(classId, req.user?.tenantId);
  }

  @Get('students/search')
  async search(@Query('searchTerm') searchTerm: string) {
    return this.billingService.searchStudents(searchTerm || '');
  }

  @Get('students/:id')
  async getStudent(
    @Param('id') id: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.billingService.getStudentById(id, academicYearId);
  }

  @Get('unpaid-fees/:opportunityId')
  async getUnpaidFees(@Param('opportunityId') opportunityId: string) {
    return this.billingService.getUnpaidFees(opportunityId);
  }

  @Post('discounts')
  async updateDiscount(
    @Body('oliId') oliId: string,
    @Body('discountPercent') discountPercent: number,
  ) {
    return this.billingService.updateLineItemDiscount(oliId, discountPercent);
  }

  @Post('discounts/bulk')
  async updateDiscountsBulk(
    @Body('oliIds') oliIds: string[],
    @Body('discountPercent') discountPercent: number,
  ) {
    return this.billingService.updateBulkLineItemDiscounts(oliIds, discountPercent);
  }

  @Post('students/import')
  async importStudents(@Body('studentDataList') studentDataList: any[]) {
    return this.billingService.importStudentsBulk(studentDataList);
  }

  @Get('products')
  async getProducts() {
    return this.billingService.getAllFeeProducts();
  }

  @Post('products')
  async createProducts(@Body('productNames') productNames: string[]) {
    return this.billingService.createFeeProducts(productNames);
  }

  @Get('pricebook')
  async getPriceBook(
    @Query('classId') classId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.billingService.getPriceBook(classId, academicYearId);
  }

  @Post('pricebook')
  async savePriceBook(
    @Body('classId') classId: string,
    @Body('academicYearId') academicYearId: string,
    @Body('priceItems') priceItems: { productId: string; price: number; selected: boolean }[],
  ) {
    return this.billingService.savePriceBook(classId, academicYearId, priceItems);
  }

  @Post('pricebook/sync')
  async syncPriceBook(
    @Body('classId') classId: string,
    @Body('academicYearId') academicYearId: string,
  ) {
    if (!classId || !academicYearId) {
      throw new Error('classId and academicYearId are required');
    }
    const tenantId = (await this.billingService.getTenantIdPublic());
    await this.billingService.syncPriceBookToStudents(classId, academicYearId, undefined, tenantId);
    return { success: true, message: 'Fee structure synced to all students in this class.' };
  }

  @Get('financial-command-center')
  async getFinancialCommandCenter(
    @Req() req: any,
    @Query('academicYearId') academicYearId?: string,
    @Query('financialYear') financialYear?: string,
    @Query('month') month?: string,
    @Query('week') week?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('classId') classId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('studentId') studentId?: string,
    @Query('paymentMethod') paymentMethod?: string,
    @Query('feeCategory') feeCategory?: string,
    @Query('expenseCategory') expenseCategory?: string,
    @Query('collectionStatus') collectionStatus?: string,
  ) {
    const userId = req.user.id;
    const tenantId = req.user.tenantId;

    const hasAccess = await this.billingService.checkCorrespondentAccess(userId, tenantId);
    if (!hasAccess) {
      throw new HttpException('Access denied. Only school owners, correspondents, or super admins can access this data.', HttpStatus.FORBIDDEN);
    }

    return this.billingService.getFinancialCommandCenterData(tenantId, {
      academicYearId,
      financialYear,
      month: month ? parseInt(month, 10) : undefined,
      week: week ? parseInt(week, 10) : undefined,
      startDate,
      endDate,
      classId,
      sectionId,
      studentId,
      paymentMethod,
      feeCategory,
      expenseCategory,
      collectionStatus,
    });
  }

  // ── RAZORPAY FEE COLLECTION ENDPOINTS (Admin / Cashier Portal) ──────────────

  @Post('razorpay/create-order')
  async createRazorpayOrder(
    @Req() req: any,
    @Body('opportunityId') opportunityId: string,
    @Body('studentId') studentId: string,
    @Body('items') items: { oliId: string; productId: string; amount: number }[],
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant not identified in session.');
    }
    return this.billingService.createRazorpayFeeOrder(tenantId, opportunityId, studentId, items);
  }

  @Post('razorpay/verify-payment')
  async verifyRazorpayPayment(
    @Req() req: any,
    @Body('opportunityId') opportunityId: string,
    @Body('studentId') studentId: string,
    @Body('items') items: { oliId: string; productId: string; amount: number }[],
    @Body('razorpay_order_id') razorpayOrderId: string,
    @Body('razorpay_payment_id') razorpayPaymentId: string,
    @Body('razorpay_signature') razorpaySignature: string,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant not identified in session.');
    }
    return this.billingService.verifyRazorpayFeePayment(
      tenantId,
      opportunityId,
      studentId,
      items,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    );
  }

  @Post('razorpay/check-status')
  async checkRazorpayPaymentStatus(
    @Req() req: any,
    @Body('orderId') orderId?: string,
    @Body('paymentLinkId') paymentLinkId?: string,
    @Body('studentId') studentId?: string,
    @Body('opportunityId') opportunityId?: string,
    @Body('items') items?: { oliId: string; productId: string; amount: number }[],
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant not identified in session.');
    }
    return this.billingService.checkRazorpayOrderStatus(
      tenantId,
      orderId,
      paymentLinkId,
      studentId,
      opportunityId,
      items,
    );
  }
}

// ── PUBLIC BILLING CONTROLLER (Parents Payment Link - No Login Required) ──────
@Controller('billing/public')
export class PublicBillingController {
  constructor(private billingService: BillingService) {}

  @Get('payment-info')
  async getPublicPaymentInfo(
    @Query('pa') pa?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.billingService.getPublicSchoolPaymentInfo(pa, tenantId);
  }

  @Post('razorpay/create-order')
  async createPublicRazorpayOrder(
    @Body('tenantId') tenantId: string,
    @Body('opportunityId') opportunityId: string,
    @Body('studentId') studentId: string,
    @Body('items') items: { oliId: string; productId: string; amount: number }[],
    @Body('pa') pa?: string,
  ) {
    let resolvedTenantId = tenantId;
    if (!resolvedTenantId && pa) {
      const info = await this.billingService.getPublicSchoolPaymentInfo(pa);
      resolvedTenantId = (info as any).tenantId;
    }
    if (!resolvedTenantId) {
      throw new BadRequestException('School identifier not found.');
    }
    return this.billingService.createRazorpayFeeOrder(resolvedTenantId, opportunityId, studentId, items);
  }

  @Post('razorpay/verify-payment')
  async verifyPublicRazorpayPayment(
    @Body('tenantId') tenantId: string,
    @Body('opportunityId') opportunityId: string,
    @Body('studentId') studentId: string,
    @Body('items') items: { oliId: string; productId: string; amount: number }[],
    @Body('razorpay_order_id') razorpayOrderId: string,
    @Body('razorpay_payment_id') razorpayPaymentId: string,
    @Body('razorpay_signature') razorpaySignature: string,
    @Body('pa') pa?: string,
  ) {
    let resolvedTenantId = tenantId;
    if (!resolvedTenantId && pa) {
      const info = await this.billingService.getPublicSchoolPaymentInfo(pa);
      resolvedTenantId = (info as any).tenantId;
    }
    if (!resolvedTenantId) {
      throw new BadRequestException('School identifier not found.');
    }
    return this.billingService.verifyRazorpayFeePayment(
      resolvedTenantId,
      opportunityId,
      studentId,
      items,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    );
  }

  @Post('razorpay/check-status')
  async checkPublicRazorpayPaymentStatus(
    @Body('tenantId') tenantId: string,
    @Body('orderId') orderId?: string,
    @Body('paymentLinkId') paymentLinkId?: string,
    @Body('studentId') studentId?: string,
    @Body('opportunityId') opportunityId?: string,
    @Body('items') items?: { oliId: string; productId: string; amount: number }[],
    @Body('pa') pa?: string,
  ) {
    let resolvedTenantId = tenantId;
    if (!resolvedTenantId && pa) {
      const info = await this.billingService.getPublicSchoolPaymentInfo(pa);
      resolvedTenantId = (info as any).tenantId;
    }
    if (!resolvedTenantId) {
      throw new BadRequestException('School identifier not found.');
    }
    return this.billingService.checkRazorpayOrderStatus(
      resolvedTenantId,
      orderId,
      paymentLinkId,
      studentId,
      opportunityId,
      items,
    );
  }

  @Post('razorpay/webhook')
  async handleRazorpayWebhook(
    @Body() body: any,
    @Headers('x-razorpay-signature') signature: string,
    @Req() req: any,
  ) {
    return this.billingService.handleRazorpayWebhook(body, signature, req.rawBody);
  }

  @Get('invoices/:id/pdf')
  async getPublicPdfData(@Param('id') id: string) {
    return this.billingService.getInvoicePDFData(id);
  }

  @Get('invoices/:id/pdf/download')
  async downloadPublicInvoicePdf(@Param('id') id: string, @Res() res: any) {
    const data = await this.billingService.getInvoicePDFData(id);
    return this.billingService.generateReceiptPdfStream(data, res);
  }
}

