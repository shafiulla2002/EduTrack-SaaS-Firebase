import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class CloudStorageService {
  private readonly logger = new Logger(CloudStorageService.name);

  /**
   * Upload a file buffer/file to Cloud Storage (AWS S3) or fallback to local disk storage.
   */
  async uploadFile(filename: string, contentBuffer: Buffer, mimeType: string = 'application/pdf'): Promise<string> {
    const s3Bucket = process.env.AWS_S3_BUCKET_NAME;
    const region = process.env.AWS_REGION || 'us-east-1';

    if (s3Bucket && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      try {
        const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
        const s3 = new S3Client({ region });
        
        await s3.send(
          new PutObjectCommand({
            Bucket: s3Bucket,
            Key: `invoices/${filename}`,
            Body: contentBuffer,
            ContentType: mimeType,
          })
        );

        const s3Url = `https://${s3Bucket}.s3.${region}.amazonaws.com/invoices/${filename}`;
        this.logger.log(`File uploaded to AWS S3: ${s3Url}`);
        return s3Url;
      } catch (err) {
        this.logger.warn(`AWS S3 Upload failed: ${err.message}. Falling back to local disk storage.`);
      }
    }

    // Fallback: Store on local disk under public/invoices
    const uploadDir = path.join(process.cwd(), 'public', 'invoices');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, contentBuffer);
    const localUrl = `/invoices/${filename}`;
    this.logger.log(`File stored on local disk: ${localUrl}`);
    return localUrl;
  }
}
