const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = '7efea98d-04f0-4a02-95f0-e6d358fd17ae';

// Subject-specific complaint templates
const COMPLAINT_TEMPLATES = [
  {
    subject: 'Mathematics',
    category: 'Academics - Mathematics',
    title: 'Incomplete Algebra & Geometry Assignment',
    desc: 'Student failed to submit weekly Algebra homework for the second consecutive time despite teacher reminders during Math period.',
    priority: 'High',
  },
  {
    subject: 'Science',
    category: 'Lab Discipline - Science',
    title: 'Science Lab Equipment Misuse',
    desc: 'Student mishandled glassware during the Physics lab session and caused minor disruption during the experiment.',
    priority: 'High',
  },
  {
    subject: 'English',
    category: 'Classroom Behavior - English',
    title: 'Distracting Classmate During Literature Recitation',
    desc: 'Student was repeatedly talking and drawing during the English literature lecture despite verbal warnings.',
    priority: 'Medium',
  },
  {
    subject: 'Social',
    category: 'Academics - Social Studies',
    title: 'Incomplete World History Map Project',
    desc: 'Failed to submit the mandatory Geography map coloring assignment on the due date.',
    priority: 'Medium',
  },
  {
    subject: 'PET',
    category: 'Sports & Playground Discipline',
    title: 'Unsportsmanlike Conduct on Playground',
    desc: 'Got into a loud verbal argument with another classmate during the physical training sports period.',
    priority: 'Medium',
  },
  {
    subject: 'Telugu',
    category: 'Academics - Vernacular Language',
    title: 'Incomplete Telugu Grammar Exercises',
    desc: 'Did not complete the assigned Telugu prose copy-writing exercises.',
    priority: 'Low',
  },
  {
    subject: 'Hindi',
    category: 'Academics - Vernacular Language',
    title: 'Late Submission of Hindi Essay',
    desc: 'Submitted the weekly Hindi composition essay two days past the official deadline.',
    priority: 'Low',
  },
  {
    subject: 'GK',
    category: 'General Knowledge & Lab',
    title: 'Lack of Focus during Computer & GK Lab Session',
    desc: 'Caught browsing unassigned applications on the computer lab terminal during the GK period.',
    priority: 'Medium',
  },
];

const STATUSES = ['New', 'In Progress', 'Resolved'];
const COMPLAINT_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED'];

