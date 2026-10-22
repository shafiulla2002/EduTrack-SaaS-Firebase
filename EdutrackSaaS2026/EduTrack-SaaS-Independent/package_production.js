const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const rootDir = __dirname;
const frontendSrc = path.join(rootDir, 'frontend');
const backendSrc = path.join(rootDir, 'backend');

const stagingDir = path.join(rootDir, '.production_staging');
const frontendStaging = path.join(stagingDir, 'frontend');
const backendStaging = path.join(stagingDir, 'backend');

const frontendZip = path.join(rootDir, 'edutrack-frontend-production.zip');
const backendZip = path.join(rootDir, 'edutrack-backend-production.zip');

const frontendShaFile = path.join(rootDir, 'edutrack-frontend-production.sha256');
const backendShaFile = path.join(rootDir, 'edutrack-backend-production.sha256');

// Helper to copy directory recursively excluding patterns
function copyDirRecursive(src, dest, excludeList = []) {
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

console.log('=== PREPARING PRODUCTION DEPLOYMENT PACKAGES ===\n');

// 1. Clean Staging Directory
if (fs.existsSync(stagingDir)) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
}
fs.mkdirSync(stagingDir, { recursive: true });
fs.mkdirSync(frontendStaging, { recursive: true });
fs.mkdirSync(backendStaging, { recursive: true });

// 2. Stage Frontend Files
console.log('1. Staging Frontend Files...');
const frontendFilesToCopy = [
  'package.json',
  'package-lock.json',
  'next.config.mjs',
  'tsconfig.json',
  'tailwind.config.ts',
  'postcss.config.js',
  'next-env.d.ts',
  '.env.production',
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

// Copy public/ and src/
copyDirRecursive(path.join(frontendSrc, 'public'), path.join(frontendStaging, 'public'));
console.log('   + Copied directory: public/');
copyDirRecursive(path.join(frontendSrc, 'src'), path.join(frontendStaging, 'src'));
console.log('   + Copied directory: src/');

// 3. Stage Backend Files
console.log('\n2. Staging Backend Files...');
const backendFilesToCopy = [
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'nest-cli.json',
  '.env.production',
  '.env.example',
  'firebase-service-account.json',
];

for (const file of backendFilesToCopy) {
  const s = path.join(backendSrc, file);
  const d = path.join(backendStaging, file);
  if (fs.existsSync(s)) {
    fs.copyFileSync(s, d);
    console.log(`   + Copied: ${file}`);
  }
}

// Copy prisma/ and src/ and api/
copyDirRecursive(path.join(backendSrc, 'prisma'), path.join(backendStaging, 'prisma'), ['migrations_old']);
console.log('   + Copied directory: prisma/');
copyDirRecursive(path.join(backendSrc, 'src'), path.join(backendStaging, 'src'));
console.log('   + Copied directory: src/');
if (fs.existsSync(path.join(backendSrc, 'api'))) {
  copyDirRecursive(path.join(backendSrc, 'api'), path.join(backendStaging, 'api'));
  console.log('   + Copied directory: api/');
}

// 4. Create ZIPs using PowerShell (fast native compression without node_modules)
console.log('\n3. Creating ZIP Archives...');

if (fs.existsSync(frontendZip)) fs.unlinkSync(frontendZip);
if (fs.existsSync(backendZip)) fs.unlinkSync(backendZip);

// Compress Frontend (ensuring contents are at zip root)
console.log('   Creating edutrack-frontend-production.zip...');
execSync(`powershell -Command "Compress-Archive -Path '${frontendStaging}/*' -DestinationPath '${frontendZip}' -Force"`);

// Compress Backend (ensuring contents are at zip root)
console.log('   Creating edutrack-backend-production.zip...');
execSync(`powershell -Command "Compress-Archive -Path '${backendStaging}/*' -DestinationPath '${backendZip}' -Force"`);

// 5. Clean up Staging Directory
fs.rmSync(stagingDir, { recursive: true, force: true });

// 6. Calculate Checksums
console.log('\n4. Generating SHA256 Checksums...');
const frontendSha = calculateSha256(frontendZip);
const backendSha = calculateSha256(backendZip);

fs.writeFileSync(frontendShaFile, `${frontendSha}  edutrack-frontend-production.zip\n`, 'utf8');
fs.writeFileSync(backendShaFile, `${backendSha}  edutrack-backend-production.zip\n`, 'utf8');

const frontendStat = fs.statSync(frontendZip);
const backendStat = fs.statSync(backendZip);

console.log('\n=== PRODUCTION PACKAGING COMPLETE ===');
console.log(`Frontend ZIP: ${frontendZip} (${(frontendStat.size / (1024 * 1024)).toFixed(2)} MB)`);
console.log(`Frontend SHA256: ${frontendSha}`);
console.log(`Backend ZIP:  ${backendZip} (${(backendStat.size / (1024 * 1024)).toFixed(2)} MB)`);
console.log(`Backend SHA256:  ${backendSha}`);
