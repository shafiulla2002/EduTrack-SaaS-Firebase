const ExcelJS = require('c:/VikasSchool/EduTrack-SaaS-Independent/frontend/node_modules/exceljs');
const path = require('path');
const fs = require('fs');

const outputPath = 'c:/VikasSchool/EduTrack-SaaS-Independent/Teacher_Portal_QA_Test_Cases.xlsx';

const headers = [
  'Item Name',
  'Module',
  'Feature',
  'Action',
  'Test Steps',
  'Expected Result',
  'Actual Result',
  'Comments',
  'Status',
  'Dev Test',
  'QA Test'
];

function createRow(id, module, feature, action, steps, expected) {
  return {
    id,
    module,
    feature,
    action,
    steps,
    expected,
    actual: '',
    comments: '',
    status: '',
    devTest: '',
    qaTest: ''
  };
}

const sheetsData = {};

// ==========================================
// 1. Login & Authentication
// ==========================================
sheetsData['Login & Authentication'] = [
  createRow('TP-AUTH-001', 'Authentication', 'Login', 'Valid Teacher Login', 
    '1. Open browser and navigate to Teacher Login page (/auth/login)\n2. Enter valid registered Teacher Email/Phone (e.g. teacher.1@school.edu)\n3. Enter valid Password\n4. Click Login button',
    'User successfully authenticates, receives JWT token, and is redirected to Teacher Dashboard (/dashboard). User session persists.'),
  createRow('TP-AUTH-002', 'Authentication', 'Login', 'Invalid Password Error', 
    '1. Enter registered Teacher Email\n2. Enter incorrect Password\n3. Click Login',
    'System rejects authentication and displays alert: "Invalid email/phone or password. Please try again."'),
  createRow('TP-AUTH-003', 'Authentication', 'Login', 'Unregistered Email Error', 
    '1. Enter non-existent email (e.g. unknown@school.com)\n2. Enter any password\n3. Click Login',
    'System displays error message: "Account not found." No sensitive credentials leaked.'),
  createRow('TP-AUTH-004', 'Authentication', 'Login', 'Blank Fields Validation', 
    '1. Leave Email and Password fields empty\n2. Click Login button',
    'Inline validation errors display: "Email/Phone is required" and "Password is required". Submission is prevented.'),
  createRow('TP-AUTH-005', 'Authentication', 'Login', 'Subdomain Multi-Tenant Context', 
    '1. Access portal via tenant subdomain (cambridge.edutrack.local/auth/login)\n2. Log in with tenant teacher credentials',
    'Tenant context resolves cleanly to Cambridge International School. Branding, logo, and data isolate to this tenant.'),
  createRow('TP-AUTH-006', 'Authentication', 'Login', 'Password Visibility Toggle', 
    '1. Type password into Password field\n2. Click Eye icon in password input',
    'Password text toggles cleanly between masked bullets (••••••) and readable text.'),
  createRow('TP-AUTH-007', 'Authentication', 'Session', 'Session Refresh Persistence', 
    '1. Log in successfully as Teacher\n2. Refresh browser page (F5 / Ctrl+R) or open new tab',
    'Session remains active. User stays logged in without re-prompting credentials.'),
  createRow('TP-AUTH-008', 'Authentication', 'Session', 'Token Expiry Redirect', 
    '1. Log in as Teacher\n2. Wait for session token expiry duration or revoke token\n3. Click any portal link',
    'System detects expired session, clears local storage tokens, and redirects user to /auth/login with session expired toast notification.'),
  createRow('TP-AUTH-009', 'Authentication', 'Logout', 'User Logout Action', 
    '1. Click Teacher Profile Avatar in top navigation\n2. Select "Logout" option',
    'User session token is destroyed, local state reset, and user redirected to /auth/login.'),
  createRow('TP-AUTH-010', 'Authentication', 'Permissions', 'Role Boundary Enforcement', 
    '1. Log in as Teacher\n2. Manually type URL for School Admin settings (/dashboard/settings/school-setup)',
    'System blocks access and displays "Access Denied: You do not have permissions to access Admin module" or redirects to Teacher Dashboard.'),
  createRow('TP-AUTH-011', 'Authentication', 'Forgot Password', 'Password Reset Request', 
    '1. Click "Forgot Password?" link on login page\n2. Enter registered teacher phone/email\n3. Click Submit',
    'System triggers OTP/Reset link to registered contact and displays confirmation message.'),
  createRow('TP-AUTH-012', 'Authentication', 'Forgot Password', 'OTP Verification Flow', 
    '1. Receive 6-digit OTP on phone/email\n2. Enter OTP on verification screen\n3. Enter New Password & Confirm Password',
    'OTP verifies successfully, password updates in backend database, and user redirected to Login with success message.'),
  createRow('TP-AUTH-013', 'Authentication', 'Password Policy', 'Min Complexity Validation', 
    '1. Attempt setting new password to "12345"',
    'Validation error prevents submission: "Password must be at least 8 characters long and contain numbers and letters."'),
  createRow('TP-AUTH-014', 'Authentication', 'Security', 'Brute Force Rate Limiting', 
    '1. Enter wrong password 5 consecutive times within 1 minute',
    'System temporarily locks login attempts for 15 minutes or presents CAPTCHA challenge to prevent brute-force attacks.'),
  createRow('TP-AUTH-015', 'Authentication', 'Security', 'SQL Injection Protection', 
    '1. Type \' OR \'1\'=\'1 in username and password fields',
    'Input is sanitized, SQL injection attempt blocked, and generic invalid credentials alert displayed.')
];

