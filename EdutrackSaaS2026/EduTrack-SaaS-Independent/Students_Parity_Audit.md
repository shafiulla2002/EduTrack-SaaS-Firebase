# Students_Parity_Audit.md

## Overview
This audit evaluates the **Students Management** module against the required functional scope, identifies gaps, and quantifies production readiness.

---

## 1. Existing Backend APIs (Evidence)
- **POST `/students`** – Create a new student (implemented in `students.controller.ts` → `create`).
- **GET `/students`** – Search/list students with optional `search`, `classId`, `sectionId` (implemented in `search`).
- **GET `/students/promotion-candidates`** – Return promotion‑candidate list (implemented in `getPromotionCandidates`).
- **POST `/students/promote`** – Bulk promotion of students (implemented in `promote`).
- **GET `/students/:id`** – Fetch detailed student profile, invoices, exam marks, attendance, etc. (implemented in `getDetails`).
- **POST `/students/import`** – Bulk CSV/JSON import (implemented in `importBulk`).

All routes are guarded by `JwtAuthGuard` and are tenant‑aware via `TenantContext`.

---

## 2. Existing Frontend UI (Evidence)
A directory scan of `frontend/src/app` shows **no `students` folder**. The only top‑level UI sections are:
- `attendance`
- `complaint-box`
- `dashboard`

Consequently, **no student‑management pages** (list, detail, create/edit, promotion, import, dashboards) are present.

---

## 3. Prisma Models Used
| Model | Role |
|-------|------|
| `StudentProfile` | Core student entity (linked to `User`). |
| `User` | Authentication; role set to `STUDENT`. |
| `ClassSection`, `Class`, `Section` | Determines the class/section assignment. |
| `AcademicYear` | Supports promotion logic. |
| `Invoice` / `InvoiceItem` | Auto‑generated admission and promotion invoices. |
| `Attendance` / `AttendanceSession` | Provides attendance history for a student. |
| `ExamMark` | Exam results linked to a student. |
| `BehaviorCase` | Behaviour‑related records. |
| `Tenant` | Multi‑tenant isolation. |

---

## 4. Missing CRUD Operations
| Operation | Expected Endpoint | Status |
|----------|-------------------|--------|
| **Update Student** (edit profile, class assignment, etc.) | `PUT /students/:id` | **Missing** |
| **Delete Student** (soft‑delete or hard‑delete) | `DELETE /students/:id` | **Missing** |
| **Partial Update** (PATCH) | `PATCH /students/:id` | **Missing** |

The backend currently only supports creation, retrieval, bulk import, and promotion.

---

## 5. Missing Reports & Dashboards
1. **Student Dashboard** – Overview cards (total fees, pending balance, attendance %). 
2. **Student List Page** – Paginated table with search and filters.
3. **Student Detail Page** – Tabs for profile, invoices, exam marks, attendance history, behaviour cases.
4. **Class‑Level Student Report** – Aggregated view of all students in a class/section.
5. **Promotion UI** – Form to select source year, target year/class/section and trigger promotion.
6. **Import UI** – File upload + validation feedback.

---

## 6. Missing UI Screens (Concrete)
| Screen | Description |
|--------|-------------|
| **Students List** | Table with search, filters (class, section), pagination, actions (view, edit, delete). |
| **Student Create/Edit** | Form for personal details, class‑section assignment, fee items, optional bulk‑import shortcut. |
| **Student Detail** | Profile summary, invoices list, exam marks chart, recent attendance table, behaviour cases list. |
| **Promotion Wizard** | Step‑by‑step UI: select source year, target year/class/section, preview candidates, execute promotion. |
| **Import Wizard** | CSV/JSON file selector, preview rows, validation errors, submit button. |
| **Student Dashboard** | Tiles for total students, pending fees, average attendance, upcoming exams. |

---

## 7. Production Readiness Percentage
| Area | Coverage | Weight | Score |
|------|----------|--------|-------|
| Backend API Coverage (CRUD) | 4/7 (57%) | 30% | 17% |
| Prisma Model Integrity | All required models present | 20% | 20% |
| Authentication & Tenant Isolation | Implemented via `JwtAuthGuard` & `TenantContext` | 15% | 15% |
| Unit / Integration Tests | No test files detected for students module | 10% | 0% |
| Frontend UI Presence | 0/6 screens implemented | 15% | 0% |
| Documentation / OpenAPI | No explicit docs found | 10% | 0% |
| **Total** | — | **100%** | **52%** |

**Production readiness ≈ 52 %** – backend fundamentals are solid, but the lack of UI, missing CRUD endpoints, and absent test coverage are major blockers.

---

## 8. Implementation Roadmap (High‑Level)
1. **Add Missing Backend Endpoints** (≈ 8 h)
   - `PUT /students/:id` – update student profile and class/section.
   - `DELETE /students/:id` – soft delete (set `isActive` flag) or hard delete.
   - Optional `PATCH` for partial updates.
   - Add corresponding DTOs, validation, and service methods.
2. **Create Frontend `students` Module** (≈ 24 h)
   - scaffold `frontend/src/app/students` with sub‑folders: `list`, `create`, `edit`, `detail`, `promote`, `import`.
   - Re‑use existing UI components (cards, tables, forms) from the dashboard library.
   - Integrate API calls via the shared `api` helper.
3. **Build Student Dashboard & Reports** (≈ 12 h)
   - Dashboard page showing key metrics (totals, fees, attendance).
   - Class‑level report page with aggregation.
4. **Implement Promotion & Import Wizards** (≈ 10 h)
   - UI flows with validation, preview of affected records, progress indicator.
5. **Add Unit & Integration Tests** (≈ 12 h)
   - Service layer tests for create, update, delete, promotion logic.
   - Controller tests for new endpoints.
   - Frontend component tests (React Testing Library).
6. **Documentation & OpenAPI** (≈ 4 h)
   - Generate Swagger/OpenAPI spec for new routes.
   - Update README with usage examples.
7. **Code Review, QA & Deployment** (≈ 6 h)
   - Peer review, linting, end‑to‑end smoke test on dev environment.

**Total Estimated Effort: ~ 76 hours (≈ 2 weeks for a single developer).**

---

## 9. Next Steps
- Remove *Attendance* from the active work queue (project inventory update).
- Prioritise implementation of missing backend CRUD endpoints.
- Begin scaffolding the frontend `students` UI to unblock UI work.
- Allocate testing resources to achieve ≥ 80 % production readiness.

---

*All findings are based solely on repository evidence as of 2026‑06‑19.*
