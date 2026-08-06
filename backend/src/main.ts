import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

// Ensure uploads folder exists in workspace when not running on Vercel
if (!process.env.VERCEL) {
  const uploadsDir = join(__dirname, '..', 'uploads');
  if (!existsSync(uploadsDir)) {
    try {
      mkdirSync(uploadsDir, { recursive: true });
    } catch (err) {
      console.error('Failed to create uploads directory:', err);
    }
  }
}

const allowedOrigins = [
  'https://edutrack-platform-lac.vercel.app',
  'https://edutrack-platform.vercel.app',
  'https://edutrack-saas.vercel.app',
  'https://app.edutrack.com',
  'https://platform.edutrack.com',
  'http://localhost:3000',
  'http://localhost:3002',
];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app') ||
      origin.endsWith('.edutrack.com')
    ) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Authorization',
    'Content-Type',
    'Accept',
    'Origin',
    'X-Requested-With',
    'X-Tenant-ID',
  ],
};

let cachedServer: any;

async function bootstrap() {
  if (!cachedServer) {
    const expressApp = express();
    
    // Explicit Preflight & CORS Middleware on Express level
    expressApp.use((req, res, next) => {
      const origin = req.headers.origin;
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
      }
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept, Origin, X-Requested-With, X-Tenant-ID');

      if (req.method === 'OPTIONS') {
        return res.status(200).end();
      }
      next();
    });

    expressApp.use(express.json({ limit: '10mb' }));
    expressApp.use(express.urlencoded({ limit: '10mb', extended: true }));
    
    // Serve static uploaded files
    expressApp.use('/uploads', express.static(join(__dirname, '..', 'uploads')));

    const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), { bodyParser: false });

    app.enableCors(corsOptions);

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();
    cachedServer = expressApp;
  }
  return cachedServer;
}

// For Vercel serverless functions
export default async (req: any, res: any) => {
  const server = await bootstrap();
  return server(req, res);
};

// For local running
if (!process.env.VERCEL) {
  async function startLocal() {
    const app = await NestFactory.create(AppModule, { bodyParser: false });
    
    app.enableCors(corsOptions);

    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ limit: '10mb', extended: true }));
    app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    const configService = app.get(ConfigService);
    const port = configService.get<number>('PORT') || 3001;

    await app.listen(port);
    console.log(`EduTrack SaaS Backend running locally on: http://localhost:${port}`);
  }
  startLocal();
}
