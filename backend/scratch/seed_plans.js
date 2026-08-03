const { PrismaClient, PlanType, SubscriptionStatus } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding subscription plans...');

  // 1. Create or Update Plans
  const plans = [
    {
      name: PlanType.TRIAL,
      studentLimit: null,
      teacherLimit: null,
      parentLimit: null,
      storageLimit: 5120.0, // 5GB in MB
      features: ['admissions', 'attendance', 'timetable', 'exams', 'billing'],
      price: 0.0,
    },
    {
      name: PlanType.BASIC,
      studentLimit: null,
      teacherLimit: null,
      parentLimit: null,
      storageLimit: 10240.0, // 10GB in MB
      features: [
        'admissions', 'attendance', 'timetable', 'exams', 'billing',
        'library', 'expenses', 'academics'
      ],
      price: 5000.0,
    },
    {
      name: PlanType.PREMIUM,
      studentLimit: null,
      teacherLimit: null,
      parentLimit: null,
      storageLimit: 51200.0, // 50GB in MB
      features: [
        'admissions', 'attendance', 'timetable', 'exams', 'billing',
        'library', 'expenses', 'academics',
        'transport', 'hostel', 'payroll', 'notifications_websockets',
        'parent_portal', 'teacher_portal'
      ],
      price: 15000.0,
    }
  ];

  for (const plan of plans) {
    const upserted = await prisma.subscriptionPlan.upsert({
      where: { name: plan.name },
      update: {
        studentLimit: plan.studentLimit,
        teacherLimit: plan.teacherLimit,
        parentLimit: plan.parentLimit,
        storageLimit: plan.storageLimit,
        features: plan.features,
        price: plan.price,
      },
      create: plan,
    });
    console.log(`Plan ${upserted.name} upserted.`);
  }

  // 2. Retrofit existing tenants with an active 6-month TRIAL subscription
  const tenants = await prisma.tenant.findMany({
    include: { subscription: true }
  });

  const trialPlan = await prisma.subscriptionPlan.findUnique({
    where: { name: PlanType.TRIAL }
  });

  const expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + 6); // 6 Months trial duration

  for (const tenant of tenants) {
    if (!tenant.subscription) {
      await prisma.tenantSubscription.create({
        data: {
          tenantId: tenant.id,
          planId: trialPlan.id,
          expiryDate: expiryDate,
          status: SubscriptionStatus.ACTIVE,
        }
      });
      console.log(`Provisioned default 6-month TRIAL subscription for tenant: ${tenant.name}`);

      // Log first history record
      await prisma.subscriptionHistory.create({
        data: {
          tenantId: tenant.id,
          previousPlan: null,
          newPlan: PlanType.TRIAL,
          amount: 0.0,
          paymentMethod: 'SYSTEM_AUTO',
          transactionReference: 'AUTO_ONBOARD',
          startDate: new Date(),
          expiryDate: expiryDate,
          status: SubscriptionStatus.ACTIVE,
        }
      });
    }
  }

  console.log('Subscription plans seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Error seeding subscription plans:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
