const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Starting Extra Data Seeding for Oakridge International School...");

  // 1. Fetch Tenant
  const tenant = await prisma.tenant.findFirst({
    where: { subDomain: 'oakridge-intl' }
  });
  if (!tenant) {
    console.error("Oakridge International School tenant not found!");
    return;
  }
  const tenantId = tenant.id;
  console.log(`Using Tenant ID: ${tenantId}`);

  // 2. Fetch Active Academic Year
  const academicYear = await prisma.academicYear.findFirst({
    where: { tenantId, isActive: true }
  });
  if (!academicYear) {
    console.error("Active Academic Year not found!");
    return;
  }
  const academicYearId = academicYear.id;

  // 3. Fetch Teachers, Students, and Class Sections
  const teachers = await prisma.staffProfile.findMany({
    where: { tenantId },
    include: { user: true }
  });
  const students = await prisma.studentProfile.findMany({
    where: { tenantId },
    include: { user: true }
  });
  const classSections = await prisma.classSection.findMany({
    where: { tenantId }
  });

  if (teachers.length === 0 || students.length === 0) {
    console.error("Need seeded teachers and students before seeding extra data!");
    return;
  }

  console.log(`Found ${teachers.length} teachers, ${students.length} students, and ${classSections.length} class sections.`);

  // Clean up existing data to be re-runnable
  await prisma.activityLog.deleteMany({ where: { tenantId } }).catch(() => {});
  await prisma.bookIssue.deleteMany({ where: { tenantId } }).catch(() => {});
  await prisma.bookCopy.deleteMany({ where: { tenantId } }).catch(() => {});
  await prisma.book.deleteMany({ where: { tenantId } }).catch(() => {});
  await prisma.complaint.deleteMany({ where: { tenantId } }).catch(() => {});
  await prisma.expense.deleteMany({ where: { tenantId } }).catch(() => {});
  console.log("Cleaned up existing library, complaint, expense, and activity log records.");

  // ==========================================
  // A. Seed Expenses
  // ==========================================
  console.log("Seeding Expenses...");
  const expenseCategories = ["Maintenance", "Salary", "Stationery", "Utilities", "Laboratory", "Events"];
  const paymentModes = ["CASH", "UPI", "BANK_TRANSFER"];
  const expenseStatuses = ["PAID", "APPROVED", "PENDING", "REJECTED"];
  
  const expenseTemplates = [
    { title: "Monthly Broadband Bill", amount: 2499.00, category: "Utilities" },
    { title: "Science Lab Test Tubes & Beakers", amount: 8500.00, category: "Laboratory" },
    { title: "A4 Printing Paper Bundles (50 Nos)", amount: 12500.00, category: "Stationery" },
    { title: "Classroom 3 AC Repair", amount: 4500.00, category: "Maintenance" },
    { title: "Office Water Cans & Dispensers", amount: 1800.00, category: "Utilities" },
    { title: "Annual Sports Day Ground Rent", amount: 35000.00, category: "Events" },
    { title: "Teacher Staff Tea & Snacks", amount: 3500.00, category: "Utilities" },
    { title: "UPS Battery Replacement", amount: 18500.00, category: "Maintenance" },
    { title: "Mathematics Geometry Box Kits", amount: 6200.00, category: "Stationery" },
    { title: "Library Book Shelves Painting", amount: 7500.00, category: "Maintenance" }
  ];

  for (let i = 0; i < 15; i++) {
    const template = expenseTemplates[i % expenseTemplates.length];
    const category = template.category;
    const amount = template.amount + (Math.random() * 200 - 100); // add slight randomness
    const daysAgo = Math.floor(Math.random() * 60); // over last 2 months
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);

    await prisma.expense.create({
      data: {
        amount,
        category,
        date,
        description: `${template.title} for school operations.`,
        paymentMode: paymentModes[i % paymentModes.length],
        status: expenseStatuses[i % expenseStatuses.length],
        tenantId
      }
    });
  }
  console.log("Seeded 15 expense records.");

  // ==========================================
  // B. Seed Complaints (Behavior Cases)
  // ==========================================
  console.log("Seeding Behavior Cases / Complaints...");
  const complaintCategories = ["Misbehavior", "Bullying", "Disruption", "Incomplete Homework", "Late Arrival"];
  const complaintStatuses = ["OPEN", "IN_PROGRESS", "RESOLVED"];
  const complaintPriorities = ["High", "Medium", "Low"];

  const complaintTemplates = [
    { title: "Disruptive Classroom Behavior", desc: "Student was repeatedly talking and drawing in class despite warnings from teacher." },
    { title: "Incomplete Homework Submission", desc: "Failed to submit weekly algebra assignment for the third consecutive week." },
    { title: "Late Arrival to Assembly", desc: "Arrived late to the morning general assembly by 20 minutes without an excuse note." },
    { title: "Argument on Playground", desc: "Got into a loud verbal altercation with another student during the recess break." },
    { title: "Cell Phone Usage in Class", desc: "Caught browsing social media on a personal device during the English literature lecture." }
  ];

  for (let i = 0; i < 8; i++) {
    const template = complaintTemplates[i % complaintTemplates.length];
    const student = students[i % students.length];
    const teacher = teachers[i % teachers.length];
    const classSec = classSections.find(cs => cs.id === student.classSectionId) || classSections[0];

    await prisma.complaint.create({
      data: {
        title: template.title,
        description: template.desc,
        category: complaintCategories[i % complaintCategories.length],
        status: complaintStatuses[i % complaintStatuses.length],
        submittedById: teacher.userId,
        academicYearId,
        classSectionId: classSec.id,
        tenantId
      }
    });
  }
  console.log("Seeded 8 behavior/complaint cases.");

  // ==========================================
  // C. Seed Library Books, Copies, and Issues
  // ==========================================
  console.log("Seeding Library Books...");
  const bookTemplates = [
    { title: "Introduction to Geometry", author: "Euclid", category: "Mathematics", isbn: "9781234567890" },
    { title: "The Elements of Style", author: "William Strunk Jr.", category: "English Literature", isbn: "9782234567890" },
    { title: "A Brief History of Time", author: "Stephen Hawking", category: "Science & Physics", isbn: "9783234567890" },
    { title: "World History: Volume 1", author: "Arnold Toynbee", category: "History", isbn: "9784234567890" },
    { title: "Organic Chemistry Basics", author: "Jerry March", category: "Science", isbn: "9785234567890" },
    { title: "Introductory Economics", author: "Paul Samuelson", category: "Social Science", isbn: "9786234567890" },
    { title: "To Kill a Mockingbird", author: "Harper Lee", category: "Fiction", isbn: "9787234567890" },
    { title: "Computer Science: An Overview", author: "Glenn Brookshear", category: "Technology", isbn: "9788234567890" },
    { title: "Basic Biology Concepts", author: "Neil Campbell", category: "Science", isbn: "9789234567890" },
    { title: "Civics and Governance Foundations", author: "John Locke", category: "Social Studies", isbn: "9780234567890" }
  ];

  const copiesToCreate = [];
  const createdBooks = [];

  for (const t of bookTemplates) {
    const book = await prisma.book.create({
      data: {
        title: t.title,
        author: t.author,
        isbn: t.isbn,
        category: t.category,
        totalCopies: 4,
        availableCopies: 4,
        tenantId
      }
    });
    createdBooks.push(book);

    // Create 4 copies for each book
    for (let cNum = 1; cNum <= 4; cNum++) {
      const barcode = `BAR-${t.category.toUpperCase().slice(0, 4)}-${book.id.slice(0, 4)}-0${cNum}`;
      const copy = await prisma.bookCopy.create({
        data: {
          bookId: book.id,
          barcode,
          status: "AVAILABLE",
          tenantId
        }
      });
      copiesToCreate.push(copy);
    }
  }
  console.log(`Seeded ${createdBooks.length} books and ${copiesToCreate.length} book copies.`);

  // Create Book Issues (Borrow logs)
  console.log("Seeding Book Issues (Borrow Logs)...");
  // Let's borrow 12 books
  for (let i = 0; i < 12; i++) {
    const copy = copiesToCreate[i];
    const student = students[i % students.length];
    const isReturned = i % 3 === 0; // 1/3 returned, 2/3 active issues
    const isOverdue = i % 3 === 1;   // 1/3 active and overdue, 1/3 active and regular

    const issueDate = new Date();
    issueDate.setDate(issueDate.getDate() - (isOverdue ? 15 : 4)); // borrowed 15 days ago or 4 days ago
    
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + 7); // due in 7 days

    let returnDate = null;
    let status = "ISSUED";

    if (isReturned) {
      returnDate = new Date(dueDate);
      returnDate.setDate(returnDate.getDate() - 2); // returned before due date
      status = "AVAILABLE";
    }

    await prisma.bookIssue.create({
      data: {
        bookCopyId: copy.id,
        borrowerId: student.userId,
        issueDate,
        dueDate,
        returnDate,
        fineAmount: isOverdue ? 50.00 : 0.00,
        finePaid: false,
        tenantId
      }
    });

    // Update copy status
    await prisma.bookCopy.update({
      where: { id: copy.id },
      data: { status }
    });

    // Update book availableCopies
    if (!isReturned) {
      await prisma.book.update({
        where: { id: copy.bookId },
        data: { availableCopies: { decrement: 1 } }
      });
    }
  }
  console.log("Seeded 12 library borrowing transactions.");

  // ==========================================
  // D. Seed Notifications
  // ==========================================
  console.log("Seeding Notifications...");
  const users = await prisma.user.findMany({
    where: { tenantId }
  });

  for (const u of users) {
    // 2 notifications per user
    await prisma.notification.create({
      data: {
        title: "Welcome to EduTrack ERP",
        message: `Hello ${u.name}, welcome to the brand new Oakridge International School dashboard. Explore your academic modules!`,
        type: "IN_APP",
        recipientId: u.id,
        isRead: false
      }
    });

    await prisma.notification.create({
      data: {
        title: "Academic Calendar Posted",
        message: "The school calendar for the current academic year is now available. Midterm exams start shortly.",
        type: "IN_APP",
        recipientId: u.id,
        isRead: true
      }
    });
  }
  console.log(`Seeded ${users.length * 2} notification alerts.`);

  console.log("==========================================");
  console.log("Extra ERP Data Seeding Completed Successfully!");
  console.log("==========================================");
}

main()
  .catch((e) => {
    console.error("Error in extra data seeder:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
