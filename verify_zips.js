const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function inspectZip(zipFile) {
  const result = execSync(`powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::OpenRead('${zipFile}').Entries | Select-Object -Property FullName, Length | ConvertTo-Json -Compress"`).toString();
  return JSON.parse(result);
}

const frontendEntries = inspectZip('edutrack-frontend-production.zip');
const backendEntries = inspectZip('edutrack-backend-production.zip');

console.log('=== FRONTEND ZIP VERIFICATION ===');
console.log(`Total Entries: ${frontendEntries.length}`);
const frontendRoot = frontendEntries.filter(e => !e.FullName.includes('/') && !e.FullName.includes('\\'));
console.log('Root Files in Frontend ZIP:');
frontendRoot.forEach(e => console.log(` - ${e.FullName} (${e.Length} bytes)`));

console.log('\n=== BACKEND ZIP VERIFICATION ===');
console.log(`Total Entries: ${backendEntries.length}`);
const backendRoot = backendEntries.filter(e => !e.FullName.includes('/') && !e.FullName.includes('\\'));
console.log('Root Files in Backend ZIP:');
backendRoot.forEach(e => console.log(` - ${e.FullName} (${e.Length} bytes)`));

// Assertions
const checkContains = (entries, target) => entries.some(e => e.FullName === target || e.FullName.startsWith(target));
const checkDoesNotContain = (entries, target) => !entries.some(e => e.FullName.includes(target));

console.log('\n=== AUDIT ASSERTIONS ===');
console.log('Frontend has package.json at root:', checkContains(frontendEntries, 'package.json'));
console.log('Frontend has .env.production at root:', checkContains(frontendEntries, '.env.production'));
console.log('Frontend excludes node_modules:', checkDoesNotContain(frontendEntries, 'node_modules'));
console.log('Frontend excludes .next:', checkDoesNotContain(frontendEntries, '.next'));
console.log('Frontend excludes .git:', checkDoesNotContain(frontendEntries, '.git'));

console.log('\nBackend has package.json at root:', checkContains(backendEntries, 'package.json'));
console.log('Backend has .env.production at root:', checkContains(backendEntries, '.env.production'));
console.log('Backend has firebase-service-account.json at root:', checkContains(backendEntries, 'firebase-service-account.json'));
console.log('Backend has prisma/schema.prisma:', checkContains(backendEntries, 'prisma/schema.prisma') || checkContains(backendEntries, 'prisma\\schema.prisma'));
console.log('Backend excludes node_modules:', checkDoesNotContain(backendEntries, 'node_modules'));
console.log('Backend excludes dist:', checkDoesNotContain(backendEntries, 'dist'));
console.log('Backend excludes .git:', checkDoesNotContain(backendEntries, '.git'));
