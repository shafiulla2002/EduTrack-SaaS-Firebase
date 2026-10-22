# Controller Deep-Dive Extraction Plan

**Goal**: Produce a separate markdown artifact for each of the 12 Apex controller/trigger files listed, containing:
1. Method inventory
2. SOQL queries
3. Objects accessed
4. Fields read
5. Fields written
6. Validation logic
7. Business rules
8. Calculations/formulas
9. Trigger side‑effects (if any)
10. External dependencies
11. Salesforce → Prisma mapping
12. Salesforce → NestJS service mapping

## Approach
1. **Gather source files** – We have already retrieved the source for the first six files. We will fetch the remaining six (`EnterMarksController.cls`, `GradesController.cls`, `ExpenseController.cls`, `ClassManagementController.cls`, `InvoiceTriggerHandler.cls`, `InvoiceItemTriggerHandler.cls`).
2. **Parse each file** – For each class we will:
   - Scan line‑by‑line to list public `@AuraEnabled` methods and any private helper methods.
   - Extract every SOQL query (both inline `[SELECT …]` and dynamic). Record the object(s) and selected fields.
   - Record DML operations (insert, update, delete, upsert) and which fields are set.
   - Identify validation (`if … throw new AuraHandledException`) and business rules (e.g., attendance calculations, promotion eligibility, fee calculations).
   - Note any trigger‑related static methods or calls to trigger handlers.
   - Capture external calls (e.g., `ContentDocument`, `ContentVersion`, email, HTTP callouts – none observed yet).
3. **Map to Prisma models** – Using existing object names (`Admission__c`, `Student__c`, `Attendance_Session__c`, etc.) we will draft a Prisma schema fragment mapping each Salesforce object to a model with fields identified in step 2.
4. **Map to NestJS services** – Propose a service name (e.g., `AdmissionService`, `AttendanceService`) and method signatures that mirror the Apex methods, noting input/output DTOs.
5. **Create artifacts** – For each controller/trigger we will write a markdown file under the artifact directory named `<ControllerName>.md` containing the sections above, using bullet lists and code snippets where appropriate.
6. **Review** – After generating all artifacts, we will present a summary to the user for verification.

## Open Questions
- Are there any custom utility classes (e.g., `NamespaceUtils`) that need to be reflected in the Prisma/NestJS mapping, or can we treat them as black‑boxes?
- Should we include unit‑test‑derived behavior (e.g., expectations from test classes) in the business‑rules section?

## Verification Plan
- Ensure every Apex class file is fully read (max 800 lines per view_file call).
- Cross‑check field lists against the corresponding Salesforce object definitions (if available) to avoid missing fields.
- Validate that the generated Prisma schema aligns with current migrations (outside scope for now, but noted for later implementation).

**User Review Required**: Please confirm that this plan meets expectations before we proceed with artifact generation.

---
*This plan was generated automatically and awaits your approval.*
