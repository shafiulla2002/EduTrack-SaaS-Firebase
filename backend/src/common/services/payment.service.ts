import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { decrypt } from '../utils/encryption.util';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';

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
    if (!details.apiKey || !details.apiSecret) {
      throw new BadRequestException('Razorpay credentials not configured');
    }

    const instance = new Razorpay({
      key_id: details.apiKey,
      key_secret: details.apiSecret,
    });

    const receipt = `RCPT_${Date.now()}`;
    const orderOptions = {
      amount: Math.round(amount * 100), // amount in smallest currency unit (paise)
      currency: "INR",
      receipt: receipt,
    };

    try {
      const order = await instance.orders.create(orderOptions);
      return {
        success: true,
        transactionId: order.id, // we return the order id here, the client will use it to complete payment
        gateway: 'RAZORPAY',
        amount,
        message: 'Order created successfully',
      };
    } catch (err) {
      return {
        success: false,
        transactionId: '',
        gateway: 'RAZORPAY',
        amount,
        message: err.message || 'Failed to create Razorpay order',
      };
    }
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

  constructor(private prisma: PrismaService) {
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

    if (strategyKey === 'RAZORPAY' || strategyKey === 'STRIPE') {
      const config = await this.prisma.paymentGatewayConfig.findUnique({
        where: { gatewayName: strategyKey }
      });
      if (!config || !config.isActive) {
        throw new BadRequestException(`Gateway ${strategyKey} is not configured or inactive.`);
      }

      const secretKey = process.env.ENCRYPTION_KEY || 'default_secret_key_needs_to_be_32_bytes!';
      details.apiKey = decrypt(config.apiKey, secretKey);
      details.apiSecret = decrypt(config.apiSecret, secretKey);
    }

    return strategy.processPayment(tenantId, amount, details);
  }
}
