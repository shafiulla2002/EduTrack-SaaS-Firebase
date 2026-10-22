const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({
    include: {
      classes: {
        include: {
          classSections: true
        }
      },
      users: {
        where: {
          role: 'TEACHER'
        },
        include: {
          staffProfile: true
        }
      }
    }
  });
  console.log("Tenants Data Summary:");
  for (const t of tenants) {
    console.log(`Tenant: ${t.name} (Subdomain: ${t.subDomain}, ID: ${t.id})`);
    console.log(`  Classes Count: ${t.classes.length}`);
    for (const c of t.classes) {
      console.log(`    Class: ${c.name} (ID: ${c.id})`);
      console.log(`      Sections: ${c.classSections.map(cs => cs.id).join(', ')}`);
    }
    console.log(`  Teachers Count: ${t.users.length}`);
    for (const u of t.users) {
      console.log(`    Teacher: ${u.name} (Email: ${u.email}, Profile ID: ${u.staffProfile?.id})`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
