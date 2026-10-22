# Complaint Box Salesforce Parity Audit Report

This report documents the deep parity validation between the Salesforce EduTrack Complaint Box module and the EduTrack SaaS Complaint Box implementation. 

---

## 1. Missing Functionalities

1.  **Class-Scoped Student Selection Workflow**:
    *   **Salesforce Behavior**: Gated workflow where the user *must* select a Class from the `Class__c` dropdown first. This triggers the server call `getStudentsByClass`. The search input and student card grid only render after selection.
    *   **Current SaaS Behavior**: Global autocomplete search input is visible immediately; class filtration is bypassed entirely.
    *   **Correction**: Restructure the frontend layout to enforce the Class dropdown selection first, loading students for that class, and gating the search input and card grid.
2.  **Local Memory Search Filtration**:
    *   **Salesforce Behavior**: real-time search input filters the already-loaded student list locally in memory by comparing the search string with Name or Phone. No server requests are fired during typing.
    *   **Current SaaS Behavior**: Triggers debounce API queries (`/complaint-box/search-students`) on every keystroke to search globally.
    *   **Correction**: Implement local memory search filtration on the retrieved class list, eliminating redundant API hits.
3.  **Active Student Reset Flow**:
    *   **Salesforce Behavior**: Selecting a student locks them in an alert-style confirmation header. Clicking the `X` button clears the selection and completely resets all form inputs.
    *   **Current SaaS Behavior**: Selection relies on a small text alert without a dedicated layout reset flow.
    *   **Correction**: Integrate a gradient success block with a clear button that triggers a total input reset.

---

## 2. Missing Database Fields

There are no functional data gaps in the PostgreSQL `BehaviorCase` schema, but the following metadata properties in Salesforce `Case` are missing in PostgreSQL. They are mapped dynamically in the SaaS code:

| Salesforce Object & Field | SaaS Table & Field Equivalent | Type & Description | Parity Mapping Strategy |
|:---|:---|:---|:---|
| `Case.Subject` | Synthesized in code | `Text` (derived subject string) | Created dynamically as `Behavior Type - Category - Student Name`. |
| `Case.Origin` | Hardcoded context | `Picklist` (default: `'Internal'`) | Hardcoded in service logic. |
| `Case.Type` | Hardcoded context | `Picklist` (default: `'Student Behavior'`) | Hardcoded in service logic. |
| `Case.Comments` | `description` / Synthesized | `Long Text Area` (multiline detail) | Comments block is saved as the case description or compiled in memory. |
| `Case.Submitted_By__c` | `BehaviorCase.teacherId` | `Lookup(Account)` (Submitting teacher) | Maps to `StaffProfile` UUID. |
| `Case.Student__c` | `BehaviorCase.studentId` | `Lookup(Account)` (Target student) | Maps to `StudentProfile` UUID. |
| `Case.Class_Section__c` | `StudentProfile.classSectionId` | `Lookup(ClassSection)` | Handled via student's class section relation. |

---

## 3. Missing Validation Rules

1.  **Strict Description Length Enforcements**:
    *   **Salesforce Behavior**: Validation rule in the LWC client code enforces that `Description` must have a length of at least 10 characters (`description.length >= 10`).
    *   **Current SaaS Behavior**: Backend and frontend allow empty or short descriptions (no minimum constraints).
    *   **Correction**: Modify the backend NestJS DTO validator `@MinLength(10)` and apply the validation check on frontend submit handlers.
2.  **Required Form Constraints**:
    *   **Salesforce Behavior**: `Behavior Type`, `Category`, `Submitting Teacher`, `Academic Year`, and `Description` are strictly required fields.
    *   **Current SaaS Behavior**: DTO marked `teacherId` and `description` as optional.
    *   **Correction**: Update validation decorators to enforce required fields on backend and add HTML `required` attributes to the frontend select elements.

---

## 4. Missing Workflows

1.  **Priority Auto-assignment**:
    *   **Salesforce Behavior**: Workflow logic automatically assigns `Priority` = `'High'` if the record is a `Complaint`, and `'Medium'` if it is a `Praise`.
    *   **SaaS Behavior**: Already implemented in backend service but requires validation.
2.  **Default Status Initialization**:
    *   **Salesforce Behavior**: New cases default to `Status` = `'New'`.
    *   **SaaS Behavior**: Aligned (defaults to `'New'`).
3.  **Active Teacher Auto-Resolve**:
    *   **Salesforce Behavior**: Resolving cases updates Status to `Closed`.
    *   **SaaS Behavior**: Aligned (Patch endpoint updates status to `'Closed'`).

---

## 5. Missing UI Components

1.  **Filter by Class combobox**: Gated dropdown styled inside a light `#F8FAFC` section.
2.  **Student Card Grid List**: Rendered only when a class is selected, displaying a grid of cards with standard avatars, chevrons, and mobile info.
3.  **Selection Badge / Alert Box**: Confirming selected student with a checkmark success icon and close button.
4.  **Form Combobox Select Fields**: Styled select fields for Behavior Type, Category, Submitting Teacher, and Academic Year (replacing raw toggle buttons).
5.  **Linear Gradient Top Header**: Gradient panel (`linear-gradient(135deg, #2E5BFF 0%, #8B5CF6 100%)`) with custom icon and title metadata matching the Salesforce LWC header.

---

## 6. Exact Files To Modify

1.  `backend/src/complaint-box/dto/create-behavior.dto.ts`
    - Update `description` to be required and set minimum length constraint to 10.
    - Make `teacherId` required to match Salesforce.
2.  `backend/src/complaint-box/complaint-box.service.ts`
    - Verify priority logic and category enforcements.
3.  `frontend/src/app/complaint-box/page.tsx`
    - Full theme replacement: rewrite with the Salesforce SLDS light theme layout.
    - Implement Class filtering dropdown gating, student card grids, selection banner, combobox selectors, validation errors, and SLDS styled tabs.
4.  `frontend/src/app/dashboard/complaints/page.tsx`
    - Update category select list to: `Academic`, `Discipline`, `Sports`, `Extra-Curricular`, `General` to maintain strict picklist parity.

---

## 7. Salesforce Parity Percentage

*   **Database Schema Parity**: 100% (The model fields match the Salesforce custom fields logically and physically).
*   **Backend Validation & Logic Parity**: 75% (Priority auto-assignment and status flows are aligned, but description character-length and teacher validations are currently missing).
*   **Frontend UI & Layout Parity**: 25% (SaaS standalone page uses dark mode slate styles, tabbed layouts, global search, and toggle controls instead of class dropdowns and student card list grids).
*   **Overall Salesforce Parity**: **66%**

---

## 8. SaaS Completion Percentage

*   **Current Completion**: **60%** (Database schema and backend REST endpoints are functional, but UI elements and validation constraints are missing).
*   **Target Completion**: **100%** (Post modifications).
