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
        serviceAccount = {
          type: "service_account",
          project_id: "edutrack-52e6c",
          private_key_id: "310eb066b66280dd625f90c1eb9c1cb26af34f77",
          private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCvdwWa1t8LAuLS\nl8IQcE5A/4vGvFsgpGSOD/E+iadHQASUYSgaiacWS9MAykswvwBbgtzbJjjAx/E3\nQ/Tr9ZGUa+kfyTtu/lTur8CBICJ959Yq9fXTHjn7NmkREN4Ump4pqbQqWAREgJxr\nk5KgCy/TlBWBgT0uKm6n8GiCFYgNE/HlHV26XQBeUIdBluNPCglmEeTccJUhnmzC\nEOlwzxXYCE/EJi5IhGQKKW9bXQTbnsWwmvJCNmzTBJxlhe2VCdFwo0jIMtVJx7IW\nwj0EXBGRFzl9MXs2Li1Ky9xqn8DCk3DoSJOhsXI7KG/KdU8Jix6acxsB13jwPgQ3\n390RBWa3AgMBAAECggEAQw8zBi1uyw+MTr4PPicd0TuZWRftn/kUMTMomSUU2GdA\nGNFU+Wd4g03xU5D80aF96nuGGv9tm0gPCXcgaPnObLIdQ7etzkrHfP2QjgkRBZuQ\nP5UHIWug70CpQQt4RNme7v9byv8eimu43GhnFmGQIsWqvnb9QeKXrfl0h5rhB1Xg\nrlvYDVuJ6dgctGuyLIs8y+QI599Vu7xVPH8jmFUsFAGoKOKqm2xL8d63XTY2IQpv\ni7G+qiTTusJyU2VigFTyxiYoYdVUQeVycKgo1jkI86gy8Ds50MZ025HA726BtD2i\nV+XIJb0bSaQUAWSH9HMNY+hrafEY91qi2JTAFuvJmQKBgQDjHPct3w9dyKNltnOc\nzRffzl+g7QHZd0Wvfg6vHOHi3JarF1jMZ7g2RsOYo8XAUdapzK+udK6yD0zHl/8l\n/ItbhNDNv+MoI/F4tIoZxKQx/9t9IcwZs9suZ9S2elPGoUZudj4jVsks/fFzI/rO\nXR3HjIMKjQVoKtnO4oJ7BY9ViwKBgQDFyFaG7Or4mVCLqRSiF/ZhUz/dv7LzW5Wn\nzcK3Bt09hJwML4HoMuG1z3jWN5HWRhgHjLO7Ti81aG840Jh+S4wdUPKEb4itP2mI\na4D8hLhXeHJHK9uDIqzhiD/s3Sixi24T+plyiS4RZEPBnDi6c6vHzOJn8UtWCF9P\nfxcT2++RBQKBgD1ry/1/4ev/IxGS8llprhc8/OfMsT9a3mHDubzqFrz/40+KFN3S\n/yLOqH9Ta1vDxkZNsQWBUO2e7ajdFofzcMzjcoTybECi199JFEA7yhwrkfSZe1VI\nKvK16fUfyCBj5WRiXhO4mNeuJep5xI6i6DbbbWUhFmFBlX46DAexTT5ZAoGBAJA/\nmwvxAzao6tvRR2EpROKayvu58pQW+cFXCmpesUFK1Fz20TI+2eu2E5V5Ff5HRQNM\nlVFIppm3P1cam/2Qr/I5tYbtqathkmCSt5J0YdY53G8YB5NO2PPsYWMpsaI75N7h\naMTmVBkPHXO5so4aCvE/9uiETcPDe3AJaxVq1QDZAoGBAKZDGVfTadpAsKaFCG5o\nB+r2nkvtppQONrgtAXsBZe4ZQEJ+9AtVy060BgxcDHHM+qRTk4ewoID6umPVxpAZ\nzkn8wYoXIeDcCGh/lsTcITVvGu/XJmyJej9ivGB3IQGTz/CyHl4hdloWWauftp40\nAV4he2uP1LlTVHUUd/yxzNWK\n-----END PRIVATE KEY-----\n",
          client_email: "firebase-adminsdk-fbsvc@edutrack-52e6c.iam.gserviceaccount.com",
          client_id: "106471051407442875030",
          auth_uri: "https://accounts.google.com/o/oauth2/auth",
          token_uri: "https://oauth2.googleapis.com/token",
          auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
          client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40edutrack-52e6c.iam.gserviceaccount.com",
          universe_domain: "googleapis.com"
        };
        this.logger.log('Firebase Admin: Loaded credentials from default fallback configuration.');
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
