const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const buildCleanClassesDir = 'c:\\VikasSchool\\build-clean\\main\\default\\classes';
const buildCleanObjectsDir = 'c:\\VikasSchool\\build-clean\\main\\default\\objects';

function runSfQuery(query) {
    const cmd = `sf data query -q "${query}" -t -o CSorg1 --json`;
    const result = execSync(cmd).toString();
    return JSON.parse(result).result.records;
}

function runSfMetadataList(type) {
    const cmd = `sf org list metadata -m ${type} -o CSorg1 --json`;
    const result = execSync(cmd).toString();
    return JSON.parse(result).result;
}

console.log('Analyzing package components vs CSorg1 state...\n');

// 1. Apex Classes
const csorgClasses = runSfMetadataList('ApexClass').map(c => c.fullName);
const packageClasses = fs.readdirSync(buildCleanClassesDir)
    .filter(f => f.endsWith('.cls'))
    .map(f => f.replace('.cls', ''));

const inPackageButNotInOrgClasses = packageClasses.filter(c => !csorgClasses.includes(c));

// 2. Objects
const csorgCustomObjects = runSfQuery('SELECT Id, DeveloperName FROM CustomObject');
const objIdToName = {};
csorgCustomObjects.forEach(o => {
    objIdToName[o.Id] = o.DeveloperName + '__c';
});
const csorgObjectNames = Object.values(objIdToName);

const packageObjects = fs.readdirSync(buildCleanObjectsDir).filter(f => !f.includes('.'));
const inPackageButNotInOrgObjects = packageObjects.filter(o => o.endsWith('__c') && !csorgObjectNames.includes(o));

// 3. Fields
const csorgFields = runSfQuery('SELECT DeveloperName, TableEnumOrId FROM CustomField');
const fieldsByObject = {};
csorgFields.forEach(f => {
    let objName = f.TableEnumOrId;
    if (objIdToName[objName]) objName = objIdToName[objName];
    if (!fieldsByObject[objName]) fieldsByObject[objName] = [];
    fieldsByObject[objName].push(f.DeveloperName + '__c');
});

const inPackageButNotInOrgFields = {};
let totalMissingFields = 0;

packageObjects.forEach(obj => {
    const packageFieldsPath = path.join(buildCleanObjectsDir, obj, 'fields');
    if (fs.existsSync(packageFieldsPath)) {
        const packageFields = fs.readdirSync(packageFieldsPath).map(f => f.split('.')[0]);
        const orgFields = fieldsByObject[obj] || [];
        
        const missing = packageFields.filter(f => f.endsWith('__c') && !orgFields.includes(f));
        if (missing.length > 0) {
            inPackageButNotInOrgFields[obj] = missing;
            totalMissingFields += missing.length;
        }
    }
});

console.log('--- REVERSE AUDIT: In Package but MISSING from CSorg1 ---');
console.log(`\n1. Apex Classes in Package but NOT in Org: ${inPackageButNotInOrgClasses.length}`);
if (inPackageButNotInOrgClasses.length > 0) {
    console.log(`   List: ${inPackageButNotInOrgClasses.join(', ')}`);
}

console.log(`\n2. Custom Objects in Package but NOT in Org: ${inPackageButNotInOrgObjects.length}`);
if (inPackageButNotInOrgObjects.length > 0) {
    console.log(`   List: ${inPackageButNotInOrgObjects.join(', ')}`);
}

console.log(`\n3. Custom Fields in Package but NOT in Org: ${totalMissingFields}`);
for (const [obj, fields] of Object.entries(inPackageButNotInOrgFields)) {
    console.log(`   - ${obj}: ${fields.join(', ')}`);
}
