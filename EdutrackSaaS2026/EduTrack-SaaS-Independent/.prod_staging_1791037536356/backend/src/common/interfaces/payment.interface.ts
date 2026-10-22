export interface PaymentDetails {
  amount: number;
  currency: string;
  transactionReference: string;
  paymentMethod: string;
  gateway: string;
}

export interface InitiateChargeResult {
  success: boolean;
  transactionId: string;
  redirectUrl?: string;
  qrCodeData?: string;
}

export interface VerifyChargeResult {
  success: boolean;
  transactionId: string;
  paymentMethod?: string;
  error?: string;
}

export interface PaymentGatewayProvider {
  initiateCharge(invoiceId: string, amount: number): Promise<InitiateChargeResult>;
  verifyCharge(payload: any): Promise<VerifyChargeResult>;
}
