import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const students = await prisma.studentProfile.findMany({
    include: {
      user: true,
      classSection: {
        include: {
          class: true,
          section: true
        }
      }
    }
  });

  console.log(`Total Student Profiles in DB: ${students.length}`);
  
  // Group by Class and Section names
  const groups: Record<string, number> = {};
  students.forEach(s => {
    const className = s.classSection?.class.name || 'N/A';
    const sectionName = s.classSection?.section.name || 'N/A';
    const key = `${className} - ${sectionName}`;
    groups[key] = (groups[key] || 0) + 1;
  });

  console.log('Student counts per Class-Section:');
  console.log(JSON.stringify(groups, null, 2));

  // Find all Class-1 - Section A students
  const class1SecA = students.filter(s => {
    const className = s.classSection?.class.name || '';
    const sectionName = s.classSection?.section.name || '';
    return (className.replace(/\s+/g, '').toLowerCase().includes('class-1') || className.toLowerCase().includes('grade1')) && 
           sectionName.replace(/\s+/g, '').toLowerCase().includes('sectiona');
  });

  console.log(`Matched Class-1 Section A students: ${class1SecA.length}`);
  if (class1SecA.length > 0) {
    console.log('First 20 students:');
    class1SecA.slice(0, 20).forEach(s => {
      console.log(`ID: ${s.id}, Name: ${s.user?.name}, RollNo: ${s.rollNo}`);
    });
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
