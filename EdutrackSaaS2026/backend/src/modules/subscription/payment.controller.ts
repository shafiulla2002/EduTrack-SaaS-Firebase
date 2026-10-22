import { Controller, Post, Body, Req, Headers, BadRequestException } from '@nestjs/common';
import { PaymentService } from './payment.service';

@Controller('api/payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('create-order')
  async createOrder(@Req() req: any, @Body() body: { planId: string }) {
    const tenantId = req.user.tenantId;
    return this.paymentService.createOrder(tenantId, body.planId);
  }

  @Post('webhook/razorpay')
  async razorpayWebhook(@Headers('x-razorpay-signature') signature: string, @Body() body: any) {
    if (!signature) {
      throw new BadRequestException('Signature missing');
    }
    return this.paymentService.verifyPaymentWebhook(signature, body);
  }
}
