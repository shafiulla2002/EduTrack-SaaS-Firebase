const { PrismaClient } = require('@prisma/client');
async function main() {
  const p = new PrismaClient();
  try {
    const tenantId = '778b7f12-d8c3-406d-926c-a403b46100ef'; // A.P. GreenWood High School
    
    // Check period timings
    const timings = await p.periodTiming.findMany({ 
      where: { tenantId },
      orderBy: { periodNumber: 'asc' }
    });
    console.log('\nPeriod Timings:', JSON.stringify(timings, null, 2));
    
    // Check class sections
    const sections = await p.classSection.findMany({
      where: { tenantId },
      include: { class: true, section: true }
    });
    console.log('\nClass Sections:', JSON.stringify(sections.map(cs => ({
      id: cs.id,
      name: `${cs.class?.name} - ${cs.section?.name}`
    })), null, 2));
    
    // Check subjects
    const subjects = await p.subject.findMany({ where: { tenantId } });
    console.log('\nSubjects:', JSON.stringify(subjects.map(s => ({ id: s.id, name: s.name })), null, 2));
    
  } finally {
    await p.$disconnect();
  }
}
main().catch(console.error);
