import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentGatewayProvider, InitiateChargeResult, VerifyChargeResult } from '../interfaces/payment.interface';

@Injectable()
export class PaymentService {
  private activeProvider: PaymentGatewayProvider;

  constructor(private configService: ConfigService) {
    const gateway = this.configService.get<string>('PAYMENT_GATEWAY') || 'SIMULATED';
    this.activeProvider = this.resolveProvider(gateway);
  }

  private resolveProvider(gateway: string): PaymentGatewayProvider {
    switch (gateway.toUpperCase()) {
      case 'STRIPE':
        return new DummyStripeProvider();
      case 'RAZORPAY':
        return new DummyRazorpayProvider();
      case 'PHONEPE':
        return new DummyPhonePeProvider();
      case 'CASHFREE':
        return new DummyCashfreeProvider();
      case 'SIMULATED':
      default:
        return new SimulatedUpiProvider();
    }
  }

  async initiateCharge(invoiceId: string, amount: number): Promise<InitiateChargeResult> {
    return this.activeProvider.initiateCharge(invoiceId, amount);
  }

  async verifyCharge(payload: any): Promise<VerifyChargeResult> {
    return this.activeProvider.verifyCharge(payload);
  }
}

// ── Dummy / Stub Provider Implementations ready for production keys ──

class SimulatedUpiProvider implements PaymentGatewayProvider {
  async initiateCharge(invoiceId: string, amount: number): Promise<InitiateChargeResult> {
    const transactionId = 'TXN-UPI-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    return {
      success: true,
      transactionId,
      qrCodeData: `upi://pay?pa=edutrack@upi&am=${amount}&tr=${transactionId}&tn=EduTrack%20Renewal`,
    };
  }

  async verifyCharge(payload: any): Promise<VerifyChargeResult> {
    return {
      success: true,
      transactionId: payload.transactionId || 'TXN-UPI-MOCK-' + Date.now(),
      paymentMethod: 'UPI',
    };
  }
}

class DummyStripeProvider implements PaymentGatewayProvider {
  async initiateCharge(invoiceId: string, amount: number): Promise<InitiateChargeResult> {
    const transactionId = 'TXN-STRI-' + Date.now();
    return {
      success: true,
      transactionId,
      redirectUrl: `https://checkout.stripe.com/pay/${transactionId}`,
    };
  }

  async verifyCharge(payload: any): Promise<VerifyChargeResult> {
    return {
      success: true,
      transactionId: payload.id || 'TXN-STRIPE-MOCK',
      paymentMethod: 'CARD',
    };
  }
}

class DummyRazorpayProvider implements PaymentGatewayProvider {
  async initiateCharge(invoiceId: string, amount: number): Promise<InitiateChargeResult> {
    const transactionId = 'TXN-RAZO-' + Date.now();
    return {
      success: true,
      transactionId,
    };
  }

  async verifyCharge(payload: any): Promise<VerifyChargeResult> {
    return {
      success: true,
      transactionId: payload.razorpay_payment_id || 'TXN-RAZORPAY-MOCK',
      paymentMethod: 'UPI_OR_CARD',
    };
  }
}

class DummyPhonePeProvider implements PaymentGatewayProvider {
  async initiateCharge(invoiceId: string, amount: number): Promise<InitiateChargeResult> {
    return {
      success: true,
      transactionId: 'TXN-PE-' + Date.now(),
      redirectUrl: 'https://merch.phonepe.com/pay',
    };
  }

  async verifyCharge(payload: any): Promise<VerifyChargeResult> {
    return {
      success: true,
      transactionId: payload.txId || 'TXN-PHONEPE-MOCK',
      paymentMethod: 'UPI',
    };
  }
}

class DummyCashfreeProvider implements PaymentGatewayProvider {
  async initiateCharge(invoiceId: string, amount: number): Promise<InitiateChargeResult> {
    return {
      success: true,
      transactionId: 'TXN-CF-' + Date.now(),
    };
  }

  async verifyCharge(payload: any): Promise<VerifyChargeResult> {
    return {
      success: true,
      transactionId: payload.orderId || 'TXN-CASHFREE-MOCK',
      paymentMethod: 'NET_BANKING',
    };
  }
}
