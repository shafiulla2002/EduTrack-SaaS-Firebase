const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = __dirname;
const tempExtractDir = path.join(rootDir, '.temp_verify_' + Date.now());

const frontendZip = path.join(rootDir, 'CS-EduTrack-Frontend-Production.zip');
const backendZip = path.join(rootDir, 'CS-EduTrack-Backend-Production.zip');

function countAndScanFilesRecursive(dir, forbiddenNames, forbiddenPatterns) {
  let fileCount = 0;
  let dirCount = 0;
  let violations = [];

  if (!fs.existsSync(dir)) return { fileCount, dirCount, violations };

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (forbiddenNames.includes(entry.name.toLowerCase())) {
      violations.push(`Forbidden file found: ${entry.name}`);
    }

    if (entry.isDirectory()) {
      dirCount++;
      const sub = countAndScanFilesRecursive(fullPath, forbiddenNames, forbiddenPatterns);
      fileCount += sub.fileCount;
      dirCount += sub.dirCount;
      violations = violations.concat(sub.violations);
    } else {
      fileCount++;
      if (entry.name.endsWith('.js') || entry.name.endsWith('.json') || entry.name.endsWith('.env') || entry.name.endsWith('.ts')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          for (const pattern of forbiddenPatterns) {
            if (pattern.test(content)) {
              violations.push(`Forbidden pattern matched in ${entry.name}`);
            }
          }
        } catch (e) {}
      }
    }
  }

  return { fileCount, dirCount, violations };
}

console.log('=== RUNNING PRODUCTION ZIP DEEP VERIFICATION ===\n');

fs.mkdirSync(tempExtractDir, { recursive: true });

const forbiddenNames = [
  '.env',
  '.env.local',
  '.env.production',
  '.env.vercel.pulled',
  'firebase-service-account.json',
  'service-account.json',
  'id_rsa',
  'private_key.pem',
];

const forbiddenPatterns = [
  /-----BEGIN PRIVATE KEY-----/,
  /-----BEGIN RSA PRIVATE KEY-----/,
  /Vz8oYPOYf0yOJ2st13r0abn0/,
];

// 1. Extract & Test Frontend ZIP
console.log('1. Extracting & Validating Frontend ZIP...');
const feExtract = path.join(tempExtractDir, 'frontend');
fs.mkdirSync(feExtract, { recursive: true });
execSync(`powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${frontendZip.replace(/'/g, "''")}', '${feExtract.replace(/'/g, "''")}')"`);

const feScan = countAndScanFilesRecursive(feExtract, forbiddenNames, forbiddenPatterns);

const requiredFrontendFiles = [
  'package.json',
  'next.config.mjs',
  'server.js',
  'public/cs-edutrack-logo.jpg',
  'public/favicon.ico',
  'public/favicon-16x16.png',
  'public/favicon-32x32.png',
  'public/icon-192.png',
  'public/icon-512.png',
  'public/apple-touch-icon.png',
  'public/site.webmanifest',
  '.next/server',
  '.next/static',
  '.next/routes-manifest.json',
  'src/app/layout.tsx',
  'src/app/dashboard/teachers/attendance/page.tsx',
  'src/app/dashboard/teachers/attendance/qr/page.tsx',
  'src/app/teacher-attendance/page.tsx',
];

const feFileChecks = {};
for (const rf of requiredFrontendFiles) {
  feFileChecks[rf] = fs.existsSync(path.join(feExtract, rf)) ? 'PRESENT' : 'MISSING';
}

// 2. Extract & Test Backend ZIP
console.log('2. Extracting & Validating Backend ZIP...');
const beExtract = path.join(tempExtractDir, 'backend');
fs.mkdirSync(beExtract, { recursive: true });
execSync(`powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${backendZip.replace(/'/g, "''")}', '${beExtract.replace(/'/g, "''")}')"`);

const beScan = countAndScanFilesRecursive(beExtract, forbiddenNames, forbiddenPatterns);

const requiredBackendFiles = [
  'package.json',
  'tsconfig.json',
  'nest-cli.json',
  '.env.example',
  'dist/main.js',
  'dist/app.module.js',
  'dist/teacher-attendance',
  'dist/teachers',
  'dist/students',
  'dist/auth',
  'prisma/schema.prisma',
  'src/main.ts',
];

const beFileChecks = {};
for (const rf of requiredBackendFiles) {
  beFileChecks[rf] = fs.existsSync(path.join(beExtract, rf)) ? 'PRESENT' : 'MISSING';
}

// Clean up
try {
  fs.rmSync(tempExtractDir, { recursive: true, force: true });
} catch (e) {}

const feSize = fs.statSync(frontendZip).size;
const beSize = fs.statSync(backendZip).size;
const feSha = fs.readFileSync(path.join(rootDir, 'CS-EduTrack-Frontend-Production.sha256'), 'utf8').trim();
const beSha = fs.readFileSync(path.join(rootDir, 'CS-EduTrack-Backend-Production.sha256'), 'utf8').trim();

console.log('\n=== VERIFICATION SUMMARY ===');
console.log('\n[FRONTEND PACKAGE]');
console.log(`- File: ${frontendZip}`);
console.log(`- Size: ${(feSize / (1024 * 1024)).toFixed(2)} MB (${feSize} bytes)`);
console.log(`- Checksum: ${feSha}`);
console.log(`- Total Files: ${feScan.fileCount}`);
console.log(`- Secret Violations: ${feScan.violations.length === 0 ? '0 (CLEAN)' : feScan.violations.join(', ')}`);
console.log('- Required Files & Assets:');
for (const [k, v] of Object.entries(feFileChecks)) {
  console.log(`   + ${k}: ${v}`);
}

console.log('\n[BACKEND PACKAGE]');
console.log(`- File: ${backendZip}`);
console.log(`- Size: ${(beSize / (1024 * 1024)).toFixed(2)} MB (${beSize} bytes)`);
console.log(`- Checksum: ${beSha}`);
console.log(`- Total Files: ${beScan.fileCount}`);
console.log(`- Secret Violations: ${beScan.violations.length === 0 ? '0 (CLEAN)' : beScan.violations.join(', ')}`);
console.log('- Required Files & Assets:');
for (const [k, v] of Object.entries(beFileChecks)) {
  console.log(`   + ${k}: ${v}`);
}