// ==========================================
// 2. Dashboard
// ==========================================
sheetsData['Dashboard'] = [
  createRow('TP-DASH-001', 'Dashboard', 'Layout', 'Teacher Dashboard Initial Load', 
    '1. Log in as Teacher\n2. Inspect overall dashboard interface',
    'Dashboard loads cleanly displaying header greeting, active academic year, quick stats cards, today\'s schedule, and announcements.'),
  createRow('TP-DASH-002', 'Dashboard', 'Statistics', 'Total Assigned Students Counter', 
    '1. Observe "Total Students" summary card on dashboard',
    'Displays exact total count of active students across all class sections assigned to the logged-in teacher.'),
  createRow('TP-DASH-003', 'Dashboard', 'Statistics', 'Today\'s Classes Counter', 
    '1. View "Today\'s Classes" count card\n2. Compare count with teacher timetable schedule today',
    'Displays total number of class periods scheduled for the teacher on the current date.'),
  createRow('TP-DASH-004', 'Dashboard', 'Statistics', 'Pending Homework Submissions', 
    '1. Check "Pending Submissions" count card',
    'Displays total count of student homework submissions awaiting teacher review/grading.'),
  createRow('TP-DASH-005', 'Dashboard', 'Schedule Widget', 'Next Period Class Highlight', 
    '1. Observe "Next Period" card on dashboard during active school hours',
    'Card highlights current/upcoming class period, subject name, class-section, and classroom room number in real-time.'),
  createRow('TP-DASH-006', 'Dashboard', 'Quick Actions', 'Take Attendance Shortcut', 
    '1. Click "Take Attendance" button on dashboard',
    'Navigates directly to Attendance Entry page (/attendance/entry) with teacher\'s first class section pre-selected.'),
  createRow('TP-DASH-007', 'Dashboard', 'Quick Actions', 'Create Homework Shortcut', 
    '1. Click "Create Homework" button on dashboard',
    'Opens Create Homework modal with assigned class dropdowns ready.'),
  createRow('TP-DASH-008', 'Dashboard', 'Announcements Widget', 'Recent Circulars Feed', 
    '1. View "Recent Announcements" panel on dashboard',
    'Displays top 5 latest announcements targeted to teachers or school-wide with publish dates.'),
  createRow('TP-DASH-009', 'Dashboard', 'Leave Summary Widget', 'Teacher Leave Balance Display', 
    '1. Check Leave Summary card on dashboard',
    'Displays Casual Leave, Sick Leave, and Paid Leave balances alongside status of pending leave applications.'),
  createRow('TP-DASH-010', 'Dashboard', 'Header Notifications', 'Unread Alert Badge', 
    '1. Observe Bell Icon in top navigation header',
    'Red badge count accurately matches unread notification items for the logged-in teacher.'),
  createRow('TP-DASH-011', 'Dashboard', 'Performance', 'Dashboard Load Speed', 
    '1. Measure initial page load speed using browser DevTools Network tab',
    'Dashboard page assets and API responses render in under 2.0 seconds with zero console errors.'),
  createRow('TP-DASH-012', 'Dashboard', 'Empty State', 'Teacher Without Assigned Classes', 
    '1. Log in as a newly registered Teacher with zero assigned class sections',
    'Dashboard displays empty state message: "You are not assigned to any classes yet. Please contact your school administrator."')
];

