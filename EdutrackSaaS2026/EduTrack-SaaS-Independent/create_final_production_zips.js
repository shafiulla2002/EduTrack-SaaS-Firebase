const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const rootDir = __dirname;
const frontendSrc = path.join(rootDir, 'frontend');
const backendSrc = path.join(rootDir, 'backend');

const stagingDir = path.join(rootDir, '.production_staging_' + Date.now());
const frontendStaging = path.join(stagingDir, 'frontend');
const backendStaging = path.join(stagingDir, 'backend');

const frontendZip = path.join(rootDir, 'CS-EduTrack-Frontend-Production.zip');
const backendZip = path.join(rootDir, 'CS-EduTrack-Backend-Production.zip');

const frontendShaFile = path.join(rootDir, 'CS-EduTrack-Frontend-Production.sha256');
const backendShaFile = path.join(rootDir, 'CS-EduTrack-Backend-Production.sha256');

function copyDirRecursive(src, dest, excludeNames = []) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    if (excludeNames.includes(entry.name)) {
      continue;
    }

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath, excludeNames);
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

console.log('=== PREPARING FINAL PRODUCTION PACKAGES ===\n');

// 1. Create Staging Directories
fs.mkdirSync(stagingDir, { recursive: true });
fs.mkdirSync(frontendStaging, { recursive: true });
fs.mkdirSync(backendStaging, { recursive: true });

// 2. Stage Frontend Files
console.log('1. Staging Frontend Files...');
const frontendFiles = [
  'package.json',
  'package-lock.json',
  'next.config.mjs',
  'server.js',
  'tsconfig.json',
  'tailwind.config.ts',
  'postcss.config.js',
  'next-env.d.ts',
  '.env.example',
];

for (const file of frontendFiles) {
  const s = path.join(frontendSrc, file);
  const d = path.join(frontendStaging, file);
  if (fs.existsSync(s)) {
    fs.copyFileSync(s, d);
    console.log(`   + Copied: ${file}`);
  }
}

// Copy public/, src/, and .next/ (excluding cache)
copyDirRecursive(path.join(frontendSrc, 'public'), path.join(frontendStaging, 'public'));
console.log('   + Copied directory: public/');

copyDirRecursive(path.join(frontendSrc, 'src'), path.join(frontendStaging, 'src'));
console.log('   + Copied directory: src/');

copyDirRecursive(path.join(frontendSrc, '.next'), path.join(frontendStaging, '.next'), ['cache']);
console.log('   + Copied directory: .next/ (excluding cache)');

// 3. Stage Backend Files
console.log('\n2. Staging Backend Files...');
const backendFiles = [
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'nest-cli.json',
  '.env.example',
  'fly.toml',
];

for (const file of backendFiles) {
  const s = path.join(backendSrc, file);
  const d = path.join(backendStaging, file);
  if (fs.existsSync(s)) {
    fs.copyFileSync(s, d);
    console.log(`   + Copied: ${file}`);
  }
}

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

// 4. Create ZIPs using .NET ZipFile (Fast, Robust, Standard ZIP)
console.log('\n3. Creating Production ZIP Archives...');

if (fs.existsSync(frontendZip)) fs.unlinkSync(frontendZip);
if (fs.existsSync(backendZip)) fs.unlinkSync(backendZip);

console.log('   Compressing CS-EduTrack-Frontend-Production.zip...');
execSync(`powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${frontendStaging.replace(/'/g, "''")}', '${frontendZip.replace(/'/g, "''")}', [System.IO.Compression.CompressionLevel]::Optimal, $false)"`);

console.log('   Compressing CS-EduTrack-Backend-Production.zip...');
execSync(`powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${backendStaging.replace(/'/g, "''")}', '${backendZip.replace(/'/g, "''")}', [System.IO.Compression.CompressionLevel]::Optimal, $false)"`);

// 5. Clean up Staging Directory
fs.rmSync(stagingDir, { recursive: true, force: true });

// 6. Calculate Checksums
console.log('\n4. Generating SHA256 Checksums...');
const frontendSha = calculateSha256(frontendZip);
const backendSha = calculateSha256(backendZip);

fs.writeFileSync(frontendShaFile, `${frontendSha}  CS-EduTrack-Frontend-Production.zip\n`, 'utf8');
fs.writeFileSync(backendShaFile, `${backendSha}  CS-EduTrack-Backend-Production.zip\n`, 'utf8');

const frontendStat = fs.statSync(frontendZip);
const backendStat = fs.statSync(backendZip);

console.log('\n=== PRODUCTION PACKAGING COMPLETE ===');
console.log(`Frontend ZIP: ${frontendZip} (${(frontendStat.size / (1024 * 1024)).toFixed(2)} MB, ${frontendStat.size} bytes)`);
console.log(`Frontend SHA256: ${frontendSha}`);
console.log(`Backend ZIP:  ${backendZip} (${(backendStat.size / (1024 * 1024)).toFixed(2)} MB, ${backendStat.size} bytes)`);
console.log(`Backend SHA256:  ${backendSha}`);
