import * as crypto from 'crypto';

export interface SignedQrPayload {
  type: 'TEACHER_ATTENDANCE';
  tenantId: string;
  qrId: string;
  code: string;
  version: number;
  timestamp: number;
  sig?: string;
}

const DEFAULT_SECRET = 'edutrack-teacher-attendance-secure-signature-key-2027';

/**
 * Generates a high-entropy cryptographically secure random token for QR code.
 */
export function generateSecureQrCode(): string {
  return 'eta_' + crypto.randomBytes(24).toString('hex');
}

/**
 * Signs a payload with HMAC-SHA256.
 */
export function signQrPayload(
  payload: Omit<SignedQrPayload, 'sig'>,
  secret = process.env.JWT_SECRET || DEFAULT_SECRET,
): string {
  const data = `${payload.type}:${payload.tenantId}:${payload.qrId}:${payload.code}:${payload.version}:${payload.timestamp}`;
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Verifies the signature of a signed payload.
 */
export function verifyQrSignature(
  payload: SignedQrPayload,
  secret = process.env.JWT_SECRET || DEFAULT_SECRET,
): boolean {
  if (!payload.sig) return false;
  const expected = signQrPayload(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(payload.sig, 'hex'),
    Buffer.from(expected, 'hex'),
  );
}

/**
 * Extracts raw token / code from scanned string which could be a URL or raw string.
 */
export function extractQrToken(rawScannedText: string): string {
  if (!rawScannedText) return '';
  const trimmed = rawScannedText.trim();

  // 1. If deep link URL (e.g. https://domain.com/teacher-attendance?token=xxx)
  if (trimmed.includes('token=')) {
    try {
      const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
      const token = url.searchParams.get('token');
      if (token) return token;
    } catch {
      const match = trimmed.match(/[?&]token=([^&#]+)/);
      if (match && match[1]) return decodeURIComponent(match[1]);
    }
  }

  // 2. If JSON payload string
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.code) return parsed.code;
      if (parsed.token) return parsed.token;
    } catch {}
  }

  // 3. Raw token
  return trimmed;
}