// ==========================================
// 3. Student Directory
// ==========================================
sheetsData['Student Directory'] = [
  createRow('TP-DIR-001', 'Student Directory', 'View Roster', 'Assigned Class Roster Display', 
    '1. Navigate to Student Directory (/dashboard/students)\n2. Select Class & Section dropdown',
    'Student roster table loads displaying Roll Number, Photo Avatar, Student Name, Gender, Guardian Name, and Contact Number.'),
  createRow('TP-DIR-002', 'Student Directory', 'Search', 'Live Student Name Search', 
    '1. Type student name "Aadi" in search bar',
    'Roster table dynamically filters to display matching student records in real time.'),
  createRow('TP-DIR-003', 'Student Directory', 'Search', 'Roll Number Search', 
    '1. Type Roll Number "14" in search bar',
    'Filters table to display student with Roll Number 14.'),
  createRow('TP-DIR-004', 'Student Directory', 'Filter', 'Gender / House Filtering', 
    '1. Select Gender filter dropdown -> "Female"',
    'Table filters roster to show female students only.'),
  createRow('TP-DIR-005', 'Student Directory', 'Student Profile', 'Personal Details Modal', 
    '1. Click on Student Name or "View Profile" action button',
    'Opens student profile modal displaying Admission No, Roll No, DOB, Blood Group, Aadhar No, and Address.'),
  createRow('TP-DIR-006', 'Student Directory', 'Parent Details', 'Guardian Contact Info', 
    '1. Click "Parent Information" tab in student profile',
    'Displays Father Name, Mother Name, Primary Contact Phone, Emergency Phone, and Email Address.'),
  createRow('TP-DIR-007', 'Student Directory', 'Attendance History', 'Individual Student Attendance Tab', 
    '1. Click "Attendance History" tab in student profile',
    'Displays overall attendance percentage, monthly present/absent counts, and recent daily attendance log.'),
  createRow('TP-DIR-008', 'Student Directory', 'Fee Summary', 'Live Billing Dues View', 
    '1. Click "Fee Summary" tab in student profile',
    'Displays total fee, paid amount, and pending balance directly from BillingService single source of truth.'),
  createRow('TP-DIR-009', 'Student Directory', 'Export', 'Export Roster to Excel', 
    '1. Click "Export Roster" button',
    'Browser downloads formatted .xlsx spreadsheet containing master student records for the selected class section.'),
  createRow('TP-DIR-010', 'Student Directory', 'Security', 'Teacher Class Access Isolation', 
    '1. Log in as Class-1 teacher\n2. Attempt accessing Class-10 student profile via URL manipulation',
    'System enforces role boundary check and blocks access to students outside teacher\'s assigned class sections.')
];

// ==========================================
// 4. Attendance
// ==========================================
sheetsData['Attendance'] = [
  createRow('TP-ATT-001', 'Attendance', 'Take Attendance', 'Class & Section Selection', 
    '1. Navigate to Attendance -> Entry (/attendance/entry)\n2. Click Class dropdown\n3. Click Section dropdown',
    'Class dropdown populates assigned classes only. Section dropdown populates matching sections.'),
  createRow('TP-ATT-002', 'Attendance', 'Take Attendance', 'Date Picker Defaulting', 
    '1. Open Attendance Entry page',
    'Date picker defaults to today\'s date (current local date).'),
  createRow('TP-ATT-003', 'Attendance', 'Validation', 'Future Date Selection Restriction', 
    '1. Open Date picker\n2. Attempt selecting tomorrow or future date',
    'Calendar disables future dates and backend rejects future date submission attempts with error message.'),
  createRow('TP-ATT-004', 'Attendance', 'Take Attendance', 'Student Roster Loading', 
    '1. Select Class-1 and Section-B',
    'Student roster populates with Roll Number, Photo, Name, and attendance status radio buttons.'),
  createRow('TP-ATT-005', 'Attendance', 'Take Attendance', 'Mark All Present Shortcut', 
    '1. Click "Mark All Present" toggle at top of roster',
    'All student status radio buttons switch to "PRESENT". Summary counter displays total present count.'),
  createRow('TP-ATT-006', 'Attendance', 'Take Attendance', 'Individual Student Status Toggle', 
    '1. Click "ABSENT" for Roll No 14\n2. Click "LATE" for Roll No 22\n3. Click "EXCUSED" for Roll No 30',
    'Individual student statuses update immediately. Status badges update colors (Green=Present, Red=Absent, Yellow=Late, Blue=Excused).'),
  createRow('TP-ATT-007', 'Attendance', 'Take Attendance', 'Remarks Entry', 
    '1. Mark Roll No 14 as ABSENT\n2. Enter remark: "Sick leave informed by parent"',
    'Remark text captures note and persists with attendance record.'),
  createRow('TP-ATT-008', 'Attendance', 'Submit Attendance', 'Class Attendance Submission', 
    '1. Mark status for all students\n2. Click "Submit Attendance" button',
    'System creates AttendanceSession record, creates individual Attendance records, displays success toast, and locks form.'),
  createRow('TP-ATT-009', 'Attendance', 'Validation', 'Duplicate Submission Prevention', 
    '1. Submit attendance for Class-1 Sec B today\n2. Re-open Attendance Entry for same class & date',
    'System detects existing session today, displays "Attendance Already Submitted for Today", and presents "Edit Attendance" option.'),
  createRow('TP-ATT-010', 'Attendance', 'Edit Attendance', 'Edit Same-Day Attendance', 
    '1. Open submitted attendance for Class-1 Sec B today\n2. Click "Edit Attendance"\n3. Change Roll No 14 from ABSENT to PRESENT\n4. Click "Save Changes"',
    'Session updates existing records, total present count recalculates, and audit log records modification.'),
  createRow('TP-ATT-011', 'Attendance', 'Validation', 'Historical Edit Window Lock', 
    '1. Attempt editing attendance from 30 days ago',
    'System blocks edits and displays alert: "Attendance editing period expired. Contact Administrator."'),
  createRow('TP-ATT-012', 'Attendance', 'Calculation', 'Student Attendance Percentage', 
    '1. Open Attendance History for Student A (18 Present / 20 Sessions)',
    'Percentage calculates exactly: (18 / 20) * 100 = 90%. If total sessions = 0, displays "N/A" instead of assuming 100%.'),
  createRow('TP-ATT-013', 'Attendance', 'History & Filtering', 'Attendance History Filters', 
    '1. Navigate to Attendance -> History (/attendance/history)\n2. Select Date Range, Class, Section\n3. Click Search',
    'Displays detailed log of submitted sessions with Date, Class, Taken By, Present Count, Absent Count, and View Action.'),
  createRow('TP-ATT-014', 'Attendance', 'Export', 'Export Attendance Excel Sheet', 
    '1. On History page, click "Export to Excel"',
    'Downloads formatted .xlsx file containing student roll numbers, daily statuses, and monthly totals.'),
  createRow('TP-ATT-015', 'Attendance', 'Integration', 'Real-time Parent Portal Sync', 
    '1. Teacher submits attendance for Aadi Gupta as Present\n2. Check Parent Portal',
    'Parent Portal updates Aadi Gupta\'s status from "Attendance Not Taken Yet" to "PRESENT" immediately.'),
  createRow('TP-ATT-016', 'Attendance', 'Integration', 'Real-time Admin Portal Sync', 
    '1. Teacher submits attendance\n2. Check School Admin Portal -> Attendance Management',
    'Admin Portal Attendance Overview and Daily Reports reflect exact present/absent counts immediately.')
];

