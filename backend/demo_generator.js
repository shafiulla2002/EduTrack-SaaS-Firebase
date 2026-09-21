const axios = require('axios');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { promisify } = require('util');
const sleep = promisify(setTimeout);
const BASE_URL = 'http://localhost:3001';
const STUDENT_ADMISSION_DELAY = parseInt(process.env.STUDENT_ADMISSION_DELAY) || 200;
const MAX_RETRIES = 3;

axios.interceptors.response.use(
  response => response,
  async error => {
    const { config } = error;
    if (!config) {
      return Promise.reject(error);
    }
    config.__retryCount = config.__retryCount || 0;
    if (config.__retryCount >= MAX_RETRIES) {
      return Promise.reject(error);
    }
    config.__retryCount += 1;
    const backoff = 200 * Math.pow(2, config.__retryCount - 1);
    console.warn(`[Axios Interceptor] Request to ${config.url} failed: ${error.message || error}. Retrying ${config.__retryCount}/${MAX_RETRIES} in ${backoff}ms...`);
    await sleep(backoff);
    return axios(config);
  }
);

async function retryAsync(fn, args = [], attempt = 1) {
  try {
    return await fn(...args);
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      const backoff = 200 * Math.pow(2, attempt - 1);
      console.warn(`Retry ${attempt} for ${fn.name} after ${backoff}ms:`, err.message || err);
      await sleep(backoff);
      return retryAsync(fn, args, attempt + 1);
    }
    console.error(`All ${MAX_RETRIES} attempts failed for ${fn.name}:`, err.message || err);
    throw err;
  }
}
async function main() {
  console.log("Starting E2E Onboarding & Data Generation...");

  const phone = '9988776655';
  const email = 'admin@oakridge.edu';
  const schoolName = 'Oakridge International School';

  // 1. Clean up old tenant/user records if they exist to allow re-runnability
  const oldTenant = await prisma.tenant.findFirst({
    where: { OR: [{ subDomain: 'oakridge-intl' }, { name: 'Oakridge International School' }] }
  });
  if (oldTenant) {
    await prisma.tenant.delete({ where: { id: oldTenant.id } }).catch(() => {});
    console.log("Deleted old Oakridge tenant and cascade records.");
  }
  const oldUser = await prisma.user.findFirst({
    where: { phone: phone }
  });
  if (oldUser) {
    await prisma.user.delete({ where: { id: oldUser.id } }).catch(() => {});
    console.log("Deleted old admin user with conflicting phone.");
  }

  // 2. Register School (Tenant)
  console.log("Registering School...");
  const registerRes = await axios.post(`${BASE_URL}/tenant/register`, {
    schoolName,
    schoolType: 'School',
    adminName: 'Dr. Arvind Krishna',
    mobileNumber: phone,
    email,
    address: '456 Oakridge Avenue, Jubilee Hills, Hyderabad',
    academicYear: '2026-2027'
  });

  const { access_token, user } = registerRes.data;
  const tenantId = user.tenantId;
  console.log(`Registered successfully! Tenant ID: ${tenantId}`);

  // 3. Set Admin Password to 'School@2026'
  const hashedAdminPassword = await bcrypt.hash('School@2026', 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashedAdminPassword }
  });
  console.log("Updated admin password to 'School@2026'.");

  const headers = {
    'Authorization': `Bearer ${access_token}`,
    'X-Tenant-ID': tenantId
  };

  // 4. Fetch the Academic Year ID created during onboarding
  const ay = await prisma.academicYear.findFirst({
    where: { tenantId, isActive: true }
  });
  const academicYearId = ay.id;
  console.log(`Using Academic Year ID: ${academicYearId}`);

  // 5. Create Sections
  console.log("Creating Sections...");
  const secARes = await axios.post(`${BASE_URL}/timetable/sections`, { name: 'Section A' }, { headers });
  const secBRes = await axios.post(`${BASE_URL}/timetable/sections`, { name: 'Section B' }, { headers });
  const sectionAId = secARes.data.id;
  const sectionBId = secBRes.data.id;

  // 6. Create Classes
  console.log("Creating Classes...");
  const classes = ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'];
  const classIds = [];
  for (const className of classes) {
    const classRes = await axios.post(`${BASE_URL}/timetable/classes`, {
      name: className,
      academicYearId
    }, { headers });
    classIds.push(classRes.data.id);
  }

  // 7. Create Subjects
  console.log("Creating Subjects...");
  const subjects = ['Telugu', 'Hindi', 'English', 'Mathematics', 'Science', 'Social'];
  const subjectIds = [];
  for (const subjectName of subjects) {
    const subRes = await axios.post(`${BASE_URL}/timetable/subjects`, { name: subjectName }, { headers });
    subjectIds.push(subRes.data.id);
  }

  // 8. Create Teachers (6 teachers)
  console.log("Creating Teachers...");
  const teacherNames = [
    { first: 'Ramesh', last: 'Kumar', email: 'ramesh.teacher@oakridge.edu' },
    { first: 'Sunita', last: 'Sharma', email: 'sunita.teacher@oakridge.edu' },
    { first: 'David', last: 'Miller', email: 'david.teacher@oakridge.edu' },
    { first: 'Anjali', last: 'Reddy', email: 'anjali.teacher@oakridge.edu' },
    { first: 'Vikram', last: 'Singh', email: 'vikram.teacher@oakridge.edu' },
    { first: 'Priya', last: 'Sen', email: 'priya.teacher@oakridge.edu' }
  ];

  const teacherIds = [];
  const teacherProfileIds = [];
  for (let i = 0; i < teacherNames.length; i++) {
    const t = teacherNames[i];
    const teacherRes = await axios.post(`${BASE_URL}/timetable/teachers`, {
      firstName: t.first,
      lastName: t.last,
      email: t.email,
      phone: `880000000${i + 1}`,
      qualification: 'M.Ed',
      designation: 'Senior Teacher',
      basicSalary: 45000,
      skills: [{ subjectId: subjectIds[i % subjectIds.length], skillLevel: 'Expert', yearsOfExperience: 5 }]
    }, { headers });
    
    const staffProfile = teacherRes.data;
    teacherProfileIds.push(staffProfile.id);
    teacherIds.push(staffProfile.userId);
  }

  // 9. Create Period Timings
  console.log("Creating Period Timings...");
  await axios.post(`${BASE_URL}/timetable/period-timings`, [
    { periodNumber: 1, startTime: '08:30', endTime: '09:15' },
    { periodNumber: 2, startTime: '09:15', endTime: '10:00' },
    { periodNumber: 3, startTime: '10:15', endTime: '11:00' },
    { periodNumber: 4, startTime: '11:00', endTime: '11:45' },
    { periodNumber: 5, startTime: '12:45', endTime: '13:30' },
    { periodNumber: 6, startTime: '13:30', endTime: '14:15' }
  ], { headers });

  // 10. Configure Class Sections using Setup Wizard Endpoint
  console.log("Creating Class Sections and Teacher/Subject workloads...");
  const classSectionIds = [];
  const csMap = []; // to hold class and section IDs for students
  
  for (let i = 0; i < classIds.length; i++) {
    const classId = classIds[i];
    for (const sectionId of [sectionAId, sectionBId]) {
      const subjectTeacherMap = {};
      const subjectPeriodsMap = {};
      
      for (let j = 0; j < subjectIds.length; j++) {
        const subId = subjectIds[j];
        const teacherIndex = (i + j) % teacherProfileIds.length;
        const teacherProfileId = teacherProfileIds[teacherIndex];
        
        subjectTeacherMap[subId] = [teacherProfileId];
        subjectPeriodsMap[subId] = [5];
      }
      
      // Create Class Section using the Setup Wizard endpoint with retry logic
        let csWizardRes;
        try {
          csWizardRes = await retryAsync(axios.post, [`${BASE_URL}/timetable/class-sections`, {
            academicYearId,
            classId,
            sectionId,
            classStrength: 30,
            subjectTeacherMap,
            subjectPeriodsMap
          }, { headers }]);
        } catch (err) {
          console.error('Failed to create class-section for classId', classId, 'sectionId', sectionId, ':', err.message || err);
          throw err; // abort script – the error will be caught by outer flow
        }
      
      const classSectionId = csWizardRes.data.id;
      classSectionIds.push(classSectionId);
      csMap.push({ classSectionId, classId, sectionId });
    }
  }

  // 11. Generate Timetable Periods for each Class Section
  console.log("Populating Timetables...");
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  for (const classSectionId of classSectionIds) {
    const periodsToSave = [];
    
    const assignments = await prisma.teacherAssignment.findMany({
      where: { classSectionId, tenantId }
    });
    
    for (const day of days) {
      for (let periodNum = 1; periodNum <= 5; periodNum++) {
        const assign = assignments[(periodNum - 1) % assignments.length];
        periodsToSave.push({
          day,
          periodNumber: periodNum,
          subjectId: assign.subjectId,
          teacherId: assign.teacherId
        });
      }
    }
    
    await axios.post(`${BASE_URL}/timetable/periods/save`, {
      classSectionId,
      academicYearId,
      periods: periodsToSave
    }, { headers });
  }

  // 12. Configure Fee Products and Pricebooks
  console.log("Creating Fee Products and Pricebooks...");
  const prodRes = await axios.post(`${BASE_URL}/billing/products`, {
    productNames: ['Tuition Fee', 'Transport Fee', 'Computer Lab Fee']
  }, { headers });
  
  const tuitionProduct = prodRes.data.find(p => p.name === 'Tuition Fee');
  const transportProduct = prodRes.data.find(p => p.name === 'Transport Fee');
  const labProduct = prodRes.data.find(p => p.name === 'Computer Lab Fee');

  const pricebookEntryIdsMap = {}; 
  
  for (const classId of classIds) {
    await axios.post(`${BASE_URL}/billing/pricebook`, {
      classId,
      academicYearId,
      priceItems: [
        { productId: tuitionProduct.id, price: 15000, selected: true },
        { productId: transportProduct.id, price: 4000, selected: true },
        { productId: labProduct.id, price: 1500, selected: true }
      ]
    }, { headers });
    
    const pb = await prisma.pricebook.findFirst({
      where: { classId, academicYearId, tenantId },
      include: { pricebookEntries: true }
    });
    
    pricebookEntryIdsMap[classId] = pb.pricebookEntries.map(e => e.id);
  }

  // 13. Admit 50 Students (10 per class, 5 in Section A, 5 in Section B)
  console.log("Admitting Students and creating Parents...");
  const studentNames = [
    { first: 'Aarav', last: 'Sharma' }, { first: 'Aditya', last: 'Verma' },
    { first: 'Vivaan', last: 'Gupta' }, { first: 'Vihaan', last: 'Mehta' },
    { first: 'Arjun', last: 'Roy' }, { first: 'Sai', last: 'Teja' },
    { first: 'Reyansh', last: 'Joshi' }, { first: 'Krishna', last: 'Prasad' },
    { first: 'Ishaan', last: 'Rao' }, { first: 'Atharv', last: 'Deshmukh' },
    { first: 'Ananya', last: 'Iyer' }, { first: 'Diya', last: 'Nair' },
    { first: 'Pihu', last: 'Patel' }, { first: 'Aadhya', last: 'Choudhury' },
    { first: 'Saanvi', last: 'Trivedi' }, { first: 'Shruti', last: 'Kulkarni' },
    { first: 'Sneha', last: 'Bose' }, { first: 'Riya', last: 'Das' },
    { first: 'Kavya', last: 'Pillai' }, { first: 'Tanvi', last: 'Joshi' },
    { first: 'Kabir', last: 'Bahl' }, { first: 'Ranbir', last: 'Kapoor' },
    { first: 'Ayaan', last: 'Malhotra' }, { first: 'Dhruv', last: 'Sarin' },
    { first: 'Ishaan', last: 'Kapoor' }, { first: 'Rohan', last: 'Khanna' },
    { first: 'Siddharth', last: 'Sinha' }, { first: 'Aditi', last: 'Rao' },
    { first: 'Meera', last: 'Joshi' }, { first: 'Neha', last: 'Gupta' },
    { first: 'Pranav', last: 'Kalyan' }, { first: 'Rahul', last: 'Dravid' },
    { first: 'Sachin', last: 'Tendulkar' }, { first: 'Virat', last: 'Kohli' },
    { first: 'Rohit', last: 'Sharma' }, { first: 'Jasprit', last: 'Bumrah' },
    { first: 'Hardik', last: 'Pandya' }, { first: 'Shikhar', last: 'Dhawan' },
    { first: 'KL', last: 'Rahul' }, { first: 'Rishabh', last: 'Pant' },
    { first: 'Shreya', last: 'Ghoshal' }, { first: 'Sunidhi', last: 'Chauhan' },
    { first: 'Alka', last: 'Yagnik' }, { first: 'Kavita', last: 'Krishnamurthy' },
    { first: 'Lata', last: 'Mangeshkar' }, { first: 'Asha', last: 'Bhosle' },
    { first: 'Geeta', last: 'Dutt' }, { first: 'Kishore', last: 'Kumar' },
    { first: 'Arijit', last: 'Singh' }, { first: 'Sonu', last: 'Nigam' }
  ];

  const studentProfileIds = [];
  const parentProfileIds = [];

  for (let cIdx = 0; cIdx < classIds.length; cIdx++) {
    const classId = classIds[cIdx];
    const pbeIds = pricebookEntryIdsMap[classId];

    for (let sIdx = 0; sIdx < 10; sIdx++) {
      try {
        const sectionId = sIdx < 5 ? sectionAId : sectionBId;
        const nameObj = studentNames[cIdx * 10 + sIdx];
        const studentEmail = `student.${cIdx * 10 + sIdx + 1}@oakridge.edu`;
        const phoneNum = `8000000${cIdx * 10 + sIdx + 10}`;

        const admissionPayload = {
          studentData: {
            firstName: nameObj.first,
            lastName: nameObj.last,
            email: studentEmail,
            phone: phoneNum,
            fatherName: `${nameObj.first}'s Father`,
            motherName: `${nameObj.first}'s Mother`,
            aadharNo: `1234567890${(cIdx * 10 + sIdx) % 100}`,
            rollNo: `${sIdx + 1}`,
            selectedClass: classId,
            selectedSection: sectionId,
            academicYear: academicYearId
          },
          selectedPricebookEntryIds: pbeIds,
          concessionAmount: sIdx === 0 ? 1500 : 0
        };

        const admissionRes = await retryAsync(axios.post, [`${BASE_URL}/billing/admissions`, admissionPayload, { headers }]);
        const studentProfileId = admissionRes.data.accountId;
        const opportunityId = admissionRes.data.opportunityId;
        studentProfileIds.push(studentProfileId);

        // Create Parent User and Parent Profile via Auth Register endpoint
        const parentEmail = `parent.${cIdx * 10 + sIdx + 1}@oakridge.edu`;
        const parentPhone = `7000000${cIdx * 10 + sIdx + 10}`;
        const parentPayload = {
          name: `${nameObj.first}'s Parent`,
          email: parentEmail,
          password: 'School@2026',
          role: 'PARENT',
          phone: parentPhone,
          emergencyContact: '111-222-3333'
        };
        const parentRes = await retryAsync(axios.post, [`${BASE_URL}/auth/register`, parentPayload, { headers }]);
        const parentUser = parentRes.data;
        const parentProfile = await prisma.parentProfile.findUnique({ where: { userId: parentUser.id } });
        parentProfileIds.push(parentProfile.id);

        // Link parent and student in database
        await prisma.studentProfile.update({
          where: { id: studentProfileId },
          data: { parentProfileId: parentProfile.id }
        });

        // Create Invoices and payments
        const unpaidFeesRes = await retryAsync(axios.get, [`${BASE_URL}/billing/unpaid-fees/${opportunityId}`, { headers }]);
        const unpaidItems = unpaidFeesRes.data;

        if (sIdx < 3) {
          // FULLY PAID
          const itemsToPay = unpaidItems.map(item => ({
            oliId: item.oliId,
            productId: '',
            amount: item.balanceDue
          }));
          for (const it of itemsToPay) {
            const oliRecord = await prisma.opportunityLineItem.findUnique({ where: { id: it.oliId } });
            it.productId = oliRecord.productId;
          }
          await retryAsync(axios.post, [`${BASE_URL}/billing/invoices`, {
            opportunityId,
            studentId: studentProfileId,
            items: itemsToPay,
            paymentMethod: 'CASH'
          }, { headers }]);
        } else if (sIdx < 7) {
          // PARTIALLY PAID (Tuition only)
          const tuitionOli = unpaidItems.find(x => x.productName === 'Tuition Fee');
          if (tuitionOli) {
            await retryAsync(axios.post, [`${BASE_URL}/billing/invoices`, {
              opportunityId,
              studentId: studentProfileId,
              items: [{ oliId: tuitionOli.oliId, productId: tuitionProduct.id, amount: tuitionOli.balanceDue }],
              paymentMethod: 'CASH'
            }, { headers }]);
          }
        }

        // Small delay before next student
        await sleep(STUDENT_ADMISSION_DELAY);
      } catch (err) {
        console.error('Student admission failed for class', classId, 'student index', sIdx, ':', err.message || err);
        // Continue with next student
      }
    }
  }

  // 15. Attendance history (last 5 days)
  console.log("Generating Attendance records for the past 5 school days...");
  const attendanceDays = [];
  for (let i = 5; i >= 1; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    if (d.getDay() === 0) d.setDate(d.getDate() - 1);
    attendanceDays.push(d.toISOString().split('T')[0]);
  }

  for (const classSectionId of classSectionIds) {
    const csRecord = await prisma.classSection.findUnique({
      where: { id: classSectionId },
      include: { class: true, section: true }
    });
    
    const studentsInCs = await prisma.studentProfile.findMany({
      where: { classSectionId, tenantId }
    });
    
    const assign = await prisma.teacherAssignment.findFirst({
      where: { classSectionId, tenantId }
    });
    
    for (const dateStr of attendanceDays) {
      const absentIds = [];
      const presentIds = [];
      
      studentsInCs.forEach((s, idx) => {
        if (idx === 0) {
          absentIds.push(s.id);
        } else {
          presentIds.push(s.id);
        }
      });
      
      await axios.post(`${BASE_URL}/attendance/save`, {
        date: dateStr,
        dateStr,
        classVal: csRecord.class.name,
        sectionVal: csRecord.section.name,
        absentStudentIds: absentIds,
        totalStudents: studentsInCs.length,
        presentCount: presentIds.length,
        absentCount: absentIds.length,
        teacherId: assign ? assign.teacherId : null,
        allowPastDates: true 
      }, { headers });
    }
  }

  // 16. Create Exams and Enter Marks
  console.log("Generating Examinations and Marks...");
  await axios.post(`${BASE_URL}/exams/exam-types`, { name: 'Midterm' }, { headers });
  
  for (const classSectionId of classSectionIds) {
    const examRes = await axios.post(`${BASE_URL}/exams`, {
      name: 'Term 1 Mid-Term',
      type: 'Midterm',
      classSectionId,
      date: new Date()
    }, { headers });
    
    const assigns = await prisma.teacherAssignment.findMany({
      where: { classSectionId, tenantId }
    });
    const studentsInCs = await prisma.studentProfile.findMany({
      where: { classSectionId, tenantId }
    });
    
    for (const assign of assigns) {
      const marksToSave = studentsInCs.map((s, idx) => {
        const score = 65 + (idx * 4) % 30; 
        return {
          studentId: s.id,
          marksObtained: score,
          remarks: score > 90 ? 'Excellent' : score > 75 ? 'Good' : 'Satisfactory'
        };
      });
      
      await axios.post(`${BASE_URL}/exams/save-marks`, {
        marks: marksToSave,
        examName: 'Term 1 Mid-Term',
        classSectionId,
        subjectId: assign.subjectId
      }, { headers });
    }
  }

  // 17. Update all users' password hash to a known value ('School@2026')

  // 18. Generate additional sample data (library, complaints, notifications)
  console.log('Generating additional sample data...');
  // Library: create 5 books and assign random students
  const sampleBooks = ['Mathematics Basics', 'Science Experiments', 'History of India', 'English Grammar', 'Art & Craft'];
  for (const title of sampleBooks) {
    const bookRes = await retryAsync(axios.post, [`${BASE_URL}/library/books`, { title, author: 'Demo Author' }, { headers }]);
    // Issue to a random student
    const randomStudentId = studentProfileIds[Math.floor(Math.random() * studentProfileIds.length)];
    await retryAsync(axios.post, [`${BASE_URL}/library/issue`, { bookId: bookRes.data.id, studentId: randomStudentId, dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }, { headers }]);
  }
  // Complaints: create 3 mock complaints linked to random students
  const complaintTexts = ['Lost textbook', 'Late fee dispute', 'Classroom temperature too high'];
  for (const text of complaintTexts) {
    const randomStudentId = studentProfileIds[Math.floor(Math.random() * studentProfileIds.length)];
    await retryAsync(axios.post, [`${BASE_URL}/complaints`, { studentId: randomStudentId, description: text }, { headers }]);
  }
  // Notifications: send a welcome notification to all parents
  for (const parentId of parentProfileIds) {
    await retryAsync(axios.post, [`${BASE_URL}/notifications`, { recipientProfileId: parentId, title: 'Welcome', message: 'Welcome to Oakridge International School portal!' }, { headers }]);
  }

  console.log('Additional sample data generation completed.');
  console.log("Updating all users' passwords to 'School@2026' for easy testing...");
  const commonPasswordHash = await bcrypt.hash('School@2026', 10);
  
  await prisma.user.updateMany({
    where: { tenantId },
    data: { passwordHash: commonPasswordHash }
  });

  console.log("-----------------------------------------");
  console.log("ONBOARDING & DEMO DATA GENERATION COMPLETED!");
  console.log("Tenant ID:", tenantId);
  console.log("Admin Email:", email);
  console.log("Admin Phone:", phone);
  console.log("Password:", "School@2026");
  console.log("-----------------------------------------");
}

main()
  .catch(err => {
    if (err.response) {
      console.error("Critical error in data generator script:", JSON.stringify(err.response.data, null, 2));
    } else {
      console.error("Critical error in data generator script:", err.stack || err.message || err);
    }
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
