const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = __dirname;
const packageDir = path.join(rootDir, 'production-package');
const tempExtractDir = path.join(rootDir, '.temp_zip_validation');

const frontendZip = path.join(packageDir, 'edutrack-frontend-production.zip');
const backendZip = path.join(packageDir, 'edutrack-backend-production.zip');
const completeZip = path.join(packageDir, 'edutrack-production-complete.zip');

function countFilesRecursive(dir) {
  let files = 0;
  let dirs = 0;
  if (!fs.existsSync(dir)) return { files, dirs };

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      dirs++;
      const sub = countFilesRecursive(path.join(dir, entry.name));
      files += sub.files;
      dirs += sub.dirs;
    } else {
      files++;
    }
  }
  return { files, dirs };
}

console.log('=== VALIDATING PRODUCTION ZIP ARCHIVES ===\n');

if (fs.existsSync(tempExtractDir)) {
  fs.rmSync(tempExtractDir, { recursive: true, force: true });
}
fs.mkdirSync(tempExtractDir, { recursive: true });

const results = {};

// 1. Validate Frontend ZIP
console.log('1. Validating Frontend ZIP...');
const feExtract = path.join(tempExtractDir, 'frontend');
fs.mkdirSync(feExtract, { recursive: true });
execSync(`powershell -Command "Expand-Archive -Path '${frontendZip}' -DestinationPath '${feExtract}' -Force"`);

const feCounts = countFilesRecursive(feExtract);
const fePkgExists = fs.existsSync(path.join(feExtract, 'package.json'));
const feSrcExists = fs.existsSync(path.join(feExtract, 'src'));
const fePublicExists = fs.existsSync(path.join(feExtract, 'public'));
const feNextConfigExists = fs.existsSync(path.join(feExtract, 'next.config.mjs'));
const feEnvExampleExists = fs.existsSync(path.join(feExtract, '.env.example'));

results.frontend = {
  sizeBytes: fs.statSync(frontendZip).size,
  sizeMB: (fs.statSync(frontendZip).size / (1024 * 1024)).toFixed(2),
  totalFiles: feCounts.files,
  totalDirectories: feCounts.dirs,
  packageJson: fePkgExists ? 'PASS' : 'FAIL',
  srcDir: feSrcExists ? 'PASS' : 'FAIL',
  publicDir: fePublicExists ? 'PASS' : 'FAIL',
  nextConfig: feNextConfigExists ? 'PASS' : 'FAIL',
  envExample: feEnvExampleExists ? 'PASS' : 'FAIL',
  status: (fePkgExists && feSrcExists && fePublicExists) ? 'PASS' : 'FAIL'
};
console.log(`   Frontend ZIP: ${results.frontend.totalFiles} files, ${results.frontend.sizeMB} MB -> ${results.frontend.status}`);

// 2. Validate Backend ZIP
console.log('\n2. Validating Backend ZIP...');
const beExtract = path.join(tempExtractDir, 'backend');
fs.mkdirSync(beExtract, { recursive: true });
execSync(`powershell -Command "Expand-Archive -Path '${backendZip}' -DestinationPath '${beExtract}' -Force"`);

const beCounts = countFilesRecursive(beExtract);
const bePkgExists = fs.existsSync(path.join(beExtract, 'package.json'));
const beSrcExists = fs.existsSync(path.join(beExtract, 'src'));
const beDistExists = fs.existsSync(path.join(beExtract, 'dist'));
const bePrismaExists = fs.existsSync(path.join(beExtract, 'prisma', 'schema.prisma'));
const beEnvExampleExists = fs.existsSync(path.join(beExtract, '.env.example'));

results.backend = {
  sizeBytes: fs.statSync(backendZip).size,
  sizeMB: (fs.statSync(backendZip).size / (1024 * 1024)).toFixed(2),
  totalFiles: beCounts.files,
  totalDirectories: beCounts.dirs,
  packageJson: bePkgExists ? 'PASS' : 'FAIL',
  srcDir: beSrcExists ? 'PASS' : 'FAIL',
  distDir: beDistExists ? 'PASS' : 'FAIL',
  prismaSchema: bePrismaExists ? 'PASS' : 'FAIL',
  envExample: beEnvExampleExists ? 'PASS' : 'FAIL',
  status: (bePkgExists && beSrcExists && beDistExists && bePrismaExists) ? 'PASS' : 'FAIL'
};
console.log(`   Backend ZIP: ${results.backend.totalFiles} files, ${results.backend.sizeMB} MB -> ${results.backend.status}`);

// 3. Validate Complete ZIP
console.log('\n3. Validating Combined Complete ZIP...');
const compExtract = path.join(tempExtractDir, 'complete');
fs.mkdirSync(compExtract, { recursive: true });
execSync(`powershell -Command "Expand-Archive -Path '${completeZip}' -DestinationPath '${compExtract}' -Force"`);

const compCounts = countFilesRecursive(compExtract);
const compFeExists = fs.existsSync(path.join(compExtract, 'frontend', 'package.json'));
const compBeExists = fs.existsSync(path.join(compExtract, 'backend', 'package.json'));

results.complete = {
  sizeBytes: fs.statSync(completeZip).size,
  sizeMB: (fs.statSync(completeZip).size / (1024 * 1024)).toFixed(2),
  totalFiles: compCounts.files,
  totalDirectories: compCounts.dirs,
  frontendPresent: compFeExists ? 'PASS' : 'FAIL',
  backendPresent: compBeExists ? 'PASS' : 'FAIL',
  status: (compFeExists && compBeExists) ? 'PASS' : 'FAIL'
};
console.log(`   Complete ZIP: ${results.complete.totalFiles} files, ${results.complete.sizeMB} MB -> ${results.complete.status}`);

// Clean up temp extraction
fs.rmSync(tempExtractDir, { recursive: true, force: true });

console.log('\n=== VALIDATION SUMMARY ===');
console.log(JSON.stringify(results, null, 2));