// ==========================================
// 5. Homework
// ==========================================
sheetsData['Homework'] = [
  createRow('TP-HW-001', 'Homework', 'View Homework', 'Homework List Loading', 
    '1. Navigate to Homework (/dashboard/homework)\n2. Select Class & Section filter',
    'Displays list of active homework assignments with Subject, Title, Assigned Date, Due Date, and Submission Count.'),
  createRow('TP-HW-002', 'Homework', 'Create Homework', 'Mandatory Fields Validation', 
    '1. Click "Create Homework"\n2. Leave Title and Subject empty\n3. Click Save',
    'Validation errors display: "Title is required" and "Subject is required". Submission is blocked.'),
  createRow('TP-HW-003', 'Homework', 'Create Homework', 'Successful Homework Creation', 
    '1. Enter Title: "Math Chapter 4 Exercises"\n2. Select Class-5 Sec A, Subject: Mathematics\n3. Select Due Date (3 days from today)\n4. Enter Description\n5. Click Submit',
    'Homework record created, success toast displayed, and assignment appears in active homework table.'),
  createRow('TP-HW-004', 'Homework', 'Create Homework', 'File Attachment Upload', 
    '1. Click "Upload Attachment"\n2. Select valid PDF file (2MB)\n3. Click Save',
    'File uploads cleanly, attachment link displays file name and size, and file stores in cloud storage.'),
  createRow('TP-HW-005', 'Homework', 'Validation', 'File Format & Size Restriction', 
    '1. Attempt uploading a .exe file or PDF exceeding 10MB',
    'System rejects upload with error: "Invalid file format or file exceeds max 10MB limit."'),
  createRow('TP-HW-006', 'Homework', 'Multi-Section Assign', 'Assign to Multiple Sections', 
    '1. Select Class-5 Sec A and Class-5 Sec B in Create Homework modal',
    'Homework creates parallel records for both section rosters.'),
  createRow('TP-HW-007', 'Homework', 'Edit Homework', 'Update Homework Details', 
    '1. Click Edit icon on active homework\n2. Change Due Date and Description\n3. Click Save Changes',
    'Homework details update in database and modified due date reflects immediately across portals.'),
  createRow('TP-HW-008', 'Homework', 'Delete Homework', 'Remove Homework Assignment', 
    '1. Click Delete icon on homework item\n2. Confirm in modal',
    'Homework record is deleted/archived and no longer visible to students or parents.'),
  createRow('TP-HW-009', 'Homework', 'Submissions', 'View Student Submissions', 
    '1. Click "View Submissions" on homework item',
    'Displays student submission table with Student Name, Submission Date, Attached Files, and Review Status.'),
  createRow('TP-HW-010', 'Homework', 'Submissions', 'Grade & Feedback Entry', 
    '1. Open student submission\n2. Enter Grade/Marks (10/10) and Feedback comments\n3. Click Save Grade',
    'Grade and feedback save successfully, status updates to "Graded", and parent receives grade notification.'),
  createRow('TP-HW-011', 'Homework', 'Integration', 'Parent Portal Homework Sync', 
    '1. Teacher publishes new homework assignment\n2. Check Parent Portal',
    'Parent Portal Homework module lists the new assignment under Active Homeworks with due date badge.')
];

