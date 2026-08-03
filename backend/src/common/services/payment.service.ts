import { Injectable, BadRequestException } from '@nestjs/common';

export interface PaymentResponse {
  success: boolean;
  transactionId: string;
  gateway: string;
  amount: number;
  message: string;
}

export interface PaymentStrategy {
  processPayment(tenantId: string, amount: number, details: any): Promise<PaymentResponse>;
}

@Injectable()
export class StripePaymentStrategy implements PaymentStrategy {
  async processPayment(tenantId: string, amount: number, details: any): Promise<PaymentResponse> {
    console.log(`[Stripe] Processing payment for tenant ${tenantId} of amount ₹${amount}`);
    // Simulate payment processing via Stripe gateway
    const txId = 'ch_stripe_' + Math.random().toString(36).substring(2, 10).toUpperCase();
    return {
      success: true,
      transactionId: txId,
      gateway: 'STRIPE',
      amount,
      message: 'Simulated Stripe checkout processed successfully.',
    };
  }
}

@Injectable()
export class RazorpayPaymentStrategy implements PaymentStrategy {
  async processPayment(tenantId: string, amount: number, details: any): Promise<PaymentResponse> {
    console.log(`[Razorpay] Processing payment for tenant ${tenantId} of amount ₹${amount}`);
    // Simulate payment processing via Razorpay gateway
    const txId = 'pay_rzp_' + Math.random().toString(36).substring(2, 10).toUpperCase();
    return {
      success: true,
      transactionId: txId,
      gateway: 'RAZORPAY',
      amount,
      message: 'Simulated Razorpay checkout processed successfully.',
    };
  }
}

@Injectable()
export class PayPalPaymentStrategy implements PaymentStrategy {
  async processPayment(tenantId: string, amount: number, details: any): Promise<PaymentResponse> {
    console.log(`[PayPal] Processing payment for tenant ${tenantId} of amount ₹${amount}`);
    // Simulate payment processing via PayPal gateway
    const txId = 'PAYID-PPL-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    return {
      success: true,
      transactionId: txId,
      gateway: 'PAYPAL',
      amount,
      message: 'Simulated PayPal checkout processed successfully.',
    };
  }
}

@Injectable()
export class PaymentService {
  private strategies: Record<string, PaymentStrategy> = {};

  constructor() {
    // Register the available payment gateway strategies
    this.strategies['STRIPE'] = new StripePaymentStrategy();
    this.strategies['RAZORPAY'] = new RazorpayPaymentStrategy();
    this.strategies['PAYPAL'] = new PayPalPaymentStrategy();
    this.strategies['SIMULATED'] = new StripePaymentStrategy(); // default fallback
  }

  async processCheckout(
    gateway: string,
    tenantId: string,
    amount: number,
    details: any
  ): Promise<PaymentResponse> {
    const strategyKey = String(gateway).toUpperCase();
    const strategy = this.strategies[strategyKey];

    if (!strategy) {
      throw new BadRequestException(`Payment gateway strategy '${gateway}' is not supported.`);
    }

    return strategy.processPayment(tenantId, amount, details);
  }
}
