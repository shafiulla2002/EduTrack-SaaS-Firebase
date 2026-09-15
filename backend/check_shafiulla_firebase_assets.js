const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SHAFIULLA_TENANT_ID = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';

async function main() {
  console.log('=== SHAFIULLA HIGH SCHOOL FIREBASE & ASSET STORAGE ANALYSIS ===');

  const tenant = await prisma.tenant.findUnique({
    where: { id: SHAFIULLA_TENANT_ID },
    select: { id: true, name: true, logoUrl: true }
  });

  const studentsWithPhotos = await prisma.studentProfile.count({
    where: {
      tenantId: SHAFIULLA_TENANT_ID,
      profilePhotoUrl: { not: null }
    }
  });

  const usersWithAvatars = await prisma.user.count({
    where: {
      tenantId: SHAFIULLA_TENANT_ID,
      avatarUrl: { not: null }
    }
  });

  const totalStudents = await prisma.studentProfile.count({
    where: { tenantId: SHAFIULLA_TENANT_ID }
  });

  console.log({
    tenantName: tenant?.name,
    logoUrl: tenant?.logoUrl || 'None',
    totalStudents,
    studentsWithPhotosInFirebaseStorage: studentsWithPhotos,
    usersWithAvatarsInFirebaseStorage: usersWithAvatars
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