// ==========================================
// 6. Exams & Marks
// ==========================================
sheetsData['Exams & Marks'] = [
  createRow('TP-EXAM-001', 'Exams & Marks', 'Schedule View', 'Exam Timetable Schedule', 
    '1. Navigate to Exams -> Schedule (/dashboard/exams/schedule)\n2. Select Class & Exam',
    'Displays exam schedule showing Exam Dates, Subjects, Duration, Pass Marks, and Maximum Marks.'),
  createRow('TP-EXAM-002', 'Exams & Marks', 'Marks Entry', 'Marks Sheet Loading', 
    '1. Navigate to Marks Entry (/dashboard/marks-mgmt)\n2. Select Exam, Class, Section, Subject\n3. Click Load Marks Sheet',
    'Roster table loads with Roll No, Student Name, Max Marks header, Marks Obtained input, and Grade column.'),
  createRow('TP-EXAM-003', 'Exams & Marks', 'Marks Entry', 'Valid Marks Input', 
    '1. Enter 85 in Marks input for student with Max Marks 100\n2. Press Tab',
    'Input accepts 85, Grade column automatically calculates "A", and status marks valid.'),
  createRow('TP-EXAM-004', 'Exams & Marks', 'Validation', 'Exceeding Max Marks Error', 
    '1. Try entering 105 for a test with Max Marks 100',
    'System blocks input, highlights box in red, and displays error: "Marks obtained cannot exceed maximum marks (100)."'),
  createRow('TP-EXAM-005', 'Exams & Marks', 'Validation', 'Negative Marks Prevention', 
    '1. Enter -10 in marks input field',
    'Validation prevents negative values and displays error message.'),
  createRow('TP-EXAM-006', 'Exams & Marks', 'Marks Entry', 'Absent / Medical Flagging', 
    '1. Check "ABSENT" checkbox next to Roll No 12 input field',
    'Marks input field disables, value sets to "AB", and status flags student as absent for the exam.'),
  createRow('TP-EXAM-007', 'Exams & Marks', 'Draft Save', 'Save Marks as Draft', 
    '1. Fill marks for 15 out of 30 students\n2. Click "Save Draft"',
    'Draft marks save without publishing. Teacher can resume entry later.'),
  createRow('TP-EXAM-008', 'Exams & Marks', 'Final Submission', 'Submit & Lock Marks', 
    '1. Enter marks for all students\n2. Click "Final Submit Marks"',
    'Marks submit for admin verification, status updates to "Submitted", and notification sent to Exam Admin.'),
  createRow('TP-EXAM-009', 'Exams & Marks', 'Integration', 'Parent Report Card Sync', 
    '1. Admin approves and publishes Exam Results\n2. Check Parent Portal -> Exams & Marks',
    'Parent Portal displays published marks, grade breakdown, and downloadable Report Card PDF.')
];

// ==========================================
// 7. Timetable
// ==========================================
sheetsData['Timetable'] = [
  createRow('TP-TT-001', 'Timetable', 'Today\'s Schedule', 'Dashboard Schedule Card', 
    '1. View Today\'s Timetable on Teacher Dashboard',
    'Displays sequential list of today\'s class periods, start/end times, subject names, and section room numbers.'),
  createRow('TP-TT-002', 'Timetable', 'Weekly View', 'Full Teacher Timetable Grid', 
    '1. Navigate to Timetable (/dashboard/my-timetable)',
    'Renders weekly 6-day timetable matrix (Monday to Saturday) showing assigned periods across all days.'),
  createRow('TP-TT-003', 'Timetable', 'Class View', 'Class Section Timetable', 
    '1. Select Class & Section in Timetable dropdown',
    'Displays complete timetable for that specific class section including all subject teachers.'),
  createRow('TP-TT-004', 'Timetable', 'Current Class Highlight', 'Real-time Active Period Indicator', 
    '1. View Timetable during Period 3 (10:30 AM - 11:15 AM)',
    'Active period cell highlights with animated badge "NOW ONGOING".'),
  createRow('TP-TT-005', 'Timetable', 'Substitution Alert', 'Proxy / Cover Period Alert', 
    '1. Admin assigns teacher a substitution period for an absent staff member',
    'Teacher receives notification alert and substitution class displays in today\'s schedule with "COVER" tag.')
];

// ==========================================
// 8. Announcements
// ==========================================
sheetsData['Announcements'] = [
  createRow('TP-ANN-001', 'Announcements', 'List View', 'Circulars & Notices Feed', 
    '1. Navigate to Announcements (/dashboard/announcements-mgmt)',
    'Displays chronological feed of school announcements with Category, Title, Posted Date, and Target Audience.'),
  createRow('TP-ANN-002', 'Announcements', 'Search & Filter', 'Category Filtering', 
    '1. Select Category dropdown -> "Academic"',
    'Feed filters to display academic circulars only.'),
  createRow('TP-ANN-003', 'Announcements', 'Detail Modal', 'View Circular & Attachments', 
    '1. Click on an announcement item\n2. View detail modal and click attached PDF link',
    'Modal displays formatted announcement content and attachment opens/downloads cleanly.'),
  createRow('TP-ANN-004', 'Announcements', 'Read Tracking', 'Mark as Read Status', 
    '1. Open unread announcement\n2. Close detail modal',
    'Unread indicator disappears and notification count decrements by 1.')
];

