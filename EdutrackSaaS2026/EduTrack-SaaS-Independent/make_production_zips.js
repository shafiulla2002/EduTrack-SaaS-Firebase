const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const rootDir = __dirname;
const frontendDir = path.join(rootDir, 'frontend');
const backendDir = path.join(rootDir, 'backend');

const stagingDir = path.join(rootDir, '.production_staging_temp');
const frontendStaging = path.join(stagingDir, 'frontend');
const backendStaging = path.join(stagingDir, 'backend');

const frontendZip = path.join(rootDir, 'CS-EduTrack-Frontend-Production.zip');
const backendZip = path.join(rootDir, 'CS-EduTrack-Backend-Production.zip');

const frontendShaFile = path.join(rootDir, 'CS-EduTrack-Frontend-Production.sha256');
const backendShaFile = path.join(rootDir, 'CS-EduTrack-Backend-Production.sha256');

console.log('=== STARTING CLEAN PRODUCTION PACKAGING ===\n');

// Clean staging & existing zips
if (fs.existsSync(stagingDir)) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
}
if (fs.existsSync(frontendZip)) fs.unlinkSync(frontendZip);
if (fs.existsSync(backendZip)) fs.unlinkSync(backendZip);

fs.mkdirSync(frontendStaging, { recursive: true });
fs.mkdirSync(backendStaging, { recursive: true });

// 1. Stage Frontend
console.log('1. Staging Frontend files...');
const feFiles = [
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

for (const f of feFiles) {
  const src = path.join(frontendDir, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(frontendStaging, f));
  }
}

fs.cpSync(path.join(frontendDir, 'public'), path.join(frontendStaging, 'public'), { recursive: true });
fs.cpSync(path.join(frontendDir, 'src'), path.join(frontendStaging, 'src'), { recursive: true });

// Copy .next excluding cache
fs.cpSync(path.join(frontendDir, '.next'), path.join(frontendStaging, '.next'), {
  recursive: true,
  filter: (src) => !src.includes(path.join('.next', 'cache')),
});
console.log('   -> Frontend staged successfully.');

// 2. Stage Backend
console.log('\n2. Staging Backend files...');
const beFiles = [
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'nest-cli.json',
  '.env.example',
  'fly.toml',
];

for (const f of beFiles) {
  const src = path.join(backendDir, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(backendStaging, f));
  }
}

fs.cpSync(path.join(backendDir, 'prisma'), path.join(backendStaging, 'prisma'), {
  recursive: true,
  filter: (src) => !src.includes('migrations_old'),
});

fs.cpSync(path.join(backendDir, 'src'), path.join(backendStaging, 'src'), { recursive: true });
fs.cpSync(path.join(backendDir, 'dist'), path.join(backendStaging, 'dist'), { recursive: true });

if (fs.existsSync(path.join(backendDir, 'api'))) {
  fs.cpSync(path.join(backendDir, 'api'), path.join(backendStaging, 'api'), { recursive: true });
}
console.log('   -> Backend staged successfully.');

// 3. Compress Archives
console.log('\n3. Compressing ZIP Archives...');

const feCmd = `powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${frontendStaging}', '${frontendZip}', [System.IO.Compression.CompressionLevel]::Optimal, $false)"`;
console.log('   Compressing Frontend...');
execSync(feCmd);

const beCmd = `powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${backendStaging}', '${backendZip}', [System.IO.Compression.CompressionLevel]::Optimal, $false)"`;
console.log('   Compressing Backend...');
execSync(beCmd);

// 4. Cleanup Staging
fs.rmSync(stagingDir, { recursive: true, force: true });

// 5. Generate SHA256 Checksums
console.log('\n4. Generating Checksums...');
function sha256(file) {
  const buf = fs.readFileSync(file);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

const feSha = sha256(frontendZip);
const beSha = sha256(backendZip);

fs.writeFileSync(frontendShaFile, `${feSha}  CS-EduTrack-Frontend-Production.zip\n`, 'utf8');
fs.writeFileSync(backendShaFile, `${beSha}  CS-EduTrack-Backend-Production.zip\n`, 'utf8');

const feStat = fs.statSync(frontendZip);
const beStat = fs.statSync(backendZip);

console.log('\n======================================================');
console.log('=== CS EDUTRACK PRODUCTION PACKAGING COMPLETE ===');
console.log('======================================================');
console.log(`Frontend ZIP: ${frontendZip}`);
console.log(`Frontend Size: ${(feStat.size / (1024 * 1024)).toFixed(2)} MB (${feStat.size} bytes)`);
console.log(`Frontend SHA256: ${feSha}`);
console.log('------------------------------------------------------');
console.log(`Backend ZIP:  ${backendZip}`);
console.log(`Backend Size:  ${(beStat.size / (1024 * 1024)).toFixed(2)} MB (${beStat.size} bytes)`);
console.log(`Backend SHA256:  ${beSha}`);
console.log('======================================================\n');
