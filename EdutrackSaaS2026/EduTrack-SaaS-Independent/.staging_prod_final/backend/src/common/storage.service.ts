import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

@Injectable()
export class StorageService {
  private s3: AWS.S3 | null = null;
  private bucketName: string | null = null;

  constructor(private configService: ConfigService) {
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
    const region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME') || null;

    if (
      accessKeyId &&
      secretAccessKey &&
      accessKeyId !== 'mock-key-id' &&
      secretAccessKey !== 'mock-secret-access-key'
    ) {
      this.s3 = new AWS.S3({
        accessKeyId,
        secretAccessKey,
        region,
      });
    }
  }

  async uploadImage(base64Data: string, tenantId: string, studentId: string, filenamePrefix: string): Promise<string> {
    if (!base64Data || typeof base64Data !== 'string') {
      throw new BadRequestException('Missing file data.');
    }

    if (base64Data.startsWith('http://') || base64Data.startsWith('https://') || base64Data.startsWith('/uploads/')) {
      return base64Data;
    }

    let mimeType = 'application/octet-stream';
    let base64Content = base64Data;

    const commaIdx = base64Data.indexOf(',');
    if (base64Data.startsWith('data:') && commaIdx !== -1) {
      const header = base64Data.substring(5, commaIdx);
      const rawMime = header.split(';')[0].trim();
      if (rawMime) {
        mimeType = rawMime.toLowerCase();
      }
      base64Content = base64Data.substring(commaIdx + 1);
    }

    // Remove all whitespace/newlines that may be present in base64
    const sanitizedBase64 = base64Content.replace(/\s+/g, '');
    const buffer = Buffer.from(sanitizedBase64, 'base64');

    // 10 MB validation (10 * 1024 * 1024 bytes)
    if (buffer.length > 10 * 1024 * 1024) {
      throw new BadRequestException('File size exceeds the maximum 10 MB limit.');
    }

    let mimeExtension = 'bin';
    if (mimeType.includes('pdf')) mimeExtension = 'pdf';
    else if (mimeType.includes('png')) mimeExtension = 'png';
    else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) mimeExtension = 'jpg';
    else if (mimeType.includes('webp')) mimeExtension = 'webp';
    else if (mimeType.includes('gif')) mimeExtension = 'gif';
    else if (mimeType.includes('svg')) mimeExtension = 'svg';
    else if (mimeType.includes('vnd.openxmlformats-officedocument.wordprocessingml')) mimeExtension = 'docx';
    else if (mimeType.includes('msword')) mimeExtension = 'doc';
    else {
      const sub = mimeType.split('/')[1];
      if (sub) mimeExtension = sub.split('+')[0];
    }

    const uniqueFilename = `${filenamePrefix}-${randomBytes(8).toString('hex')}.${mimeExtension}`;
    const storageKey = `students/${tenantId}/${studentId}/${uniqueFilename}`;

    // 1. Try S3 upload if credentials are not mock
    if (this.s3 && this.bucketName) {
      try {
        const uploadResult = await this.s3
          .upload({
            Bucket: this.bucketName,
            Key: storageKey,
            Body: buffer,
            ContentType: mimeType,
            ACL: 'public-read',
          })
          .promise();
        return uploadResult.Location;
      } catch (err: any) {
        console.warn('[StorageService] S3 upload failed, falling back to local/data storage:', err.message);
      }
    }

    // Standardized base64 data URL
    const cleanDataUrl = `data:${mimeType};base64,${sanitizedBase64}`;

    // 2. Local fallback storage
    try {
      if (process.env.VERCEL) {
        // On Vercel, return the sanitized base64 data URL directly to save in the database
        return cleanDataUrl;
      }
      const relativePath = `/uploads/${storageKey}`;
      const absolutePath = join(__dirname, '..', '..', 'uploads', storageKey);
      // Ensure directory exists
      const dirPath = require('path').dirname(absolutePath);
      require('fs').mkdirSync(dirPath, { recursive: true });
      writeFileSync(absolutePath, buffer);
      // Return path that can be served statically (relative to server root)
      return relativePath;

    } catch (err) {
      console.error('[StorageService] Local storage write failed:', err);
      // Fallback: If local storage write fails, return the sanitized base64 data URL directly
      return cleanDataUrl;
    }
  }


  async deleteImage(imageUrl: string): Promise<void> {
    // Determine if URL is an S3 location or local path
    try {
      if (this.s3 && this.bucketName && imageUrl.startsWith('http')) {
        // Extract key from URL
        const urlObj = new URL(imageUrl);
        const key = decodeURIComponent(urlObj.pathname.replace(/^\//, ''));
        await this.s3.deleteObject({ Bucket: this.bucketName, Key: key }).promise();
        return;
      }
    } catch (err) {
      console.warn('[StorageService] Failed to delete from S3:', err);
    }
    // Local fallback: map relative URL to filesystem path
    try {
      const localPath = join(__dirname, '..', '..', imageUrl);
      const fs = require('fs');
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
      }
    } catch (err) {
      console.warn('[StorageService] Failed to delete local file:', err);
    }
  }
}

