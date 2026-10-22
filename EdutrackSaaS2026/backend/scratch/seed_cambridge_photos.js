const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const UNSPLASH_IDS = [
  'photo-1502082553048-f009c37129b9', // girl in field
  'photo-1503919545889-aef636e10ad4', // boy
  'photo-1518806118471-f28b20a1d79d', // boy
  'photo-1542206395-9feb3edaa68d', // girl
  'photo-1488426862026-3ee34a7d66df', // girl
  'photo-1531746020798-e6953c6e8e04', // girl
  'photo-1519345182560-3f2917c472ef', // boy
  'photo-1522529590124-75d693f69735', // boy
  'photo-1548142813-c348350df52b', // girl
  'photo-1531123897727-8f129e1688ce', // girl
  'photo-1552058544-f2b08422138a', // boy
  'photo-1566492031773-4f4e44671857', // boy
  'photo-1580489944761-15a19d654956', // girl
  'photo-1597223557154-721c1cecc4b0', // girl
  'photo-1607990283143-e81e7a2c93ab', // boy
  'photo-1601412436009-d964bd02edbc', // boy
  'photo-1614644147724-2d4785d69962', // boy
  'photo-1595211877493-41a4e5f236b3', // boy
  'photo-1601288496920-b6154fe3626a', // girl
  'photo-1596495578065-6e0763fa1141', // boy
  'photo-1609132718484-cc90df3417f8', // girl
  'photo-1613145400516-09e192f15a1d', // boy
  'photo-1618673747378-7e0d3561371a', // boy
  'photo-1628157582853-a796fa650a6a', // girl
  'photo-1545696911-c436a3ad7c9f', // young child
  'photo-1519457431-44ccd64a579b', // girl
  'photo-1519238263530-99bdd11df2ea', // boy
  'photo-1593134257782-e895776997f5', // Indian school kid
  'photo-1516624683217-fb3223f85252', // child
  'photo-1490650034439-fd184c3c86a5', // boy
  'photo-1507679799987-c73779587ccf', // school boy
  'photo-1567186937675-a5131c8a89ea', // boy
  'photo-1603005901058-22cf1f1ab449', // child
  'photo-1606708051786-db8b3ee581b7', // boy in class
  'photo-1602052673891-b3b447833a66', // student girl
  'photo-1606813907291-d86efa9b94db'  // girl
];

function getPhotoUrl(index) {
  const id = UNSPLASH_IDS[index % UNSPLASH_IDS.length];
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&q=80&w=256&h=256`;
}

async function run() {
  try {
    const tenantId = 'ebc2dcb0-8985-43a7-bc83-c62b22f301d1';
    console.log("Seeding dummy student photos for tenant: Cambridge International School");

    // Fetch all student profiles in Cambridge International School
    const students = await prisma.studentProfile.findMany({
      where: { tenantId },
      select: { id: true, user: { select: { name: true } } }
    });

    console.log(`Found ${students.length} students. Updating profile photos...`);

    let updatedCount = 0;
    // Process updates in chunks of 50 to avoid overloading the DB connections
    const chunkSize = 5;
    for (let i = 0; i < students.length; i += chunkSize) {
      const chunk = students.slice(i, i + chunkSize);
      
      await Promise.all(chunk.map((student, idx) => {
        // Deterministic hash based on student ID to assign a photo
        const totalIdx = i + idx;
        const photoUrl = getPhotoUrl(totalIdx);
        return prisma.studentProfile.update({
          where: { id: student.id },
          data: { profilePhotoUrl: photoUrl }
        });
      }));

      updatedCount += chunk.length;
      if (updatedCount % 100 === 0 || updatedCount === students.length) {
        console.log(`Updated ${updatedCount}/${students.length} students...`);
      }
      await new Promise(resolve => setTimeout(resolve, 5));
    }

    console.log("Successfully seeded dummy student photos!");

  } catch (err) {
    console.error('Error during seeding:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
