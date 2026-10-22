# Students_Source_Verification.md

## 1. Backend APIs (Students Module)

| HTTP Method | Route | Description |
|-------------|-------|-------------|
| **POST** | `/students` | Create a new student (calls `createStudent`). |
| **GET** | `/students` | Search/list students with optional query parameters `search`, `classId`, `sectionId` (calls `searchStudents`). |
| **GET** | `/students/promotion-candidates` | Retrieve promotion‑candidate list for a given source academic year (`sourceYearId`) and optional class/section filters. |
| **POST** | `/students/promote` | Promote a batch of students to a target academic year / class / section. |
| **GET** | `/students/:id` | Get detailed information for a specific student (profile, invoices, exam marks, attendance, etc.). |
| **POST** | `/students/import` | Bulk import of student records via CSV/JSON payload (`importStudentsBulk`). |

*All routes are protected by `JwtAuthGuard` (authenticated, tenant‑scoped).*  

## 2. Existing Frontend Pages

The frontend `src/app` directory currently contains the following top‑level folders:

- `attendance`
- `complaint-box`
- `dashboard`
- `globals.css`
- `layout.tsx`
- `page.tsx`
- `ui`

There is **no `students` folder**, therefore **no student‑management UI pages** exist in the codebase.

## 3. Prisma Models Referenced by the Students Module

| Model | Purpose in Students Module |
|-------|----------------------------|
| `StudentProfile` | Core student entity; linked to `User`, `ClassSection`, invoices, attendance, exam marks, behavior cases, etc. |
| `User` | Holds authentication data; role is `STUDENT` for student users. |
| `ClassSection` | Relates a student to a specific class and section. |
| `Class` & `Section` | Used to resolve class/section names during creation and promotion. |
| `AcademicYear` | Determines the source/target year for promotion logic. |
| `Invoice` & `InvoiceItem` | Auto‑generated admission and promotion fee invoices. |
| `Attendance` & `AttendanceSession` | Included when fetching a student’s recent attendance history. |
| `ExamMark` | Included when retrieving a student’s exam results. |
| `BehaviorCase` | Linked for behaviour‑related records.
| `Tenant` | All queries are tenant‑scoped via `TenantContext`. |

## 4. Summary

- **Backend**: Core CRUD‑ish endpoints (create, read, bulk import, promotion) are present.
- **Frontend**: No student‑management UI currently.
- **Prisma**: A rich set of models is already defined and used by the service layer.

---
*Generated from repository evidence on 2026‑06‑19.*