// ==========================================
// 9. Leave Management
// ==========================================
sheetsData['Leave Management'] = [
  createRow('TP-LV-001', 'Leave Management', 'Balance Summary', 'Leave Entitlement Cards', 
    '1. Navigate to Leave Management (/dashboard/leave-mgmt)',
    'Summary cards display Total Allocated, Used, and Remaining balance for Casual Leave, Sick Leave, and Paid Leave.'),
  createRow('TP-LV-002', 'Leave Management', 'Apply Leave', 'Successful Leave Application', 
    '1. Click "Apply Leave"\n2. Select Leave Type: Casual Leave\n3. Select Start Date & End Date (2 days)\n4. Enter Reason: "Family function"\n5. Click Submit',
    'Leave application submits successfully, status sets to "PENDING APPROVAL", and notification sent to Admin.'),
  createRow('TP-LV-003', 'Leave Management', 'Validation', 'Invalid Date Range Error', 
    '1. Select Start Date: 25th July, End Date: 20th July\n2. Click Submit',
    'Validation blocks submission with error: "End date must be on or after start date."'),
  createRow('TP-LV-004', 'Leave Management', 'Validation', 'Exceeding Available Balance', 
    '1. Apply for 10 days Casual Leave when remaining balance is 2 days',
    'System displays warning: "Requested leave days (10) exceeds available Casual Leave balance (2)."'),
  createRow('TP-LV-005', 'Leave Management', 'Attachment', 'Medical Certificate Upload', 
    '1. Select Leave Type: Sick Leave for 3 days\n2. Attach medical certificate image/PDF\n3. Submit application',
    'Attachment uploads cleanly and links to the leave application for admin review.'),
  createRow('TP-LV-006', 'Leave Management', 'Withdraw / Cancel', 'Cancel Pending Leave Request', 
    '1. Locate PENDING leave request in history\n2. Click "Cancel Application"',
    'Application status updates to "CANCELLED" and locked leave days release back to remaining balance.'),
  createRow('TP-LV-007', 'Leave Management', 'Approval Sync', 'Real-time Approval Notification', 
    '1. Admin approves teacher\'s leave request in Admin Portal',
    'Teacher receives real-time notification alert and leave status updates to "APPROVED" badge in green.')
];

// ==========================================
// 10. Complaint Box
// ==========================================
sheetsData['Complaint Box'] = [
  createRow('TP-CMP-001', 'Complaint Box', 'Create Ticket', 'Submit Complaint / Feedback', 
    '1. Navigate to Complaint Box (/complaint-box or /dashboard/complaints)\n2. Click "New Ticket"\n3. Select Category: "Classroom Maintenance"\n4. Enter Title and Description\n5. Click Submit',
    'Ticket logs successfully with unique Ticket ID (e.g. TKT-8902), status sets to "OPEN", and routes to Admin Desk.'),
  createRow('TP-CMP-002', 'Complaint Box', 'Tracking', 'View Ticket Status & Timeline', 
    '1. Click on active ticket TKT-8902',
    'Displays ticket details, priority tag, status progress bar (Open -> In Progress -> Resolved), and response thread.'),
  createRow('TP-CMP-003', 'Complaint Box', 'Conversation', 'Add Response Comment', 
    '1. In ticket detail view, enter comment: "Projector repair verified"\n2. Click Post Comment',
    'Comment posts to discussion timeline and alerts handling admin staff.')
];

// ==========================================
// 11. Reports
// ==========================================
sheetsData['Reports'] = [
  createRow('TP-REP-001', 'Reports', 'Attendance Report', 'Monthly Class Attendance Summary', 
    '1. Navigate to Reports -> Attendance (/dashboard/reports)\n2. Select Class-4 Sec C, Month: July 2026\n3. Click Generate Report',
    'Generates monthly matrix showing student list, working days, present count, absent count, and monthly percentage.'),
  createRow('TP-REP-002', 'Reports', 'Marks Summary', 'Subject Performance Breakdown', 
    '1. Select Exam: Unit Test 1, Subject: Science\n2. Click Generate Report',
    'Displays statistical distribution (Highest Score, Lowest Score, Class Average, Pass Percentage, Grade Chart).'),
  createRow('TP-REP-003', 'Reports', 'Export', 'Download Report PDF & Excel', 
    '1. Click "Export PDF" or "Export Excel" button on generated report',
    'System generates printable, formatted document matching screen calculations exactly.')
];

