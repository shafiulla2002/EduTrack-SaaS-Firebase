const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const rootDir = __dirname;
const frontendSrc = path.join(rootDir, 'frontend');
const backendSrc = path.join(rootDir, 'backend');

const packageOutputDir = path.join(rootDir, 'production-package');
const stagingDir = path.join(rootDir, '.production_staging');
const frontendStaging = path.join(stagingDir, 'frontend');
const backendStaging = path.join(stagingDir, 'backend');

const frontendZip = path.join(packageOutputDir, 'edutrack-frontend-production.zip');
const backendZip = path.join(packageOutputDir, 'edutrack-backend-production.zip');
const completeZip = path.join(packageOutputDir, 'edutrack-production-complete.zip');

const frontendShaFile = path.join(packageOutputDir, 'edutrack-frontend-production.sha256');
const backendShaFile = path.join(packageOutputDir, 'edutrack-backend-production.sha256');
const completeShaFile = path.join(packageOutputDir, 'edutrack-production-complete.sha256');

// Helper to copy directory recursively with strict exclusions
function copyDirRecursive(src, dest, excludeList = []) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (excludeList.includes(entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath, excludeList);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function calculateSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

console.log('=== PREPARING SECURE PRODUCTION DEPLOYMENT PACKAGES (NO SECRETS) ===\n');

// 1. Clean Staging and Output Directory
if (fs.existsSync(stagingDir)) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
}
if (!fs.existsSync(packageOutputDir)) {
  fs.mkdirSync(packageOutputDir, { recursive: true });
}
fs.mkdirSync(stagingDir, { recursive: true });
fs.mkdirSync(frontendStaging, { recursive: true });
fs.mkdirSync(backendStaging, { recursive: true });

// 2. Stage Frontend Files (Excluding any real .env files, only .env.example)
console.log('1. Staging Frontend Files...');
const frontendFilesToCopy = [
  'package.json',
  'package-lock.json',
  'next.config.mjs',
  'tsconfig.json',
  'tailwind.config.ts',
  'postcss.config.js',
  'next-env.d.ts',
  '.env.example',
];

for (const file of frontendFilesToCopy) {
  const s = path.join(frontendSrc, file);
  const d = path.join(frontendStaging, file);
  if (fs.existsSync(s)) {
    fs.copyFileSync(s, d);
    console.log(`   + Copied: ${file}`);
  }
}

// Copy frontend public/ and src/
copyDirRecursive(path.join(frontendSrc, 'public'), path.join(frontendStaging, 'public'));
console.log('   + Copied directory: public/');
copyDirRecursive(path.join(frontendSrc, 'src'), path.join(frontendStaging, 'src'));
console.log('   + Copied directory: src/');

// 3. Stage Backend Files (Strictly excluding .env, .env.production, and firebase-service-account.json)
console.log('\n2. Staging Backend Files...');
const backendFilesToCopy = [
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'nest-cli.json',
  '.env.example',
  'validate_monthly_papa_attendance.js',
  'migrate_attendance_to_monthly_papa.js',
  'verify_tenant_isolation_suite.js',
];

for (const file of backendFilesToCopy) {
  const s = path.join(backendSrc, file);
  const d = path.join(backendStaging, file);
  if (fs.existsSync(s)) {
    fs.copyFileSync(s, d);
    console.log(`   + Copied: ${file}`);
  }
}

// Copy prisma/, src/, dist/, api/
copyDirRecursive(path.join(backendSrc, 'prisma'), path.join(backendStaging, 'prisma'), ['migrations_old']);
console.log('   + Copied directory: prisma/');
copyDirRecursive(path.join(backendSrc, 'src'), path.join(backendStaging, 'src'));
console.log('   + Copied directory: src/');
copyDirRecursive(path.join(backendSrc, 'dist'), path.join(backendStaging, 'dist'));
console.log('   + Copied directory: dist/');
if (fs.existsSync(path.join(backendSrc, 'api'))) {
  copyDirRecursive(path.join(backendSrc, 'api'), path.join(backendStaging, 'api'));
  console.log('   + Copied directory: api/');
}

// 4. Create ZIPs using PowerShell
console.log('\n3. Creating ZIP Archives in production-package/...');

if (fs.existsSync(frontendZip)) fs.unlinkSync(frontendZip);
if (fs.existsSync(backendZip)) fs.unlinkSync(backendZip);
if (fs.existsSync(completeZip)) fs.unlinkSync(completeZip);

// Compress Frontend
console.log('   Compressing edutrack-frontend-production.zip...');
execSync(`powershell -Command "Compress-Archive -Path '${frontendStaging}/*' -DestinationPath '${frontendZip}' -Force"`);

// Compress Backend
console.log('   Compressing edutrack-backend-production.zip...');
execSync(`powershell -Command "Compress-Archive -Path '${backendStaging}/*' -DestinationPath '${backendZip}' -Force"`);

// Compress Complete Package
console.log('   Compressing edutrack-production-complete.zip...');
execSync(`powershell -Command "Compress-Archive -Path '${stagingDir}/*' -DestinationPath '${completeZip}' -Force"`);

// 5. Clean up Staging Directory
fs.rmSync(stagingDir, { recursive: true, force: true });

// 6. Calculate Checksums
console.log('\n4. Generating SHA256 Checksums...');
const frontendSha = calculateSha256(frontendZip);
const backendSha = calculateSha256(backendZip);
const completeSha = calculateSha256(completeZip);

fs.writeFileSync(frontendShaFile, `${frontendSha}  edutrack-frontend-production.zip\n`, 'utf8');
fs.writeFileSync(backendShaFile, `${backendSha}  edutrack-backend-production.zip\n`, 'utf8');
fs.writeFileSync(completeShaFile, `${completeSha}  edutrack-production-complete.zip\n`, 'utf8');

const frontendStat = fs.statSync(frontendZip);
const backendStat = fs.statSync(backendZip);
const completeStat = fs.statSync(completeZip);

console.log('\n=== PRODUCTION PACKAGING COMPLETE ===');
console.log(`Frontend ZIP: ${frontendZip} (${(frontendStat.size / (1024 * 1024)).toFixed(2)} MB, ${frontendStat.size} bytes)`);
console.log(`Frontend SHA256: ${frontendSha}`);
console.log(`Backend ZIP:  ${backendZip} (${(backendStat.size / (1024 * 1024)).toFixed(2)} MB, ${backendStat.size} bytes)`);
console.log(`Backend SHA256:  ${backendSha}`);
console.log(`Complete ZIP: ${completeZip} (${(completeStat.size / (1024 * 1024)).toFixed(2)} MB, ${completeStat.size} bytes)`);
console.log(`Complete SHA256: ${completeSha}`);
