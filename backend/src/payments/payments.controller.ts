import { Controller, Post, Body, Headers, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { PaymentsService } from './payments.service';

@Controller('api/v1/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleRazorpayWebhook(
    @Req() req: any,
    @Body() body: any,
    @Headers('x-razorpay-signature') signature: string
  ) {
    const rawBody = typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(body);
    return this.paymentsService.processRazorpayWebhook(rawBody, body, signature);
  }
}
