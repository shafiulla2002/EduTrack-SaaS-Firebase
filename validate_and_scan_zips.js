const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = __dirname;
const packageDir = path.join(rootDir, 'production-package');
const tempExtractDir = path.join(rootDir, '.temp_zip_security_validation');

const frontendZip = path.join(packageDir, 'edutrack-frontend-production.zip');
const backendZip = path.join(packageDir, 'edutrack-backend-production.zip');
const completeZip = path.join(packageDir, 'edutrack-production-complete.zip');

function countAndScanFilesRecursive(dir, forbiddenNames, forbiddenPatterns) {
  let fileCount = 0;
  let dirCount = 0;
  let violations = [];

  if (!fs.existsSync(dir)) return { fileCount, dirCount, violations };

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    // Check forbidden file names
    if (forbiddenNames.includes(entry.name.toLowerCase())) {
      violations.push(`Forbidden file found: ${entry.name} at ${fullPath}`);
    }

    if (entry.isDirectory()) {
      dirCount++;
      const sub = countAndScanFilesRecursive(fullPath, forbiddenNames, forbiddenPatterns);
      fileCount += sub.fileCount;
      dirCount += sub.dirCount;
      violations = violations.concat(sub.violations);
    } else {
      fileCount++;
      // Scan content for dangerous secrets if text file
      if (entry.name.endsWith('.js') || entry.name.endsWith('.json') || entry.name.endsWith('.env') || entry.name.endsWith('.ts')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          for (const pattern of forbiddenPatterns) {
            if (pattern.test(content)) {
              violations.push(`Forbidden secret pattern matched in ${fullPath}`);
            }
          }
        } catch (e) {}
      }
    }
  }

  return { fileCount, dirCount, violations };
}

console.log('=== RUNNING DEEP ZIP EXTRACTION AND SECURITY SCAN ===\n');

if (fs.existsSync(tempExtractDir)) {
  fs.rmSync(tempExtractDir, { recursive: true, force: true });
}
fs.mkdirSync(tempExtractDir, { recursive: true });

const forbiddenNames = [
  '.env',
  '.env.local',
  '.env.production',
  'firebase-service-account.json',
  'service-account.json',
  'id_rsa',
  'private_key.pem',
];

const forbiddenPatterns = [
  /-----BEGIN PRIVATE KEY-----/,
  /-----BEGIN RSA PRIVATE KEY-----/,
  /Vz8oYPOYf0yOJ2st13r0abn0/, // Live razorpay secret
];

// 1. Validate Frontend ZIP
console.log('1. Extracting and Scanning Frontend ZIP...');
const feExtract = path.join(tempExtractDir, 'frontend');
fs.mkdirSync(feExtract, { recursive: true });
execSync(`powershell -Command "Expand-Archive -Path '${frontendZip}' -DestinationPath '${feExtract}' -Force"`);
const feScan = countAndScanFilesRecursive(feExtract, forbiddenNames, forbiddenPatterns);

const fePkg = fs.existsSync(path.join(feExtract, 'package.json'));
const feSrc = fs.existsSync(path.join(feExtract, 'src'));
const fePublic = fs.existsSync(path.join(feExtract, 'public'));
const feNextConfig = fs.existsSync(path.join(feExtract, 'next.config.mjs'));
const feEnvExample = fs.existsSync(path.join(feExtract, '.env.example'));

// 2. Validate Backend ZIP
console.log('2. Extracting and Scanning Backend ZIP...');
const beExtract = path.join(tempExtractDir, 'backend');
fs.mkdirSync(beExtract, { recursive: true });
execSync(`powershell -Command "Expand-Archive -Path '${backendZip}' -DestinationPath '${beExtract}' -Force"`);
const beScan = countAndScanFilesRecursive(beExtract, forbiddenNames, forbiddenPatterns);

const bePkg = fs.existsSync(path.join(beExtract, 'package.json'));
const beSrc = fs.existsSync(path.join(beExtract, 'src'));
const beDist = fs.existsSync(path.join(beExtract, 'dist'));
const bePrisma = fs.existsSync(path.join(beExtract, 'prisma', 'schema.prisma'));
const beEnvExample = fs.existsSync(path.join(beExtract, '.env.example'));

// 3. Validate Complete ZIP
console.log('3. Extracting and Scanning Complete ZIP...');
const compExtract = path.join(tempExtractDir, 'complete');
fs.mkdirSync(compExtract, { recursive: true });
execSync(`powershell -Command "Expand-Archive -Path '${completeZip}' -DestinationPath '${compExtract}' -Force"`);
const compScan = countAndScanFilesRecursive(compExtract, forbiddenNames, forbiddenPatterns);

// Clean up temp
fs.rmSync(tempExtractDir, { recursive: true, force: true });

console.log('\n=== SECURITY SCAN RESULTS ===');
console.log('Frontend Violations:', feScan.violations.length === 0 ? 'NONE (PASS)' : feScan.violations);
console.log('Backend Violations:', beScan.violations.length === 0 ? 'NONE (PASS)' : beScan.violations);
console.log('Complete ZIP Violations:', compScan.violations.length === 0 ? 'NONE (PASS)' : compScan.violations);

console.log('\n=== DETAILED METRICS ===');
console.log(JSON.stringify({
  frontend: {
    sizeBytes: fs.statSync(frontendZip).size,
    fileCount: feScan.fileCount,
    packageJson: fePkg ? 'PASS' : 'FAIL',
    src: feSrc ? 'PASS' : 'FAIL',
    public: fePublic ? 'PASS' : 'FAIL',
    nextConfig: feNextConfig ? 'PASS' : 'FAIL',
    envExample: feEnvExample ? 'PASS' : 'FAIL',
    secretsFound: feScan.violations.length > 0 ? 'YES' : 'NO'
  },
  backend: {
    sizeBytes: fs.statSync(backendZip).size,
    fileCount: beScan.fileCount,
    packageJson: bePkg ? 'PASS' : 'FAIL',
    dist: beDist ? 'PASS' : 'FAIL',
    prismaSchema: bePrisma ? 'PASS' : 'FAIL',
    src: beSrc ? 'PASS' : 'FAIL',
    envExample: beEnvExample ? 'PASS' : 'FAIL',
    secretsFound: beScan.violations.length > 0 ? 'YES' : 'NO'
  },
  complete: {
    sizeBytes: fs.statSync(completeZip).size,
    fileCount: compScan.fileCount,
    secretsFound: compScan.violations.length > 0 ? 'YES' : 'NO'
  }
}, null, 2));
