import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seeding...');

  // 1. Clean old entries
  const dbUrl = process.env.DATABASE_URL || '';
  const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
  const allowDestructive = process.env.ALLOW_DESTRUCTIVE_SEED === 'true';

  if (!isLocal && !allowDestructive) {
    console.error('========================================================================');
    console.error('WARNING: Destructive seeding blocked!');
    console.error('The database URL does not point to localhost, and ALLOW_DESTRUCTIVE_SEED is not true.');
    console.error('Seeding is aborted to prevent accidental data loss in shared/production.');
    console.error('========================================================================');
    throw new Error('Destructive seeding blocked on remote database');
  }

  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Tenant" CASCADE;`);
  console.log('Cleared existing database records.');

  const passwordHash = await bcrypt.hash('Password@123', 10);

  // 2. Create Reference School: Synergy High School
  const tenantB = await prisma.tenant.create({
    data: {
      name: 'Synergy High School',
      subDomain: 'synergy-school',
      logoUrl: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?q=80&w=200&auto=format&fit=crop',
      address: '456 Synergy Parkway, Tech Valley',
      email: 'admissions@synergy.edu',
      phone: '987-654-3210',
      subtitle: 'Innovation through Collaboration',
      setupCompleted: true,
      bankName: 'National Bank',
      bankBranch: 'Tech Valley Branch',
      bankIFSC: 'NB0001234',
      bankAccountNo: '9876543210',
      googlePayId: 'gpay-synergy@okaxis',
      phonePeId: 'ppe-synergy@ybl',
    },
  });
  console.log(`Created Tenant: ${tenantB.name} (${tenantB.subDomain})`);

  // Academic Year for Synergy High School
  const yearB_2026 = await prisma.academicYear.create({
    data: {
      name: '2026-2027',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2027-05-31'),
      isActive: true,
      tenantId: tenantB.id,
    },
  });
  console.log(`Created Academic Year for Synergy High School`);

  // School Admin for Synergy High School
  const adminB = await prisma.user.create({
    data: {
      email: 'admin@synergy.edu',
      passwordHash,
      name: 'Synergy Administrator',
      role: Role.SCHOOL_ADMIN,
      phone: '9876543210',
      tenantId: tenantB.id,
    },
  });
  console.log(`Created Admin User for Synergy High School`);

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
