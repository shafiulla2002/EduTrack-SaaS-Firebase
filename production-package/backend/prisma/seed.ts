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

  // 2. Create Tenant A: Demo Public School
  const tenantA = await prisma.tenant.create({
    data: {
      name: 'Demo Public School',
      subDomain: 'demo-school',
      logoUrl: 'https://images.unsplash.com/photo-1592280771190-3e2e4d571952?q=80&w=200&auto=format&fit=crop',
      address: '123 Academy Lane, Education City',
      email: 'info@demoschool.com',
      phone: '123-456-7890',
      subtitle: 'Nurturing Minds, Shaping Futures',
      setupCompleted: true,
      bankName: 'National Education Bank',
      bankBranch: 'Main City Branch',
      bankIFSC: 'NEB0001234',
      bankAccountNo: '9876543210',
      googlePayId: 'gpay-demoschool@okaxis',
      phonePeId: 'ppe-demoschool@ybl',
    },
  });
  console.log(`Created Tenant A: ${tenantA.name} (${tenantA.subDomain})`);

  // 3. Create Tenant B: Synergy High School
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
    },
  });
  console.log(`Created Tenant B: ${tenantB.name} (${tenantB.subDomain})`);

  // Academic Years for Tenant A
  const yearA_2026 = await prisma.academicYear.create({
    data: {
      name: '2026-2027',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2027-05-31'),
      isActive: true,
      tenantId: tenantA.id,
    },
  });
  console.log(`Created Academic Year for Tenant A`);

  // School Admin for Tenant A
  const adminA = await prisma.user.create({
    data: {
      email: 'admin@demoschool.com',
      passwordHash,
      name: 'Principal Sarah Jenkins',
      role: Role.SCHOOL_ADMIN,
      phone: '1112223333',
      tenantId: tenantA.id,
    },
  });
  console.log(`Created Admin User for Tenant A`);

  // 4. Create Driver for Tenant A
  const driverUser = await prisma.user.create({
    data: {
      email: 'driver@demoschool.com',
      passwordHash,
      name: 'Driver John Doe',
      role: Role.DRIVER,
      phone: '9638527410',
      tenantId: tenantA.id,
    },
  });
  const driverProfile = await prisma.staffProfile.create({
    data: {
      userId: driverUser.id,
      employeeId: 'DRV-1001',
      designation: 'Bus Driver',
      staffCategory: 'NON_TEACHING',
      staffRole: 'Driver',
      licenseNumber: 'LIC-998877',
      experienceYears: 5,
      status: 'Active',
      tenantId: tenantA.id,
    },
  });
  console.log(`Created Driver Profile for Tenant A`);

  // 5. Create Route & Stop for Tenant A
  const route = await prisma.busRoute.create({
    data: {
      routeName: 'Route 1 - East Line',
      startPoint: 'Kharadi Bypass Depot',
      endPoint: 'Demo Public School Campus',
      tenantId: tenantA.id,
    },
  });
  const stop = await prisma.busStop.create({
    data: {
      routeId: route.id,
      stopName: 'Viman Nagar Main Stop',
      sequenceOrder: 1,
      pickupTime: '07:45 AM',
      dropTime: '02:45 PM',
      lat: 18.5679,
      lng: 73.9143,
    },
  });
  console.log(`Created Route & Bus Stop for Tenant A`);

  // 6. Create Bus for Tenant A
  const bus = await prisma.bus.create({
    data: {
      busNumber: 'BUS-101',
      registrationNo: 'MH-12-FE-4321',
      vehicleModel: 'Tata Starbus 40-Seater',
      capacity: 40,
      pickupTime: '07:30 AM',
      dropTime: '02:30 PM',
      status: 'ACTIVE',
      dutyStatus: 'OFF_DUTY',
      driverId: driverProfile.id,
      routeId: route.id,
      tenantId: tenantA.id,
    },
  });
  console.log(`Created Bus ${bus.busNumber} for Tenant A`);

  // 7. Create Parent for Tenant A
  const parentUser = await prisma.user.create({
    data: {
      email: 'parent@demoschool.com',
      passwordHash,
      name: 'Parent Mary Jenkins',
      role: Role.PARENT,
      phone: '7778889999',
      tenantId: tenantA.id,
    },
  });
  const parentProfile = await prisma.parentProfile.create({
    data: {
      userId: parentUser.id,
      emergencyContact: '777-888-0000',
    },
  });
  console.log(`Created Parent Profile for Tenant A`);

  // 8. Create Student for Tenant A and associate with Parent, Bus, and Stop
  const studentUser = await prisma.user.create({
    data: {
      email: 'student@demoschool.com',
      passwordHash,
      name: 'Bobby Jenkins',
      role: Role.STUDENT,
      tenantId: tenantA.id,
    },
  });
  const studentProfile = await prisma.studentProfile.create({
    data: {
      userId: studentUser.id,
      rollNo: 'STU-1001',
      fatherName: 'Mr. Jenkins',
      motherName: 'Mary Jenkins',
      parentProfileId: parentProfile.id,
      busId: bus.id,
      busStopId: stop.id,
      tenantId: tenantA.id,
    },
  });

  // Link Parent and Student in ParentStudent relation
  await prisma.parentStudent.create({
    data: {
      parentId: parentProfile.id,
      studentId: studentProfile.id,
      relationship: 'Mother',
      isPrimary: true,
    },
  });
  console.log(`Created Student and assigned to Parent & Bus for Tenant A`);

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
