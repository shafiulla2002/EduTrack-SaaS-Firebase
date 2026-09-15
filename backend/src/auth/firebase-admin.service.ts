import { Injectable, OnModuleInit, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private firebaseApp: any = null;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    try {
      const serviceAccountJson = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
      const credentialsPath = this.configService.get<string>('FIREBASE_CREDENTIALS_PATH');

      let serviceAccount: any = null;

      if (serviceAccountJson) {
        try {
          serviceAccount = JSON.parse(serviceAccountJson);
          this.logger.log('Firebase Admin: Loaded credentials from FIREBASE_SERVICE_ACCOUNT_JSON env variable.');
        } catch (e) {
          this.logger.error('Firebase Admin: Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON env variable.', e);
        }
      }

      if (!serviceAccount && credentialsPath) {
        const resolvedPath = path.resolve(credentialsPath);
        if (fs.existsSync(resolvedPath)) {
          try {
            const fileContent = fs.readFileSync(resolvedPath, 'utf8');
            serviceAccount = JSON.parse(fileContent);
            this.logger.log(`Firebase Admin: Loaded credentials from local file: ${resolvedPath}`);
          } catch (e) {
            this.logger.error(`Firebase Admin: Failed to parse service account JSON file at ${resolvedPath}`, e);
          }
        } else {
          this.logger.warn(`Firebase Admin: Local credentials file not found at ${resolvedPath}`);
        }
      }

      if (!serviceAccount) {
        this.logger.warn('Firebase Admin: No credentials provided via FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_CREDENTIALS_PATH. Push notifications will be disabled.');
        return;
      }

      // Require firebase-admin root package
      const admin = require('firebase-admin');

      // Reuse existing app instance if already initialized to prevent duplicate app errors
      if (admin.apps && admin.apps.length > 0) {
        this.firebaseApp = admin.apps[0];
        this.logger.log('Firebase Admin: Reusing already initialized Firebase App instance.');
      } else {
        this.firebaseApp = admin.initializeApp({
          credential: admin.cert(serviceAccount),
        });
        this.logger.log('Firebase Admin: SDK successfully initialized.');
      }
    } catch (error: any) {
      this.logger.error('Firebase Admin Initialization Failure:', error.stack || error.message);
    }
  }

  async verifyIdToken(idToken: string): Promise<string> {
    if (!this.firebaseApp) {
      throw new UnauthorizedException('Firebase Admin SDK is not initialized.');
    }

    try {
      const { getAuth } = require('firebase-admin/auth');
      const decodedToken = await getAuth(this.firebaseApp).verifyIdToken(idToken);
      const phone = decodedToken.phone_number;
      if (!phone) {
        throw new UnauthorizedException('Firebase token verified, but no phone number found in claims.');
      }
      return phone;
    } catch (error: any) {
      this.logger.error('Firebase token verification failed:', error.message);
      if (error.code === 'auth/id-token-expired') {
        throw new UnauthorizedException('OTP token has expired. Please request a new one.');
      }
      if (error.code === 'auth/argument-error') {
        throw new UnauthorizedException('Invalid verification token argument.');
      }
      throw new UnauthorizedException(`OTP token verification failed: ${error.message}`);
    }
  }

  isInitialized(): boolean {
    return !!this.firebaseApp;
  }
}