// ==========================================
// 12. Notifications
// ==========================================
sheetsData['Notifications'] = [
  createRow('TP-NOTIF-001', 'Notifications', 'Bell Icon', 'Real-time Unread Badge Count', 
    '1. Trigger an alert (e.g. leave approval or new circular)\n2. Observe header Bell icon',
    'Red badge count updates immediately via real-time WebSockets or poll without requiring full page reload.'),
  createRow('TP-NOTIF-002', 'Notifications', 'Panel Navigation', 'Click Notification Redirection', 
    '1. Click notification: "Leave Application Approved"',
    'System marks notification as read and redirects user directly to Leave Management page.'),
  createRow('TP-NOTIF-003', 'Notifications', 'Bulk Actions', 'Mark All as Read', 
    '1. Open Notifications panel\n2. Click "Mark All as Read"',
    'All unread notifications switch to read state and header badge count resets to zero.')
];

// ==========================================
// 13. Settings
// ==========================================
sheetsData['Settings'] = [
  createRow('TP-SET-001', 'Settings', 'Profile Settings', 'Update Contact Info', 
    '1. Navigate to Settings -> Profile (/dashboard/profile)\n2. Update Phone Number or Address\n3. Click Save Changes',
    'Profile details update in database, success toast displayed, and header profile updates.'),
  createRow('TP-SET-002', 'Settings', 'Avatar Upload', 'Upload Profile Picture', 
    '1. Click "Change Photo"\n2. Select valid JPG/PNG image (max 2MB)\n3. Crop preview and click Upload',
    'Profile avatar image uploads to cloud storage and updates across header and directory profiles.'),
  createRow('TP-SET-003', 'Settings', 'Change Password', 'Update Account Password', 
    '1. Click Change Password tab\n2. Enter Current Password\n3. Enter New Password & Confirm Password\n4. Click Update Password',
    'Verifies current password, updates to new hashed password, logs out session, and prompts login with new password.')
];

// ==========================================
// 14. Mobile & Responsive Testing
// ==========================================
sheetsData['Mobile & Responsive Testing'] = [
  createRow('TP-MOB-001', 'Mobile Viewport', 'Responsiveness', 'Mobile Layout Adaptability (375px)', 
    '1. Open Teacher Portal on mobile browser (iPhone 13 390x844)\n2. Inspect navigation and layout',
    'Sidebar collapses into sliding drawer menu. Header controls, cards, and buttons re-align vertically without horizontal breaking.'),
  createRow('TP-MOB-002', 'Mobile Viewport', 'Navigation', 'Hamburger Drawer Toggle', 
    '1. Tap Hamburger icon in mobile header\n2. Tap any menu item (e.g. Attendance)',
    'Drawer slides open smoothly. Tapping menu item navigates to page and automatically closes drawer overlay.'),
  createRow('TP-MOB-003', 'Mobile Viewport', 'Attendance Entry', 'Mobile Touch Target Usability', 
    '1. Open Attendance Entry on mobile viewport\n2. Tap Present/Absent buttons for multiple students',
    'Radio buttons and toggle cards are touch-friendly (minimum 44px x 44px) and respond instantly to tap gestures without double-tap zooming.'),
  createRow('TP-MOB-004', 'Mobile Viewport', 'Tables', 'Mobile Horizontal Scrolling / Card Transform', 
    '1. Open Student Directory or Marks Entry table on mobile',
    'Tables allow smooth horizontal swipe or transform into stacked mobile cards for easy reading.'),
  createRow('TP-MOB-005', 'Mobile Viewport', 'Camera Integration', 'Photo Attachment via Mobile Camera', 
    '1. Tap "Upload Photo" on mobile device\n2. Choose Camera option to capture photo directly',
    'Mobile device opens camera, captures photo, and uploads image preview to portal cleanly.')
];

// ==========================================
// 15. Integration Testing
// ==========================================
sheetsData['Integration Testing'] = [
  createRow('TP-INT-001', 'Integration', 'Attendance Sync', 'Teacher -> Parent Portal Attendance Sync', 
    '1. Teacher submits attendance for Class-3 Sec B (Aadi Gupta marked Present)\n2. Check Parent Portal',
    'Parent Dashboard immediately updates today\'s status from "Attendance Not Taken Yet" to "PRESENT".'),
  createRow('TP-INT-002', 'Integration', 'Attendance Sync', 'Teacher -> Admin Portal Attendance Sync', 
    '1. Teacher submits class attendance\n2. Check School Admin Portal -> Attendance Management',
    'School Admin Attendance Overview and Daily Reports reflect exact present/absent counts immediately.'),
  createRow('TP-INT-003', 'Integration', 'Billing Sync', 'Teacher Directory -> Billing Module Single Source of Truth', 
    '1. Teacher views Fee Summary in Student Directory\n2. Compare values with Admin Billing Ledger',
    'Teacher Student Directory fee metrics match Admin Billing module totals (total fees, paid amount, pending balance) 100% accurately.'),
  createRow('TP-INT-004', 'Integration', 'Homework Sync', 'Teacher Homework -> Parent Portal Sync', 
    '1. Teacher posts new homework with due date\n2. Check Parent Portal Homework module',
    'Homework assignment appears instantly in Parent Portal active list with push notification alert.'),
  createRow('TP-INT-005', 'Integration', 'Exam Sync', 'Teacher Marks Entry -> Parent Report Card Sync', 
    '1. Teacher submits exam marks\n2. Admin publishes exam results\n3. Check Parent Portal Exams & Marks',
    'Parent Portal displays published marks, total score, and downloadable report card PDF.'),
  createRow('TP-INT-006', 'Integration', 'Tenant Isolation', 'Multi-tenant Data Boundary Protection', 
    '1. Log in as Teacher of Tenant A\n2. Attempt to query or access data of Tenant B',
    'System strictly enforces tenantId database filtering and rejects cross-tenant API requests with 403 Forbidden.')
];