async function run() {
  console.log('--- STARTING TEACHER-LINKED COMPLAINTS AND PRICEBOOK SEEDING FOR SHAFIULLA HIGH SCHOOL ---');

  // 1. Fetch Tenant & Academic Year
  const tenant = await prisma.tenant.findUnique({ where: { id: TENANT_ID } });
  if (!tenant) {
    console.error('Tenant Shafiulla High School not found.');
    return;
  }

  const activeAcademicYear = await prisma.academicYear.findFirst({
    where: { tenantId: TENANT_ID, isActive: true },
  });
  if (!activeAcademicYear) {
    console.error('Active Academic Year not found.');
    return;
  }
  const academicYearId = activeAcademicYear.id;

  // 2. Fetch all real Staff Profiles (Teachers)
  const staffProfiles = await prisma.staffProfile.findMany({
    where: { tenantId: TENANT_ID, user: { isActive: true } },
    include: { user: true },
  });
  if (staffProfiles.length === 0) {
    console.error('No staff profiles found for tenant.');
    return;
  }

  // Group teachers by subject taught
  const subjectTeachersMap = {};
  for (const s of staffProfiles) {
    for (const subjName of s.subjectsTaught) {
      const normalizedSubj = subjName === 'Social Studies' ? 'Social' : subjName;
      if (!subjectTeachersMap[normalizedSubj]) {
        subjectTeachersMap[normalizedSubj] = [];
      }
      subjectTeachersMap[normalizedSubj].push(s);
    }
  }

  console.log('Subject-to-Teachers Mapping:');
  Object.keys(subjectTeachersMap).forEach(subj => {
    console.log(`- ${subj}: ${subjectTeachersMap[subj].map(t => t.user.name).join(', ')}`);
  });

  // 3. Fetch Subjects
  const subjects = await prisma.subject.findMany({
    where: { tenantId: TENANT_ID }
  });
  const subjectObjMap = {};
  subjects.forEach(s => {
    const key = s.name === 'Social Studies' ? 'Social' : s.name;
    subjectObjMap[key] = s;
  });

  // 4. Fetch ClassSections & Students
  const classSections = await prisma.classSection.findMany({
    where: { tenantId: TENANT_ID },
    include: {
      class: true,
      section: true,
      students: {
        where: { user: { isActive: true } },
        include: { user: { select: { name: true } } },
      },
    },
  });

  console.log(`Found ${classSections.length} Class Sections and ${staffProfiles.length} Staff Profiles.`);

  // 5. Populate / Ensure TeacherAssignments for all ClassSections & Subjects
  console.log('Verifying and seeding TeacherAssignment table for all Class Sections...');
  const teacherAssignmentMap = {}; // key: `${classSectionId}_${subjectName}` -> StaffProfile

  for (let csIdx = 0; csIdx < classSections.length; csIdx++) {
    const cs = classSections[csIdx];
    const isSectionB = cs.section.name.toUpperCase().includes('B');

    for (const template of COMPLAINT_TEMPLATES) {
      const subjName = template.subject;
      const subjObj = subjectObjMap[subjName];
      const teachersForSubj = subjectTeachersMap[subjName] || [];

      if (teachersForSubj.length > 0 && subjObj) {
        // Pick primary teacher: index 1 if Section B (if available), else index 0
        const selectedTeacher = (isSectionB && teachersForSubj.length > 1) 
          ? teachersForSubj[1] 
          : teachersForSubj[0];

        // Ensure TeacherAssignment record exists in database
        let assignment = await prisma.teacherAssignment.findFirst({
          where: {
            tenantId: TENANT_ID,
            classSectionId: cs.id,
            subjectId: subjObj.id,
          }
        });

        if (!assignment) {
          assignment = await prisma.teacherAssignment.create({
            data: {
              teacherId: selectedTeacher.id,
              classSectionId: cs.id,
              subjectId: subjObj.id,
              periodsPerWeek: 5,
              tenantId: TENANT_ID,
            }
          });
        }

        teacherAssignmentMap[`${cs.id}_${subjName}`] = selectedTeacher;
      }
    }
  }
  console.log('Teacher assignments created/verified across all class sections.');

  // Clean up existing complaints and behavior cases for clean execution
  await prisma.behaviorCase.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.complaint.deleteMany({ where: { tenantId: TENANT_ID } });
  console.log('Cleared old complaints and behavior cases.');

  // ==========================================
  // A. SEED TEACHER-LINKED BEHAVIOR CASES & COMPLAINTS
  // ==========================================
  const behaviorCasesToInsert = [];
  const complaintsToInsert = [];

  // Generate subject complaints distributed across June 2026 to March 2027
  const startDate = new Date('2026-06-15');
  const monthCount = 10; // June 2026 to March 2027

  let totalCasesCreated = 0;

  for (let csIdx = 0; csIdx < classSections.length; csIdx++) {
    const cs = classSections[csIdx];
    const students = cs.students;
    if (students.length === 0) continue;

    // Select ~25 students per class section
    const targetStudents = students.slice(0, Math.min(25, students.length));

    for (let m = 0; m < monthCount; m++) {
      const caseDate = new Date(startDate);
      caseDate.setMonth(caseDate.getMonth() + m);
      caseDate.setDate(10 + (csIdx % 15)); // distributed dates

      for (let sIdx = 0; sIdx < targetStudents.length; sIdx++) {
        const student = targetStudents[sIdx];
        const template = COMPLAINT_TEMPLATES[(csIdx + m + sIdx) % COMPLAINT_TEMPLATES.length];
        
        // Resolve real teacher assigned to student's classSection & subject
        const assignedTeacher = teacherAssignmentMap[`${cs.id}_${template.subject}`] || staffProfiles[0];

        const status = STATUSES[(m + sIdx) % STATUSES.length];
        const complaintStatus = COMPLAINT_STATUSES[(m + sIdx) % COMPLAINT_STATUSES.length];

        // 1. BehaviorCase Record (Teacher-Linked)
        behaviorCasesToInsert.push({
          tenantId: TENANT_ID,
          studentId: student.id,
          teacherId: assignedTeacher.id, // StaffProfile.id of reporting teacher
          behaviorType: 'Complaint',
          category: template.category,
          academicYear: '2026-2027',
          status,
          priority: template.priority,
          description: `[Subject: ${template.subject}] ${template.desc} Submitted by Teacher: ${assignedTeacher.user.name}.`,
          createdAt: caseDate,
          updatedAt: caseDate,
        });

        // 2. Administrative Complaint Record (Teacher-Submitted)
        complaintsToInsert.push({
          title: `${template.title} - ${student.user.name}`,
          description: `[Subject: ${template.subject}] ${template.desc} (Submitted by ${assignedTeacher.user.name})`,
          status: complaintStatus,
          category: template.category,
          submittedById: assignedTeacher.userId, // User.id of reporting teacher
          academicYearId,
          classSectionId: cs.id,
          tenantId: TENANT_ID,
          createdAt: caseDate,
          updatedAt: caseDate,
        });

        totalCasesCreated++;
      }
    }
  }

  console.log(`Prepared ${behaviorCasesToInsert.length} Behavior Cases and ${complaintsToInsert.length} Complaints.`);

  // Chunked batch insert BehaviorCases
  const CHUNK_SIZE = 1000;
  for (let i = 0; i < behaviorCasesToInsert.length; i += CHUNK_SIZE) {
    const chunk = behaviorCasesToInsert.slice(i, i + CHUNK_SIZE);
    await prisma.behaviorCase.createMany({
      data: chunk,
    });
  }
  console.log(`Inserted ${behaviorCasesToInsert.length} BehaviorCase records.`);

  // Chunked batch insert Complaints
  for (let i = 0; i < complaintsToInsert.length; i += CHUNK_SIZE) {
    const chunk = complaintsToInsert.slice(i, i + CHUNK_SIZE);
    await prisma.complaint.createMany({
      data: chunk,
    });
  }
  console.log(`Inserted ${complaintsToInsert.length} Complaint administrative tickets.`);

  // ==========================================
  // B. SEED FEE PRODUCTS & PRICEBOOK ENTRIES
  // ==========================================
  console.log('Verifying Fee Products and Pricebook structures...');

  const feeProducts = [
    { name: 'Annual Tuition Fee', code: 'FEE-TUITION', price: 25000 },
    { name: 'Science & Computer Lab Fee', code: 'FEE-LAB', price: 4500 },
    { name: 'Sports & PET Activity Fee', code: 'FEE-SPORTS', price: 2500 },
    { name: 'Library & E-Learning Fee', code: 'FEE-LIBRARY', price: 1500 },
    { name: 'Examination & Assessment Fee', code: 'FEE-EXAM', price: 3000 },
  ];

  const createdProducts = [];
  for (const fp of feeProducts) {
    let product = await prisma.product.findFirst({
      where: { tenantId: TENANT_ID, name: fp.name },
    });
    if (!product) {
      product = await prisma.product.create({
        data: {
          name: fp.name,
          productCode: fp.code,
          description: `${fp.name} for academic year 2026-2027`,
          tenantId: TENANT_ID,
        },
      });
    }
    createdProducts.push({ product, defaultPrice: fp.price });
  }

  // Create Pricebook per Class
  const classes = await prisma.class.findMany({ where: { tenantId: TENANT_ID } });
  let totalEntriesCreated = 0;

  for (const cls of classes) {
    let pricebook = await prisma.pricebook.findFirst({
      where: { tenantId: TENANT_ID, classId: cls.id, academicYearId },
    });

    if (!pricebook) {
      pricebook = await prisma.pricebook.create({
        data: {
          name: `Pricebook - ${cls.name} (2026-2027)`,
          classId: cls.id,
          academicYearId,
          tenantId: TENANT_ID,
        },
      });
    }

    for (const item of createdProducts) {
      const entryExists = await prisma.pricebookEntry.findFirst({
        where: { tenantId: TENANT_ID, pricebookId: pricebook.id, productId: item.product.id },
      });

      if (!entryExists) {
        await prisma.pricebookEntry.create({
          data: {
            pricebookId: pricebook.id,
            productId: item.product.id,
            unitPrice: item.defaultPrice,
            tenantId: TENANT_ID,
          },
        });
        totalEntriesCreated++;
      }
    }
  }

  console.log(`Verified Pricebooks for ${classes.length} Classes. Created ${totalEntriesCreated} Pricebook Entries.`);

  console.log('==================================================');
  console.log('SUCCESSFULLY SEEDED TEACHER-LINKED COMPLAINTS & PRICEBOOKS!');
  console.log(`Total Behavior Cases: ${behaviorCasesToInsert.length}`);
  console.log(`Total Admin Complaints: ${complaintsToInsert.length}`);
  console.log(`Total Pricebook Fee Entries: ${totalEntriesCreated}`);
  console.log('==================================================');
}

run()
  .catch(e => console.error('Error in complaint & pricebook seeder:', e))
  .finally(() => prisma.$disconnect());
