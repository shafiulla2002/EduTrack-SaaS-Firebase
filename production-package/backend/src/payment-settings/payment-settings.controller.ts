import { Controller, Get, Put, Body } from '@nestjs/common';
import { PaymentSettingsService } from './payment-settings.service';

@Controller('api/v1/platform/payment-settings')
export class PaymentSettingsController {
  constructor(private readonly paymentSettingsService: PaymentSettingsService) {}

  @Get()
  async getSettings() {
    return this.paymentSettingsService.getSettings();
  }

  @Put()
  async updateSettings(@Body() body: any) {
    return this.paymentSettingsService.updateSettings(body);
  }
}
