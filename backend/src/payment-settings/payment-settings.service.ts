import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PaymentSettingsService {
  constructor(private prisma: PrismaService) {}

  async getSettings() {
    let settings = await this.prisma.paymentSettings.findFirst();
    if (!settings) {
      settings = await this.prisma.paymentSettings.create({
        data: {
          companyName: 'EduTrack Inc.',
          supportEmail: 'support@edutrack.com',
          supportPhone: '+91 9876543210',
          gstPercentage: 18.0,
          invoicePrefix: 'INV-SUB-',
          invoiceNumberFormat: 'INV-{YYYY}-{MM}-{NUMBER}',
          defaultCurrency: 'INR',
          timeZone: 'Asia/Kolkata',
        },
      });
    }
    return settings;
  }

  async updateSettings(data: any) {
    const existing = await this.getSettings();
    return this.prisma.paymentSettings.update({
      where: { id: existing.id },
      data,
    });
  }
}