// ==========================================
// 16. Regression Testing
// ==========================================
sheetsData['Regression Testing'] = [
  createRow('TP-REG-001', 'Regression', 'Attendance Engine', 'Attendance Re-submission Integrity', 
    '1. Submit attendance, edit session 3 times, and verify database state',
    'Database retains consistent single session record per class-section-date without creating orphan duplicate entries.'),
  createRow('TP-REG-002', 'Regression', 'Billing Integration', 'Fee Summary Balance Integrity', 
    '1. Pay invoice from Parent Portal\n2. Open Teacher Student Directory -> Fee Summary',
    'Teacher Student Directory immediately reflects updated ₹0 pending balance without stale cache issues.'),
  createRow('TP-REG-003', 'Regression', 'Marks Management', 'Locked Marks Preservation', 
    '1. Finalize and lock exam marks\n2. Attempt editing locked marks as Teacher without admin unlock',
    'System prevents modification of locked marks and preserves verified score data integrity.'),
  createRow('TP-REG-004', 'Regression', 'Cross-Browser', 'Browser Engine Compatibility', 
    '1. Execute key Teacher workflows across Chrome, Safari, Firefox, and Microsoft Edge',
    'All pages render layout cleanly, interactive elements respond, and zero javascript runtime errors occur across browsers.')
];

async function generateWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EduTrack SaaS QA Team';
  workbook.lastModifiedBy = 'EduTrack SaaS QA Automation';
  workbook.created = new Date();
  workbook.modified = new Date();

  for (const [sheetName, rows] of Object.entries(sheetsData)) {
    const ws = workbook.addWorksheet(sheetName, {
      pageSetup: { orientation: 'landscape', fitToPage: true }
    });

    // Set Freeze Header View (Freeze Top Row)
    ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

    // Set Columns
    ws.columns = [
      { header: 'Item Name', key: 'id', width: 16 },
      { header: 'Module', key: 'module', width: 22 },
      { header: 'Feature', key: 'feature', width: 22 },
      { header: 'Action', key: 'action', width: 28 },
      { header: 'Test Steps', key: 'steps', width: 55 },
      { header: 'Expected Result', key: 'expected', width: 55 },
      { header: 'Actual Result', key: 'actual', width: 20 },
      { header: 'Comments', key: 'comments', width: 20 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Dev Test', key: 'devTest', width: 14 },
      { header: 'QA Test', key: 'qaTest', width: 14 }
    ];

    // Style Header Row (Row 1)
    const headerRow = ws.getRow(1);
    headerRow.height = 28;
    headerRow.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '1E3A8A' } // Deep Navy Blue
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    
    headerRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: '0F172A' } },
        left: { style: 'thin', color: { argb: '0F172A' } },
        bottom: { style: 'medium', color: { argb: '0F172A' } },
        right: { style: 'thin', color: { argb: '0F172A' } }
      };
    });

    // Add Data Rows
    rows.forEach((rowData, index) => {
      const row = ws.addRow(rowData);
      row.height = 45; // Generous height for wrapped steps
      row.font = { name: 'Segoe UI', size: 10 };
      row.alignment = { vertical: 'top', wrapText: true };

      // Zebra striping background
      const bgColor = index % 2 === 0 ? 'FFFFFF' : 'F8FAFC'; // White / Soft Blue-Gray

      row.eachCell((cell, colNumber) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: bgColor }
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'E2E8F0' } },
          left: { style: 'thin', color: { argb: 'E2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
          right: { style: 'thin', color: { argb: 'E2E8F0' } }
        };

        // Center align Item Name, Status, Dev Test, QA Test
        if (colNumber === 1 || colNumber >= 9) {
          cell.alignment = { vertical: 'top', horizontal: 'center', wrapText: true };
        }
        if (colNumber === 1) {
          cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: '1E293B' } };
        }
      });
    });

    // Enable AutoFilter on Header Row
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: 11 }
    };
  }

  await workbook.xlsx.writeFile(outputPath);
  console.log(`Successfully generated professionally styled Excel Workbook at: ${outputPath}`);
}

generateWorkbook().catch(err => console.error(err));
